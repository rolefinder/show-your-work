#!/usr/bin/env bun
/**
 * `bun run mcp:smoke` — exercise /api/mcp's JSON-RPC surface, and the
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
 * Usage: bun scripts/mcp-smoke.ts [--help]
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
  console.error("mcp-smoke: dist/evidence.json missing - run `bun run build` first");
  process.exit(2);
}
if (!existsSync(join(root, "functions", "_lib", "fit-engine.js"))) {
  console.error("mcp-smoke: functions/_lib/fit-engine.js missing - run `bun run build` first");
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
const { DAILY_LIMIT } = await import("../functions/_shared/quota.ts");

/* A KV stand-in, so the quota path can be exercised without wrangler. An
   absent binding means no metering, which is the real behaviour on GitHub
   Pages and in local dev — so every other assertion here runs unmetered. */
function stubKv() {
  const store = new Map<string, string>();
  return {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => void store.set(k, v),
  } as unknown as KVNamespace;
}
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
const post = async (
  body: unknown,
  headers?: Record<string, string>,
  env: { FIT_QUOTA?: KVNamespace } = {},
) => {
  const res = await mcp.onRequestPost({
    request: new Request("https://smoke.local/api/mcp", {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    env,
  } as never);
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, res };
};

/** A well-formed 2026-07-28 request: body _meta and mirrored headers agree. */
const MODERN = "2026-07-28";
const modernPost = async (
  method: string,
  params: Record<string, unknown> = {},
  overrides: { headers?: Record<string, string>; version?: string } = {},
) => {
  const version = overrides.version ?? MODERN;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "mcp-protocol-version": version,
    "mcp-method": method,
    ...(method === "tools/call" && params.name ? { "mcp-name": String(params.name) } : {}),
    ...(overrides.headers || {}),
  };
  return post(
    {
      jsonrpc: "2.0",
      id: 7,
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": version,
          "io.modelcontextprotocol/clientInfo": { name: "mcp-smoke", version: "1.0.0" },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    },
    headers,
  );
};
const call = async (
  name: string,
  args: Record<string, unknown> = {},
  env: { FIT_QUOTA?: KVNamespace } = {},
) => {
  const r = await post(
    { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
    undefined,
    env,
  );
  const raw = r.body?.result?.content?.[0]?.text;
  return { ...r, isError: !!r.body?.result?.isError, data: raw && !r.body.result.isError ? JSON.parse(raw) : raw };
};

const init = await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
ok("initialize echoes a supported protocol version", init.body?.result?.protocolVersion === "2025-06-18");
ok("initialize advertises tools capability", !!init.body?.result?.capabilities?.tools);
ok("initialize names the server from the corpus", !!init.body?.result?.serverInfo?.name);

/* The fallback must be the newest version that HAS a handshake. Answering
   2026-07-28 would hand a legacy client a revision with no `initialize`. */
const unknownVersion = await post({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999-01-01" } });
ok("unknown version falls back to the newest LEGACY revision", unknownVersion.body?.result?.protocolVersion === "2025-11-25", unknownVersion.body?.result?.protocolVersion);
ok("initialize never offers a handshake-less revision", unknownVersion.body?.result?.protocolVersion !== "2026-07-28");

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

/* Every kind the catalogue actually emits must also be an accepted filter.
   Asserted as a relationship rather than a hardcoded list, because the bug this
   guards against is the two drifting: `experience` docs reached evidence.json
   with ADR 027 while the tool's enum still listed only work/blog/about, so an
   agent could see a role in an unfiltered call and be refused when it asked for
   roles. Adding a content type must not need an edit here to stay honest. */
for (const kind of new Set((pages.data?.pages || []).map((p: { kind: string }) => p.kind))) {
  const filtered = await call("list_pages", { kind });
  ok(`list_pages accepts kind "${kind}", which its own catalogue emits`, !filtered.isError, String(filtered.data));
}

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

/* The agent path must apply the same tenant config the browser and /api/fit do.
   It did not, and silently dropped extraStops, skillWeights, showGaps and the
   caveats — including the demo-corpus disclaimer, which exists so a brief built
   from fictional content says so. Compared against the emitted config rather
   than a hardcoded string, so this tracks whatever the adopter configured. */
const fitConfig = JSON.parse(readFileSync(join(dist, "fit-config.json"), "utf8"));
const expectedCaveats: string[] = fitConfig.extraCaveats || [];
if (expectedCaveats.length) {
  const got: string[] = brief.data?.caveats || [];
  const missing = expectedCaveats.filter((c) => !got.includes(c));
  ok("fit_brief applies the tenant Fit config (extraCaveats)", missing.length === 0, `missing ${JSON.stringify(missing)}`);
} else {
  ok("fit_brief returns caveats", Array.isArray(brief.data?.caveats));
}

/* ------------------------------------------------------------ modern era ----
   2026-07-28: no handshake, per-request _meta, mirrored headers validated
   against the body. This endpoint shipped legacy-only, which the spec's own
   compatibility matrix rates as an outright failure against a modern client. */
const discover = await modernPost("server/discover");
ok("server/discover returns supportedVersions", Array.isArray(discover.body?.result?.supportedVersions));
ok("server/discover advertises the current revision", (discover.body?.result?.supportedVersions || []).includes(MODERN));
ok("server/discover carries resultType complete", discover.body?.result?.resultType === "complete");
ok("server/discover carries caching hints", typeof discover.body?.result?.ttlMs === "number" && discover.body?.result?.ttlMs >= 0 && discover.body?.result?.cacheScope === "public");
ok("server/discover identifies the server in _meta", !!discover.body?.result?._meta?.["io.modelcontextprotocol/serverInfo"]?.name);
ok("server/discover advertises tools capability", !!discover.body?.result?.capabilities?.tools);

const modernList = await modernPost("tools/list");
ok("modern tools/list succeeds", (modernList.body?.result?.tools || []).length === 3, `status ${modernList.status}`);
ok("tools/list carries caching hints", modernList.body?.result?.ttlMs >= 0 && modernList.body?.result?.cacheScope === "public");
ok("tools/list carries resultType", modernList.body?.result?.resultType === "complete");

const modernCall = await modernPost("tools/call", { name: "list_pages", arguments: {} });
ok("modern tools/call succeeds", !!modernCall.body?.result?.content, `status ${modernCall.status}`);
ok("tools/call carries resultType", modernCall.body?.result?.resultType === "complete");

/* Header/body disagreement is the confused-deputy case the spec requires
   servers to reject: a gateway routing on the header while the server executes
   the body. */
const nameMismatch = await modernPost("tools/call", { name: "list_pages", arguments: {} }, { headers: { "mcp-name": "get_page" } });
ok("Mcp-Name mismatch is 400 / -32020", nameMismatch.status === 400 && nameMismatch.body?.error?.code === -32020, `${nameMismatch.status} / ${nameMismatch.body?.error?.code}`);

const methodMismatch = await modernPost("tools/list", {}, { headers: { "mcp-method": "tools/call" } });
ok("Mcp-Method mismatch is 400 / -32020", methodMismatch.status === 400 && methodMismatch.body?.error?.code === -32020);

const missingVersionHeader = await post(
  { jsonrpc: "2.0", id: 8, method: "tools/list", params: { _meta: { "io.modelcontextprotocol/protocolVersion": MODERN } } },
  { "mcp-method": "tools/list" },
);
ok("missing MCP-Protocol-Version is 400 / -32020", missingVersionHeader.status === 400 && missingVersionHeader.body?.error?.code === -32020);

const versionSkew = await modernPost("tools/list", {}, { headers: { "mcp-protocol-version": "2025-11-25" } });
ok("header/body version skew is 400 / -32020", versionSkew.status === 400 && versionSkew.body?.error?.code === -32020);

const badVersion = await modernPost("tools/list", {}, { version: "1900-01-01" });
ok("unsupported version is 400 / -32022", badVersion.status === 400 && badVersion.body?.error?.code === -32022, `${badVersion.status} / ${badVersion.body?.error?.code}`);
ok("-32022 lists supported versions", (badVersion.body?.error?.data?.supported || []).includes(MODERN));
ok("-32022 echoes the requested version", badVersion.body?.error?.data?.requested === "1900-01-01");

/* ------------------------------------------------------------ JSON-RPC edges */
const notification = await post({ jsonrpc: "2.0", method: "notifications/initialized" });
ok("a notification gets 202 with no body", notification.status === 202);
const batch = await post([{ jsonrpc: "2.0", id: 1, method: "ping" }]);
ok("batching is refused", batch.body?.error?.code === -32600);
const parseError = await post("{not json");
ok("a parse error is reported as -32700", parseError.body?.error?.code === -32700);
/* MUST be HTTP 404, which is how a client tells a modern server apart from a
   legacy one that does not host this endpoint at all. */
const badMethod = await post({ jsonrpc: "2.0", id: 3, method: "does/not/exist" });
ok("an unknown method is 404 / -32601", badMethod.status === 404 && badMethod.body?.error?.code === -32601, `status ${badMethod.status}`);
const unknownTool = await call("no_such_tool");
ok("an unknown tool is -32602", unknownTool.body?.error?.code === -32602);
const oversized = await post({ jsonrpc: "2.0", id: 4, method: "ping", params: { pad: "x".repeat(64 * 1024) } });
ok("an oversized body is refused", oversized.body?.error?.code === -32600);

const get = await mcp.onRequestGet();
ok("GET is 405 with an Allow header", get.status === 405 && get.headers.get("allow") === "POST, OPTIONS");
const options = await mcp.onRequestOptions();
ok("OPTIONS preflight is 204 with CORS", options.status === 204 && options.headers.get("access-control-allow-origin") === "*");

/* ------------------------------------------------------------------ quota --
 * The budget is SHARED with POST /api/fit, not per-endpoint.
 *
 * This exists because it was once absent: /api/fit charged 2/day and this
 * endpoint, exposing the same matcher through fit_brief, charged nothing — so
 * the limit had a second unmetered door (ADR 024). Reads stay free; only the
 * tool that runs the matcher is charged.
 */
const quotaEnv = { FIT_QUOTA: stubKv() };
const quotaJd = "Requirements\n- Experience building CI/CD pipelines with GitHub Actions\n";
for (let i = 1; i <= DAILY_LIMIT; i++) {
  const r = await call("fit_brief", { job_description: quotaJd }, quotaEnv);
  ok(`fit_brief is allowed on call ${i} of ${DAILY_LIMIT}`, !r.isError, String(r.data));
}
const overLimit = await call("fit_brief", { job_description: quotaJd }, quotaEnv);
ok(
  `a fit_brief past ${DAILY_LIMIT}/day is refused`,
  overLimit.isError,
  "the /api/fit quota has an unmetered door again",
);
const stillFree = await call("list_pages", {}, quotaEnv);
ok("list_pages stays free", !stillFree.isError, "a static read was charged against the Fit quota");

if (failures.length) {
  console.error("mcp-smoke: FAILED");
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(
  `mcp-smoke ok (${pages.data.total} pages, ${brief.data.requirements.length} requirements scored, ` +
    `routing + protocol asserted, quota ${DAILY_LIMIT}/day shared with /api/fit, reads free)`,
);
