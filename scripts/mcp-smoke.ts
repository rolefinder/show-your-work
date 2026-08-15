#!/usr/bin/env -S npx tsx
/**
 * `npm run mcp:smoke` — exercise /api/mcp's JSON-RPC surface, and the
 * middleware routing that has to let it through.
 *
 * Runs the handler in-process against dist/ rather than under `wrangler pages
 * dev`: wrangler needs a login-shaped environment and a port, which makes it
 * the kind of check that gets skipped, and everything worth asserting here is
 * pure request-in/response-out.
 *
 * The routing half is not incidental. The middleware runs ahead of every
 * Function, and /api paths have no file extension, so they used to fall through
 * to the known-paths lookup — which lists the site's routes, never its
 * endpoints — and were answered with a 404 document before any handler ran.
 * POST /api/fit had been unreachable on Cloudflare for that reason. A protocol
 * test that passes while the route 404s in production would be worse than no
 * test, so both are asserted here.
 *
 * Usage: npx tsx scripts/mcp-smoke.ts [--help]
 * Exit 0 = pass · 1 = failure · 2 = can't run (no dist).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^#![^\n]*\n\/\*\*?/, ""));
  process.exit(0);
}

if (!existsSync(join(dist, "evidence.json"))) {
  console.error("mcp-smoke: dist/evidence.json missing - run `npm run build` first");
  process.exit(2);
}
if (!existsSync(join(root, "functions", "_lib", "fit-engine.js"))) {
  console.error("mcp-smoke: functions/_lib/fit-engine.js missing - run `npm run build` first");
  process.exit(2);
}

const failures: string[] = [];
const ok = (label: string, cond: unknown, detail?: string) => {
  if (!cond) failures.push(detail ? `${label}: ${detail}` : label);
};

/* dist/ served from disk — the Function fetches /evidence.json by absolute URL. */
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname === "smoke.local") {
    const file = join(dist, ...url.pathname.split("/").filter(Boolean));
    if (!existsSync(file)) return new Response("not found", { status: 404 });
    return new Response(readFileSync(file, "utf8"), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return realFetch(input as RequestInfo, init);
}) as typeof fetch;

const mcp = await import("../functions/api/mcp.ts");
const middleware = await import("../functions/_middleware.js");

/* ---------------------------------------------------------------- routing --
   The middleware must hand every /api path to the Function chain untouched. */
async function routed(path: string, method = "POST") {
  let reached = false;
  const res = await middleware.onRequest({
    request: new Request("https://smoke.local" + path, { method }),
    env: {
      ASSETS: {
        fetch: async (u: URL) =>
          new URL(u).pathname === "/known-paths.json"
            ? new Response(readFileSync(join(dist, "known-paths.json"), "utf8"))
            : new Response("<html></html>", { headers: { "content-type": "text/html" } }),
      },
    },
    next: async () => {
      reached = true;
      return new Response("handler");
    },
  });
  return { reached, status: res.status };
}

const mcpRoute = await routed("/api/mcp");
ok("middleware routes /api/mcp to its Function", mcpRoute.reached, `got status ${mcpRoute.status}`);
const fitRoute = await routed("/api/fit");
ok("middleware routes /api/fit to its Function", fitRoute.reached, `got status ${fitRoute.status}`);
const pageRoute = await routed("/work", "GET");
ok("middleware still serves real routes itself", !pageRoute.reached && pageRoute.status === 200);
const missRoute = await routed("/does-not-exist", "GET");
ok("middleware still 404s unknown routes", missRoute.status === 404);

/* --------------------------------------------------------------- protocol -- */
const post = async (body: unknown) => {
  const res = await mcp.onRequestPost({
    request: new Request("https://smoke.local/api/mcp", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  } as never);
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, res };
};
const call = async (name: string, args: Record<string, unknown> = {}) => {
  const r = await post({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });
  const raw = r.body?.result?.content?.[0]?.text;
  return { ...r, isError: !!r.body?.result?.isError, data: raw && !r.body.result.isError ? JSON.parse(raw) : raw };
};

const init = await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
ok("initialize echoes a supported protocol version", init.body?.result?.protocolVersion === "2025-06-18");
ok("initialize advertises tools capability", !!init.body?.result?.capabilities?.tools);
ok("initialize names the server from the corpus", !!init.body?.result?.serverInfo?.name);

