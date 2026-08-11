/**
 * POST /api/mcp — read-only Model Context Protocol endpoint.
 *
 * Stateless Streamable HTTP: each JSON-RPC request gets one JSON response, no
 * sessions, no SSE, no server-initiated messages. It exposes the corpus the
 * site already publishes (`/evidence.json`) plus the deterministic Fit matcher
 * — no model call, no KV, no secrets, no bindings — so the endpoint cannot
 * cost money or return anything that is not already public.
 *
 * The job description is untrusted input and only ever reaches the
 * deterministic matcher, the same posture as POST /api/fit (ADR 012).
 */

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_BODY = 64 * 1024;
const MAX_JD = 12000;

/* The corpus IS the published site, so there is no origin-gated state to
   protect and no session to rebind — the thing the spec's origin-validation
   guidance defends against. Wildcard lets browser-based agents connect. */
const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept, mcp-protocol-version, mcp-session-id",
  "access-control-max-age": "86400",
};

/* A stable protocol identifier, not a person. The human-readable title comes
   from the built manifest at request time, because anything naming the adopter
   is data and `config:check` fails the build if it appears in code (ADR 016). */
const SERVER_NAME = "show-your-work-portfolio";

const EVIDENCE_KINDS = ["about", "work", "blog", "experience"] as const;

type EvidenceDoc = {
  id: string;
  kind: string;
  title: string;
  url: string;
  text: string;
  skills: string[];
};

const json = (status: number, body: unknown, extra?: Record<string, string>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...CORS,
      ...(extra || {}),
    },
  });

const rpcResult = (id: unknown, result: unknown) => json(200, { jsonrpc: "2.0", id, result });
const rpcError = (id: unknown, code: number, message: string) =>
  json(200, { jsonrpc: "2.0", id: id === undefined ? null : id, error: { code, message } });

const TOOLS = [
  {
    name: "list_pages",
    title: "List published pages",
    description:
      "List every published page in this portfolio — projects, posts, and the about page — with id, kind, title, canonical URL and skills. Optionally filter by kind.",
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: [...EVIDENCE_KINDS], description: "Optional filter by page kind." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_page",
    title: "Get one page",
    description: 'Fetch one published page by evidence id (for example "work:my-project") — full text, canonical URL and skills.',
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
      "Deterministically map a job description's requirements to published evidence. Every aligned or partial claim cites canonical page URLs, and nothing is model-generated — the matcher can only quote text that is already on the site.",
    inputSchema: {
      type: "object",
      properties: {
        job_description: { type: "string", description: `Job description text (max ${MAX_JD} chars).` },
      },
      required: ["job_description"],
      additionalProperties: false,
    },
  },
];

async function loadDocs(request: Request): Promise<EvidenceDoc[]> {
  const res = await fetch(new URL("/evidence.json", request.url));
  if (!res.ok) throw new Error("evidence_unavailable");
  const pack = (await res.json()) as { version?: number; docs?: EvidenceDoc[] };
  if (!pack || pack.version !== 1 || !Array.isArray(pack.docs)) throw new Error("evidence_unavailable");
  return pack.docs;
}

/* Same tenant config the browser and /api/fit use, so all three paths return
   the same brief. A missing config falls back to engine defaults rather than
   failing the call. */
async function loadFitConfig(request: Request): Promise<unknown> {
  try {
    const res = await fetch(new URL("/fit-config.json", request.url));
    return res.ok ? await res.json() : undefined;
  } catch {
    return undefined;
  }
}

async function siteTitle(request: Request): Promise<string> {
  try {
    const res = await fetch(new URL("/manifest.json", request.url));
    if (!res.ok) return SERVER_NAME;
    const manifest = (await res.json()) as { name?: string };
    return manifest.name || SERVER_NAME;
  } catch {
    return SERVER_NAME;
  }
}

const asText = (value: unknown) => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
const toolError = (message: string) => ({ content: [{ type: "text", text: message }], isError: true });

