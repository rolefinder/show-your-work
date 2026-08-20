/**
 * The daily Fit budget, shared by every endpoint that can run the matcher.
 *
 * ONE READER. This exists because the rule was written twice and the second
 * writer forgot it: `/api/fit` charged 2/day per IP, and `/api/mcp` — added
 * later, exposing the same `fit_brief` computation — charged nothing. Anyone
 * who wanted unlimited briefs called the other endpoint. A limit with a second
 * unmetered door is not a limit.
 *
 * Both endpoints now share this module AND the same key, so the budget is per
 * caller rather than per endpoint. Adding a third surface that runs the matcher
 * means calling `charge()` from it.
 *
 * Directories under `functions/` that start with `_` are not routed, so this
 * never becomes an endpoint itself.
 */

export type QuotaEnv = {
  /** Optional. Unbound (local dev, GitHub Pages) means no metering. */
  FIT_QUOTA?: KVNamespace;
};

export const DAILY_LIMIT = 2;

/* Hashed so the namespace holds an opaque bucket rather than a record of who
   asked (ADR 012). */
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type QuotaVerdict = { allowed: boolean; remaining: number };

/**
 * Count one Fit run against the caller's daily budget.
 *
 * Keyed on the connecting IP, which the edge sets and the caller cannot — an
 * earlier version keyed on a client-supplied id, so a fresh random value per
 * request bought unlimited quota.
 *
 * Read-then-write is a race: two simultaneous requests can both see the same
 * count. Accepted for a soft cost control rather than an authorization
 * boundary — KV has no atomic increment, and a Durable Object is not worth it
 * for a portfolio. Say so here rather than let a reader assume it is exact.
 */
export async function charge(request: Request, env: QuotaEnv): Promise<QuotaVerdict> {
  if (!env.FIT_QUOTA) return { allowed: true, remaining: DAILY_LIMIT };

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const day = new Date().toISOString().slice(0, 10);
  const key = `day:${await sha256(ip)}:${day}`;

  const used = Number((await env.FIT_QUOTA.get(key)) || "0");
  if (used >= DAILY_LIMIT) return { allowed: false, remaining: 0 };

  await env.FIT_QUOTA.put(key, String(used + 1), { expirationTtl: 60 * 60 * 48 });
  return { allowed: true, remaining: DAILY_LIMIT - used - 1 };
}
