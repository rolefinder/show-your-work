/**
 * POST /api/mcp — read-only Model Context Protocol endpoint.
 *
 * The site already publishes two machine-readable surfaces: llms.txt (an index
 * for answer engines) and evidence.json (the URL-cited corpus behind /fit).
 * Both are pull artifacts an agent has to know about, fetch and parse. This
 * exposes the same corpus the way agents actually connect to things, so a
 * recruiter's assistant can enumerate, read and score the portfolio without
 * scraping it.
 *
 * ## Dual-era
 *
 * Revision 2026-07-28 made MCP stateless: it removed the `initialize` handshake
 * and `Mcp-Session-Id`, moved protocol version and client capabilities into
 * per-request `_meta`, added a required `server/discover` RPC, and requires the
 * `MCP-Protocol-Version` / `Mcp-Method` / `Mcp-Name` headers to be validated
 * against the body.
 *
 * This server speaks both eras on one endpoint, which the spec explicitly
 * provides for (basic/versioning § Backward Compatibility): a request carrying
 * modern metadata is served statelessly per 2026-07-28; an `initialize` request
 * selects legacy semantics. Modern-only would strand every client built against
 * a revision older than three weeks; legacy-only — which is what this endpoint
 * shipped as first — fails outright against a modern client, per the spec's own
 * compatibility matrix.
 *
 * Era is chosen by how the client opens: any of the modern headers or a
 * `_meta` protocol version means modern, and modern requests are fully
 * validated. Anything else is served the legacy way. `server/discover` is
 * answered on either path, because clients use it as a backward-compatibility
 * probe and servers MUST implement it.
 *
 * ## What is deliberately not implemented
 *
 * - `subscriptions/listen` — nothing changes at runtime. The corpus is a build
 *   artifact, so there is no change to notify about between deploys.
 * - MRTR / `InputRequiredResult` — no tool needs input from the user to finish.
 * - The Tasks extension — every tool here is fast and synchronous.
 *
 * ## No model runs here
 *
 * ADR 010's rule is that nothing in the matching path may hallucinate, and the
 * README's claim is that a brief cannot invent an employer, a date or a metric
 * because it can only quote text already in content/. Summarizing the corpus
 * with an LLM would break exactly that. The intelligence is the agent's; the
 * honesty is ours. A job description is untrusted input and only ever reaches
 * the deterministic matcher.
 *
 * Zero metered resources: no KV, no secrets, no bindings, no outbound model
 * calls, so this endpoint cannot run up a bill.
 *
 * GitHub Pages runs no Functions, so on that target this file is inert and the
 * discovery manifest is not emitted — see docs/guide/deploy.md. evidence.json
 * stays static and public on both targets.
 */

import { charge, DAILY_LIMIT, type QuotaEnv } from "../_shared/quota";

/** Newest first. The tail is reachable only through the legacy handshake. */
const PROTOCOL_VERSIONS = [
  "2026-07-28",
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
];
/** Revisions that carry metadata per request instead of in a handshake. */
const MODERN_VERSIONS = ["2026-07-28"];
/** Revisions reachable through `initialize`. Newest first. */
const LEGACY_VERSIONS = PROTOCOL_VERSIONS.filter((v) => !MODERN_VERSIONS.includes(v));

const MAX_BODY = 64 * 1024;
/** Matches MAX_CHARS in ./fit.ts — one JD limit for both entry points. */
const MAX_JD = 12000;

/** The tool list changes only when the site is redeployed. */
const LIST_TTL_MS = 3600000;

const META_VERSION = "io.modelcontextprotocol/protocolVersion";
const META_SERVER_INFO = "io.modelcontextprotocol/serverInfo";

/* JSON-RPC / MCP error codes. -32000..-32019 is implementation-defined;
   -32020..-32099 is reserved for the specification. */
const E_PARSE = -32700;
const E_INVALID_REQUEST = -32600;
const E_METHOD_NOT_FOUND = -32601;
const E_INVALID_PARAMS = -32602;
const E_INTERNAL = -32603;
const E_NO_GET = -32000;
const E_HEADER_MISMATCH = -32020;
const E_UNSUPPORTED_VERSION = -32022;

type EvidenceDoc = {
  id: string;
  kind: string;
  title: string;
  url: string;
  text: string;
  skills: string[];
  claims?: string[];
  skillNotes?: Record<string, string>;
};

type EvidencePack = { version: number; docs: EvidenceDoc[] };

const KINDS = ["about", "work", "blog", "experience"] as const;

/* Public read-only data, so wildcard CORS is deliberate: the corpus IS the
   published site. There is no origin-gated state to protect and no session to
   rebind, which is what the spec's origin-validation guidance defends against.
   Browser-based agents can therefore connect directly. */
