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
    const key = `day:${body.clientId || "anon"}:${new Date().toISOString().slice(0, 10)}`;
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

  const brief = matchFit(jd, pack.docs);
  return json(brief, 200);
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
