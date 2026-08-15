/**
 * POST /api/mcp — read-only Model Context Protocol endpoint.
 *
 * The site already publishes two machine-readable surfaces: llms.txt (an index
 * for answer engines) and evidence.json (the URL-cited corpus behind /fit).
 * Both are pull artifacts — an agent has to know to fetch and parse them. This
 * exposes the same corpus the way agents actually connect to things, so a
 * recruiter's assistant can enumerate, read and score the portfolio without
 * scraping it.
 *
 * Stateless Streamable HTTP in its simplest legal form: one JSON-RPC message
 * per POST, one JSON response. No sessions, no SSE, no server-initiated
 * messages, no batching.
 *
 * **No model runs here.** The tools are the same deterministic retrieval the
 * site uses — ADR 010's rule is that nothing in the matching path may
 * hallucinate, and an endpoint that summarized the corpus with an LLM would
 * break exactly the property that makes a Fit brief worth trusting. The
 * intelligence is the agent's; the honesty is ours. A job description is
 * untrusted input and only ever reaches the deterministic matcher.
 *
 * Zero metered resources: no KV, no secrets, no bindings, no outbound model
 * calls. The only cost surface is the Function invocation itself, so this
 * endpoint cannot run up a bill.
 *
 * GitHub Pages cannot run Functions at all, so on that target this file is
 * inert and the discovery manifest is not emitted — see docs/guide/deploy.md.
 * evidence.json stays static and public on both targets, which is the fallback
 * an agent can always use.
 */

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_BODY = 64 * 1024;
/** Matches MAX_CHARS in ./fit.ts — one JD limit for both entry points. */
const MAX_JD = 12000;

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

const KINDS = ["work", "blog", "about"] as const;

/* Public read-only data, so wildcard CORS is deliberate: the corpus IS the
   published site. There is no origin-gated state to protect and no session to
   rebind, which is what the spec's origin-validation guidance defends against.
   Browser-based agents can therefore connect directly. */
const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept, mcp-protocol-version, mcp-session-id",
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

const rpcResult = (id: unknown, result: unknown) => json(200, { jsonrpc: "2.0", id, result });
const rpcError = (id: unknown, code: number, message: string) =>
  json(200, { jsonrpc: "2.0", id: id === undefined ? null : id, error: { code, message } });

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

async function loadDocs(request: Request): Promise<EvidenceDoc[]> {
  const res = await fetch(new URL("/evidence.json", request.url).toString());
  if (!res.ok) throw new Error("evidence_unavailable");
  const pack = (await res.json()) as EvidencePack;
  if (!pack || pack.version !== 1 || !Array.isArray(pack.docs)) throw new Error("evidence_unavailable");
  return pack.docs;
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

async function callTool(name: string, args: Record<string, unknown>, request: Request) {
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
    const docs = await loadDocs(request);
    // Same bundled engine /api/fit uses, so both entry points answer a given
    // JD identically. Built by `npm run build:fit-worker` from src/fit/.
    const { matchFit } = await import("../_lib/fit-engine.js");
    return asText(matchFit(jd, docs));
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
      error: {
        code: -32000,
        message: "GET not supported — POST a single JSON-RPC message (stateless Streamable HTTP).",
      },
    },
    { allow: "POST, OPTIONS" },
  );

export const onRequestPost: PagesFunction = async ({ request }) => {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return rpcError(null, -32600, "Request too large.");

  let msg: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    msg = JSON.parse(raw);
  } catch {
    return rpcError(null, -32700, "Parse error.");
  }
  if (Array.isArray(msg)) return rpcError(null, -32600, "JSON-RPC batching is not supported.");
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return rpcError(msg && msg.id, -32600, "Invalid request.");
  }

  /* Notifications (no id member) get a bare 202 per Streamable HTTP. `id: null`
     is a discouraged-but-valid request id and still expects a response, so only
     a truly absent id is a notification. */
  if (msg.id === undefined) return new Response(null, { status: 202, headers: CORS });

  const { id, method } = msg;
  const params = msg.params || {};

  try {
    if (method === "initialize") {
      const asked = params.protocolVersion as string | undefined;
      return rpcResult(id, {
        protocolVersion:
          asked && PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: await serverInfo(request),
        instructions:
          "Read-only portfolio server. list_pages enumerates published projects, posts and the about page; " +
          "get_page returns one page's full text; fit_brief deterministically scores a job description against " +
          "published evidence and returns a brief where every aligned claim cites a canonical URL and quotes " +
          "text that already exists on that page. No model runs server-side, so nothing here is generated. " +
          "All data is public.",
      });
    }
    if (method === "ping") return rpcResult(id, {});
    if (method === "tools/list") return rpcResult(id, { tools: TOOLS });
    if (method === "tools/call") {
      if (typeof params.name !== "string") return rpcError(id, -32602, "params.name is required.");
      const result = await callTool(
        params.name,
        (params.arguments as Record<string, unknown>) || {},
        request,
      );
      return result ? rpcResult(id, result) : rpcError(id, -32602, `Unknown tool: ${params.name}`);
    }
    return rpcError(id, -32601, `Method not found: ${method}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    return rpcError(
      id,
      -32603,
      message === "evidence_unavailable" ? "Evidence pack unavailable." : "Internal error.",
    );
  }
};

/* Identity comes from the corpus, never from a constant in this file —
   check-adopter-config.mjs fails the build on a name or origin hardcoded under
   functions/, and it is right to: this file ships to every fork. */
async function serverInfo(request: Request) {
  let name = "portfolio";
  try {
    const docs = await loadDocs(request);
    const about = docs.find((d) => d.kind === "about");
    if (about?.title) name = about.title.replace(/\s+—\s+About$/, "");
  } catch {
    /* Discovery should still answer if the corpus is briefly unavailable. */
  }
  return { name, title: `${name} — portfolio`, version: "1.0.0" };
}