const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  /* The union of both eras: mcp-method / mcp-name are 2026-07-28, and
     mcp-session-id is the legacy handshake's. A dual-era server that rejects
     the legacy header at preflight is not dual-era from a browser. */
  "access-control-allow-headers":
    "content-type, accept, mcp-protocol-version, mcp-method, mcp-name, mcp-session-id",
  "access-control-expose-headers": "mcp-protocol-version",
  "access-control-max-age": "86400",
};

const json = (status: number, body: unknown, extra?: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...CORS,
      ...(extra || {}),
    },
  });

const rpcError = (id: unknown, code: number, message: string, data?: unknown, status = 200) =>
  json(status, {
    jsonrpc: "2.0",
    id: id === undefined ? null : id,
    error: data === undefined ? { code, message } : { code, message, data },
  });

const TOOLS = [
  {
    name: "list_pages",
    title: "List published pages",
    description:
      "List every published page in this portfolio (projects, blog posts, about) with id, title, canonical URL and skills. Start here, then use get_page for full text.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: KINDS, description: "Optional filter by page kind." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_page",
    title: "Get one page",
    description:
      'Fetch one published page by evidence id (e.g. "work:my-project") — full text, canonical URL and skills.',
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Evidence id from list_pages." } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "fit_brief",
    title: "Score a job description",
    description:
      "Deterministically map a job description's requirements to published evidence. Every aligned or partial claim cites a canonical page URL and quotes text that already exists on that page — nothing is model-generated, so it cannot invent an employer, a date or a metric.",
    inputSchema: {
      type: "object",
      properties: {
        job_description: {
          type: "string",
          description: `Job description text (max ${MAX_JD} characters).`,
        },
      },
      required: ["job_description"],
      additionalProperties: false,
    },
  },
];

const INSTRUCTIONS =
  "Read-only portfolio server. list_pages enumerates published projects, posts and the about page; " +
  "get_page returns one page's full text; fit_brief deterministically scores a job description against " +
  "published evidence and returns a brief where every aligned claim cites a canonical URL and quotes " +
  "text that already exists on that page. No model runs server-side, so nothing here is generated. " +
  "All data is public.";

async function loadDocs(request: Request): Promise<EvidenceDoc[]> {
  const res = await fetch(new URL("/evidence.json", request.url).toString());
  if (!res.ok) throw new Error("evidence_unavailable");
  const pack = (await res.json()) as EvidencePack;
  if (!pack || pack.version !== 1 || !Array.isArray(pack.docs)) throw new Error("evidence_unavailable");
  return pack.docs;
}

/**
 * The same tenant config /api/fit and the browser both pass to the matcher.
 *
 * Without it the agent path silently ignored extraStops, synonyms,
 * skillWeights, showGaps and extraCaveats — including the demo-corpus
 * disclaimer, which exists precisely so a brief built from fictional content
 * says so. An absent or unreadable config falls back to engine defaults rather
 * than failing the call, matching functions/api/fit.ts.
 */
async function loadFitConfig(request: Request): Promise<unknown> {
  try {
    const res = await fetch(new URL("/fit-config.json", request.url).toString());
    return res.ok ? await res.json() : undefined;
  } catch {
    return undefined;
  }
}

/* MCP carries tool results as content blocks; JSON in a text block is what
   every client can render and what an agent can parse. */
const asText = (value: unknown) => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});
const toolError = (message: string) => ({
  content: [{ type: "text", text: message }],
  isError: true,
});

async function callTool(
  name: string,
  args: Record<string, unknown>,
  request: Request,
  env: QuotaEnv,
) {
  if (name === "list_pages") {
    const kind = args.kind;
    if (kind !== undefined && !KINDS.includes(kind as (typeof KINDS)[number])) {
      return toolError(`kind must be one of ${KINDS.map((k) => `"${k}"`).join(", ")}.`);
    }
    const docs = await loadDocs(request);
    const pages = docs
      .filter((d) => !kind || d.kind === kind)
      .map(({ id, kind: k, title, url, skills }) => ({ id, kind: k, title, url, skills }));
    return asText({ total: pages.length, pages });
  }

  if (name === "get_page") {
    const id = String(args.id || "");
    if (!id) return toolError("id is required — call list_pages for valid ids.");
    const docs = await loadDocs(request);
    const doc = docs.find((d) => d.id === id);
    return doc
      ? asText(doc)
      : toolError(`No page with id ${JSON.stringify(id)} — call list_pages for valid ids.`);
  }

  if (name === "fit_brief") {
    const jd = String(args.job_description || "").trim();
    if (!jd) return toolError("job_description is required.");
    if (jd.length > MAX_JD) return toolError(`job_description too large (max ${MAX_JD} characters).`);
    /* The only tool here that runs the matcher, so the only one charged —
       list_pages and get_page are reads of a static file. Same module and same
       key as POST /api/fit, so an agent cannot get a bigger budget by coming
       through MCP instead (ADR 024). */
    const quota = await charge(request, env);
    if (!quota.allowed) {
      return toolError(`Daily limit reached (${DAILY_LIMIT} briefs). list_pages and get_page still work.`);
    }
    const [docs, cfg] = await Promise.all([loadDocs(request), loadFitConfig(request)]);
    // Same bundled engine and same config /api/fit uses, so both entry points
    // answer a given JD identically. Built by `bun run build:fit-worker`.
    const { matchFit } = await import("../_lib/fit-engine.js");
    return asText(matchFit(jd, docs, cfg));
  }

  return null;
}