async function callTool(name: string, args: Record<string, unknown>, request: Request) {
  if (name === "list_pages") {
    const kind = args.kind as string | undefined;
    if (kind !== undefined && !EVIDENCE_KINDS.includes(kind as (typeof EVIDENCE_KINDS)[number])) {
      return toolError(`kind must be one of ${EVIDENCE_KINDS.map((k) => `"${k}"`).join(", ")}.`);
    }
    const docs = await loadDocs(request);
    const pages = docs
      .filter((d) => !kind || d.kind === kind)
      .map(({ id, kind: k, title, url, skills }) => ({ id, kind: k, title, url, skills }));
    return asText({ total: pages.length, pages });
  }

  if (name === "get_page") {
    const docs = await loadDocs(request);
    const doc = docs.find((d) => d.id === args.id);
    return doc ? asText(doc) : toolError(`No page with id ${JSON.stringify(args.id)} — call list_pages for valid ids.`);
  }

  if (name === "fit_brief") {
    const jd = String(args.job_description || "").trim();
    if (!jd) return toolError("job_description is required.");
    if (jd.length > MAX_JD) return toolError(`job_description too large (max ${MAX_JD} chars).`);
    const [docs, cfg] = await Promise.all([loadDocs(request), loadFitConfig(request)]);
    const { matchFit } = await import("../_lib/fit-engine.js");
    return asText(matchFit(jd, docs, cfg));
  }

  return null;
}

export const onRequestOptions = async () => new Response(null, { status: 204, headers: CORS });

/* Stateless single-response mode only — there is no SSE stream to offer. */
export const onRequestGet = async () =>
  json(
    405,
    {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32000, message: "GET not supported — POST a single JSON-RPC message (stateless Streamable HTTP)." },
    },
    { allow: "POST, OPTIONS" },
  );

export const onRequestPost: PagesFunction = async ({ request }) => {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return rpcError(null, -32600, "Request too large.");

  let msg: { jsonrpc?: string; method?: string; id?: unknown; params?: Record<string, unknown> };
  try {
    msg = JSON.parse(raw);
  } catch {
    return rpcError(null, -32700, "Parse error.");
  }
  if (Array.isArray(msg)) return rpcError(null, -32600, "JSON-RPC batching is not supported.");
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return rpcError(msg && msg.id, -32600, "Invalid request.");
  }

  /* A notification has no id member at all. `id: null` is discouraged but
     valid, and still expects a response — so only a truly absent id is a
     notification. */
  if (msg.id === undefined) return new Response(null, { status: 202, headers: CORS });

  const { id, method } = msg;
  const params = msg.params || {};
  try {
    if (method === "initialize") {
      const requested = params.protocolVersion as string | undefined;
      return rpcResult(id, {
        protocolVersion: requested && PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, title: await siteTitle(request), version: "1.0.0" },
        instructions:
          "Read-only portfolio server. list_pages enumerates published projects, posts and the about page; " +
          "get_page returns one page's full text; fit_brief deterministically scores a job description against " +
          "published evidence and returns a brief where every aligned claim cites a canonical URL. All data is public.",
      });
    }
    if (method === "ping") return rpcResult(id, {});
    if (method === "tools/list") return rpcResult(id, { tools: TOOLS });
    if (method === "tools/call") {
      if (typeof params.name !== "string") return rpcError(id, -32602, "params.name is required.");
      const result = await callTool(params.name, (params.arguments as Record<string, unknown>) || {}, request);
      return result ? rpcResult(id, result) : rpcError(id, -32602, `Unknown tool: ${params.name}`);
    }
    return rpcError(id, -32601, `Method not found: ${method}`);
  } catch (err) {
    const message = err instanceof Error && err.message === "evidence_unavailable" ? "Evidence pack unavailable." : "Internal error.";
    return rpcError(id, -32603, message);
  }
};