const unknownVersion = await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999-01-01" } });
ok("unknown protocol version falls back to newest", unknownVersion.body?.result?.protocolVersion === "2025-06-18");

const list = await post({ jsonrpc: "2.0", id: 2, method: "tools/list" });
const toolNames = (list.body?.result?.tools || []).map((t: { name: string }) => t.name).sort();
ok("tools/list returns the three read-only tools", JSON.stringify(toolNames) === '["fit_brief","get_page","list_pages"]', toolNames.join(","));

const pages = await call("list_pages");
ok("list_pages returns pages", pages.data?.total > 0, JSON.stringify(pages.data)?.slice(0, 120));
ok("every page carries a canonical URL", (pages.data?.pages || []).every((p: { url: string }) => typeof p.url === "string" && p.url.startsWith("/")));

const workOnly = await call("list_pages", { kind: "work" });
ok("list_pages filters by kind", (workOnly.data?.pages || []).every((p: { kind: string }) => p.kind === "work") && workOnly.data.total > 0);
const badKind = await call("list_pages", { kind: "nope" });
ok("list_pages rejects an unknown kind", badKind.isError);

const firstId = pages.data?.pages?.[0]?.id;
const page = await call("get_page", { id: firstId });
ok("get_page returns full text", typeof page.data?.text === "string" && page.data.text.length > 0);
const missing = await call("get_page", { id: "work:not-a-real-slug" });
ok("get_page reports an unknown id as a tool error", missing.isError);

const brief = await call("fit_brief", {
  job_description: [
    "Platform Engineer",
    "- Experience building CI/CD pipelines with GitHub Actions",
    "- Strong YAML content pipeline experience",
    "- TypeScript across build tooling",
    "- Nice to have: Kubernetes and multi-cloud operations",
  ].join("\n"),
});
ok("fit_brief returns requirements", Array.isArray(brief.data?.requirements) && brief.data.requirements.length > 0);
/* The contract the whole product rests on: aligned requires a citation. */
const alignedWithoutCitation = (brief.data?.requirements || []).filter(
  (r: { status: string; evidence: unknown[] }) => r.status === "aligned" && (!r.evidence || r.evidence.length === 0),
);
ok("no aligned requirement lacks a citation", alignedWithoutCitation.length === 0, `${alignedWithoutCitation.length} uncited`);
const emptyJd = await call("fit_brief", { job_description: "   " });
ok("fit_brief rejects an empty JD", emptyJd.isError);
const hugeJd = await call("fit_brief", { job_description: "x".repeat(12001) });
ok("fit_brief rejects an oversized JD", hugeJd.isError);

/* ------------------------------------------------------------ JSON-RPC edges */
const notification = await post({ jsonrpc: "2.0", method: "notifications/initialized" });
ok("a notification gets 202 with no body", notification.status === 202);
const batch = await post([{ jsonrpc: "2.0", id: 1, method: "ping" }]);
ok("batching is refused", batch.body?.error?.code === -32600);
const parseError = await post("{not json");
ok("a parse error is reported as -32700", parseError.body?.error?.code === -32700);
const badMethod = await post({ jsonrpc: "2.0", id: 3, method: "does/not/exist" });
ok("an unknown method is -32601", badMethod.body?.error?.code === -32601);
const unknownTool = await call("no_such_tool");
ok("an unknown tool is -32602", unknownTool.body?.error?.code === -32602);
const oversized = await post({ jsonrpc: "2.0", id: 4, method: "ping", params: { pad: "x".repeat(64 * 1024) } });
ok("an oversized body is refused", oversized.body?.error?.code === -32600);

const get = await mcp.onRequestGet();
ok("GET is 405 with an Allow header", get.status === 405 && get.headers.get("allow") === "POST, OPTIONS");
const options = await mcp.onRequestOptions();
ok("OPTIONS preflight is 204 with CORS", options.status === 204 && options.headers.get("access-control-allow-origin") === "*");

if (failures.length) {
  console.error("mcp-smoke: FAILED");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`mcp-smoke ok (${pages.data.total} pages, ${brief.data.requirements.length} requirements scored, routing + protocol asserted)`);