/* ------------------------------- header rules ------------------------------ */

/**
 * `Mcp-Name` (and `Mcp-Param-*`) may arrive Base64-encoded when the value is
 * not safely representable as an ASCII header. Servers MUST decode before
 * comparing to the body.
 */
function decodeHeaderValue(raw: string): string {
  const m = raw.match(/^=\?base64\?(.*)\?=$/);
  if (!m) return raw;
  try {
    return new TextDecoder().decode(
      Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)),
    );
  } catch {
    return raw;
  }
}

/**
 * Validate the mirrored headers against the body. The body is the source of
 * truth; the headers exist so gateways can route without parsing it, and a
 * disagreement between the two is exactly the confused-deputy case the spec
 * requires servers to reject.
 */
function headerMismatch(
  request: Request,
  method: string,
  params: Record<string, unknown>,
  bodyVersion: string | undefined,
): string | null {
  const header = (n: string) => request.headers.get(n);

  const version = header("mcp-protocol-version");
  if (!version) return "MCP-Protocol-Version header is required.";
  if (bodyVersion && bodyVersion !== version) {
    return `MCP-Protocol-Version header "${version}" does not match _meta protocol version "${bodyVersion}".`;
  }

  const mcpMethod = header("mcp-method");
  if (!mcpMethod) return "Mcp-Method header is required.";
  if (mcpMethod !== method) {
    return `Mcp-Method header "${mcpMethod}" does not match body method "${method}".`;
  }

  if (method === "tools/call") {
    const name = header("mcp-name");
    if (!name) return "Mcp-Name header is required for tools/call.";
    if (decodeHeaderValue(name) !== String(params.name ?? "")) {
      return `Mcp-Name header "${decodeHeaderValue(name)}" does not match body name "${String(params.name ?? "")}".`;
    }
  }

  return null;
}

/* --------------------------------- results -------------------------------- */

/**
 * Every result carries `resultType` and the server's identity. Both are
 * required or recommended by 2026-07-28, and both are ignorable extra fields to
 * an older client, so one shape serves both eras.
 */
function makeResult(payload: Record<string, unknown>, info: { name: string; version: string }) {
  return {
    resultType: "complete",
    ...payload,
    _meta: { [META_SERVER_INFO]: info },
  };
}

/** tools/list and server/discover MUST carry caching hints. */
const cacheable = { ttlMs: LIST_TTL_MS, cacheScope: "public" as const };

export const onRequestOptions = async () => new Response(null, { status: 204, headers: CORS });

/* GET and DELETE are not part of this revision's transport: the standalone SSE
   stream was replaced by subscriptions/listen, which this server does not
   implement because the corpus cannot change between deploys. */
export const onRequestGet = async () =>
  json(
    405,
    {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: E_NO_GET,
        message: "GET not supported — POST a single JSON-RPC message (stateless Streamable HTTP).",
      },
    },
    { allow: "POST, OPTIONS" },
  );
export const onRequestDelete = onRequestGet;

