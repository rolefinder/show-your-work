/**
 * Optional Pages Function: POST /api/fit
 * Deterministic matcher over dist/evidence.json. KV FIT_QUOTA stub (2/day).
 * Placeholders only — no real account IDs.
 */
type Env = {
  FIT_QUOTA?: KVNamespace;
};

type EvidencePack = {
  version: number;
  docs: Array<{
    id: string;
    kind: string;
    title: string;
    url: string;
    text: string;
    skills: string[];
  }>;
};

const MAX_CHARS = 12000;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  let body: { jd?: string; clientId?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const jd = String(body.jd || "").trim();
  if (!jd) return json({ error: "empty_jd" }, 400);
  if (jd.length > MAX_CHARS) return json({ error: "jd_too_large" }, 413);

  if (env.FIT_QUOTA) {
    /*
     * Keyed on the connecting IP, which the edge sets and the caller cannot.
     * This used to key on body.clientId — a value the caller supplies — so a
     * fresh random id per request bought unlimited quota, and an id containing
     * ":" could construct another client's key. clientId is now ignored for
     * accounting; it stays in the request shape only so existing callers do
     * not break.
     *
     * Read-then-write is a race: two simultaneous requests can both see the
     * same count. Accepted for a 2/day soft limit whose job is cost control,
     * not authorization — KV offers no atomic increment, and a Durable Object
     * is not worth it here (ADR 011).
     */
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const key = `day:${await sha256(ip)}:${new Date().toISOString().slice(0, 10)}`;
    const used = Number((await env.FIT_QUOTA.get(key)) || "0");
    if (used >= 2) return json({ error: "quota_exceeded", remaining: 0 }, 429);
    await env.FIT_QUOTA.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 });
  }

  // Dynamic import of bundled engine (built by npm run build:fit-worker)
  const { matchFit } = await import("../_lib/fit-engine.js");
  const packUrl = new URL("/evidence.json", request.url);
  const packRes = await fetch(packUrl);
  if (!packRes.ok) return json({ error: "evidence_unavailable" }, 503);
  const pack = (await packRes.json()) as EvidencePack;

  // Same tenant config the browser path uses, so /api/fit and the offline
  // matcher return identical briefs. Absent config falls back to engine
  // defaults rather than failing the request.
  let cfg: unknown;
  try {
    const cfgRes = await fetch(new URL("/fit-config.json", request.url));
    if (cfgRes.ok) cfg = await cfgRes.json();
  } catch {
    cfg = undefined;
  }

  const brief = matchFit(jd, pack.docs, cfg);
  return json(brief, 200);
};

/* Hashed so the quota namespace never stores a raw IP — the key is an opaque
   bucket, not a record of who asked (ADR 012). */
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
