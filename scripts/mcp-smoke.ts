#!/usr/bin/env -S npx tsx
/**
 * Smoke: the MCP endpoint speaks enough of the protocol to be usable, and its
 * fit_brief answers with the same engine the site uses.
 *
 * The handler is imported and driven with real Request objects rather than
 * served, so this needs no wrangler and no port. `fetch` is stubbed to read
 * dist/ off disk, which is exactly what the platform does for
 * same-origin asset requests from a Function.
 *
 * Usage: npx tsx scripts/mcp-smoke.ts   (after npm run build)
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

/* Serve dist/ for same-origin fetches, the way Pages serves assets to a
   Function. Anything else is a bug in the endpoint, so make it loud. */
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname !== "example.test") return realFetch(input as RequestInfo);
  const file = join(dist, ...url.pathname.split("/").filter(Boolean));
  if (!existsSync(file)) return new Response("not found", { status: 404 });
  return new Response(readFileSync(file, "utf8"), { status: 200, headers: { "content-type": "application/json" } });
}) as typeof fetch;

const { onRequestPost, onRequestGet } = await import("../functions/api/mcp.ts");

let nextId = 1;
async function rpc(method: string, params?: unknown): Promise<Record<string, unknown>> {
  const id = nextId++;
  const res = await (onRequestPost as (ctx: { request: Request }) => Promise<Response>)({
    request: new Request("https://example.test/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    }),
  });
  if (res.status !== 200) fail(`${method} returned HTTP ${res.status}, expected 200`);
  const body = (await res.json()) as Record<string, any>;
  if (body.error) fail(`${method} returned a JSON-RPC error: ${JSON.stringify(body.error)}`);
  if (body.id !== id) fail(`${method} echoed id ${body.id}, expected ${id}`);
  return body.result as Record<string, unknown>;
}

/* GET has no SSE stream to offer in stateless mode. */
const getRes = await (onRequestGet as () => Promise<Response>)();
if (getRes.status !== 405) fail(`GET returned ${getRes.status}, expected 405`);

const init = (await rpc("initialize", { protocolVersion: "2025-06-18" })) as any;
if (init.protocolVersion !== "2025-06-18") fail(`initialize did not echo the client's protocol version`);
if (!init.capabilities?.tools) fail("initialize did not advertise the tools capability");
if (!init.serverInfo?.name) fail("initialize returned no serverInfo.name");

const { tools } = (await rpc("tools/list")) as any;
const names = tools.map((t: any) => t.name).sort();
if (String(names) !== "fit_brief,get_page,list_pages") fail(`unexpected tool set: ${names}`);

async function call(name: string, args: unknown): Promise<any> {
  const result = (await rpc("tools/call", { name, arguments: args })) as any;
  if (result.isError) fail(`${name} errored: ${result.content?.[0]?.text}`);
  return JSON.parse(result.content[0].text);
}

const listed = await call("list_pages", {});
if (!listed.total || !Array.isArray(listed.pages)) fail("list_pages returned no pages");

const work = await call("list_pages", { kind: "work" });
if (!work.pages.length) fail("list_pages kind=work returned nothing");
if (work.pages.some((p: any) => p.kind !== "work")) fail("list_pages kind=work leaked another kind");

const page = await call("get_page", { id: listed.pages[0].id });
if (!page.text) fail("get_page returned no text");

/* The contract the whole project rests on: aligned requires a citation. */
const brief = await call("fit_brief", {
  job_description: "Requirements\n- Experience building CI/CD pipelines with GitHub Actions\n",
});
const aligned = (brief.requirements || []).filter((r: any) => r.status === "aligned");
if (!aligned.length) fail("fit_brief found no aligned requirement for a JD the demo corpus covers");
for (const r of aligned) {
  if (!r.evidence?.length) fail(`fit_brief returned an aligned requirement with no citation: ${r.text}`);
}

/* Unknown tool and oversized input are refused, not silently tolerated. */
const unknown = await (onRequestPost as (ctx: { request: Request }) => Promise<Response>)({
  request: new Request("https://example.test/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 99, method: "tools/call", params: { name: "rm_rf" } }),
  }),
});
if (!(await unknown.json() as any).error) fail("an unknown tool name did not produce a JSON-RPC error");

const big = (await rpc("tools/call", {
  name: "fit_brief",
  arguments: { job_description: "x".repeat(12001) },
})) as any;
if (!big.isError) fail("a 12001-char job description was not refused");

/* A notification (no id) gets 202 and no body. */
const notif = await (onRequestPost as (ctx: { request: Request }) => Promise<Response>)({
  request: new Request("https://example.test/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  }),
});
if (notif.status !== 202) fail(`a notification returned ${notif.status}, expected 202`);

console.log("mcp-smoke ok", {
  tools: names.length,
  pages: listed.total,
  work: work.pages.length,
  alignedCited: aligned.length,
});