export const onRequestPost: PagesFunction<QuotaEnv> = async ({ request, env }) => {
  /* Origin validation is required. The corpus is the published site and CORS is
     deliberately wildcard, so every origin is valid here — stated explicitly
     because "we have no policy" and "our policy is to allow all" look identical
     from the outside, and only one of them is a decision. */

  const raw = await request.text();
  if (raw.length > MAX_BODY) return rpcError(null, E_INVALID_REQUEST, "Request too large.", undefined, 400);

  let msg: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    msg = JSON.parse(raw);
  } catch {
    return rpcError(null, E_PARSE, "Parse error.", undefined, 400);
  }
  if (Array.isArray(msg)) {
    return rpcError(null, E_INVALID_REQUEST, "JSON-RPC batching is not supported.", undefined, 400);
  }
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return rpcError(msg && msg.id, E_INVALID_REQUEST, "Invalid request.", undefined, 400);
  }

  /* Notifications (no id member) get a bare 202 per Streamable HTTP. `id: null`
     is a discouraged-but-valid request id and still expects a response, so only
     a truly absent id is a notification. */
  if (msg.id === undefined) return new Response(null, { status: 202, headers: CORS });

  const { id, method } = msg;
  const params = msg.params || {};
  const meta = (params._meta as Record<string, unknown> | undefined) || {};
  const bodyVersion = typeof meta[META_VERSION] === "string" ? (meta[META_VERSION] as string) : undefined;
  const headerVersion = request.headers.get("mcp-protocol-version") || undefined;

  /* Era detection. A client that sends any modern signal is held to the modern
     rules; anything else — notably a legacy `initialize` — is served the old
     way. Sessions are not part of this revision, so an Mcp-Session-Id header
     from an older client is ignored rather than echoed. */
  const declared = bodyVersion || headerVersion;
  const isModern =
    !!(declared && MODERN_VERSIONS.includes(declared)) ||
    !!request.headers.get("mcp-method");

  try {
    const info = await serverInfo(request);

    if (isModern) {
      const mismatch = headerMismatch(request, method, params, bodyVersion);
      if (mismatch) return rpcError(id, E_HEADER_MISMATCH, `Header mismatch: ${mismatch}`, undefined, 400);

      const requested = declared || headerVersion;
      if (!requested || !PROTOCOL_VERSIONS.includes(requested) || !MODERN_VERSIONS.includes(requested)) {
        return rpcError(
          id,
          E_UNSUPPORTED_VERSION,
          "Unsupported protocol version",
          { supported: MODERN_VERSIONS, requested: requested ?? null },
          400,
        );
      }
    }

    if (method === "server/discover") {
      return json(200, {
        jsonrpc: "2.0",
        id,
        result: makeResult(
          {
            supportedVersions: PROTOCOL_VERSIONS,
            capabilities: { tools: {} },
            instructions: INSTRUCTIONS,
            ...cacheable,
          },
          info,
        ),
      });
    }

    /* Legacy handshake. Retained so clients built against 2024-11-05 through
       2025-11-25 keep working; the modern era has no handshake at all. */
    if (method === "initialize") {
      /* Echo only a version that HAS a handshake. Answering 2026-07-28 here
         would hand a legacy client a revision with no `initialize` at all,
         so an unrecognized ask falls back to the newest legacy revision. */
      const asked = params.protocolVersion as string | undefined;
      return json(200, {
        jsonrpc: "2.0",
        id,
        result: makeResult(
          {
            protocolVersion: asked && LEGACY_VERSIONS.includes(asked) ? asked : LEGACY_VERSIONS[0],
            capabilities: { tools: {} },
            serverInfo: info,
            instructions: INSTRUCTIONS,
          },
          info,
        ),
      });
    }

    /* Removed from the core protocol in 2026-07-28; answered for legacy clients
       that still send it. */
    if (method === "ping") {
      return json(200, { jsonrpc: "2.0", id, result: makeResult({}, info) });
    }

    if (method === "tools/list") {
      // Deterministic order, so clients can cache the catalogue and keep
      // upstream prompt caches stable.
      return json(200, {
        jsonrpc: "2.0",
        id,
        result: makeResult({ tools: TOOLS, ...cacheable }, info),
      });
    }

    if (method === "tools/call") {
      if (typeof params.name !== "string") return rpcError(id, E_INVALID_PARAMS, "params.name is required.");
      const result = await callTool(
        params.name,
        (params.arguments as Record<string, unknown>) || {},
        request,
        env,
      );
      if (!result) return rpcError(id, E_INVALID_PARAMS, `Unknown tool: ${params.name}`);
      return json(200, { jsonrpc: "2.0", id, result: makeResult(result, info) });
    }

    /* An unimplemented method MUST be HTTP 404 with a JSON-RPC error, which is
       what lets a client tell a modern server apart from a legacy one that does
       not host this endpoint at all. */
    return rpcError(id, E_METHOD_NOT_FOUND, `Method not found: ${method}`, undefined, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    return rpcError(
      id,
      E_INTERNAL,
      message === "evidence_unavailable" ? "Evidence pack unavailable." : "Internal error.",
    );
  }
};

/* Identity comes from the corpus, never from a constant in this file —
   check-adopter-config.mjs fails the build on a name or origin hardcoded under
   functions/, and it is right to: this file ships to every fork. */
async function serverInfo(request: Request): Promise<{ name: string; version: string }> {
  let name = "portfolio";
  try {
    const docs = await loadDocs(request);
    const about = docs.find((d) => d.kind === "about");
    if (about?.title) name = about.title.replace(/\s+—\s+About$/, "");
  } catch {
    /* Discovery should still answer if the corpus is briefly unavailable. */
  }
  return { name, version: "1.0.0" };
}
