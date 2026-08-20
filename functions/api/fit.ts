/**
 * Optional Pages Function: POST /api/fit
 * Deterministic matcher over dist/evidence.json. KV FIT_QUOTA stub (2/day).
 * Placeholders only — no real account IDs.
 */
import { charge, type QuotaEnv } from "../_shared/quota";

type Env = QuotaEnv;

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

  /* Shared with /api/mcp's fit_brief, same module and same key — the budget is
     per caller, not per endpoint. `clientId` is ignored for accounting; it
     stays in the request shape only so existing callers do not break. */
  const quota = await charge(request, env);
  if (!quota.allowed) return json({ error: "quota_exceeded", remaining: 0 }, 429);

  // Dynamic import of bundled engine (built by bun run build:fit-worker)
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

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
