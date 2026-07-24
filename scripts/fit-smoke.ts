/**
 * Fit smoke tests against the demo corpus.
 * - CI/CD JD must cite Harbor Gate and produce ≥1 aligned with citation
 * - Kubernetes must NOT be aligned
 * - Empty / nonsense JD must not invent aligned claims
 * - Tenant fit-config loads (extraStops / weights / extraCaveats)
 * - The browser's evidence pack and the Worker's dist/evidence.json agree
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEvidencePack } from "../src/fit/evidence";
import { matchFit } from "../src/fit/match";
import type { FitMatchConfig } from "../src/fit/config";
import type { EvidenceDoc } from "../src/types";
import { BLOG, SITE_CONFIG, SITE_PROFILE, WORK } from "../src/generated/content";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadJson<T>(...parts: string[]): T {
  return JSON.parse(readFileSync(join(root, ...parts), "utf8")) as T;
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

/* The browser builds its pack from the generated module; /api/fit fetches
   dist/evidence.json, built independently by scripts/emit-evidence.py. Two
   implementations of one contract, so compare them directly — otherwise the
   two Fit paths can quietly answer differently for the same JD. */
const docs = buildEvidencePack(SITE_PROFILE, WORK, BLOG);
const workerPack = loadJson<{ docs: EvidenceDoc[] }>("dist", "evidence.json");

assert(
  workerPack.docs.length === docs.length,
  `evidence drift: browser pack has ${docs.length} docs, dist/evidence.json has ${workerPack.docs.length}`,
);
for (const mine of docs) {
  const theirs = workerPack.docs.find((d) => d.id === mine.id);
  assert(theirs, `evidence drift: dist/evidence.json is missing ${mine.id}`);
  for (const field of ["title", "url", "text"] as const) {
    assert(
      theirs[field] === mine[field],
      `evidence drift on ${mine.id}.${field}:\n  browser: ${JSON.stringify(mine[field]).slice(0, 160)}\n  worker:  ${JSON.stringify(theirs[field]).slice(0, 160)}`,
    );
  }
  assert(
    JSON.stringify(theirs.claims || []) === JSON.stringify(mine.claims || []),
    `evidence drift on ${mine.id}.claims`,
  );
  assert(
    JSON.stringify(theirs.skillNotes || {}) === JSON.stringify(mine.skillNotes || {}),
    `evidence drift on ${mine.id}.skillNotes`,
  );
}

/* Structured outcome/evidence exist and reach the pack as quotable claims. */
const claimDocs = docs.filter((d) => (d.claims || []).length);
if (SITE_CONFIG.demo) {
  // The shipped demo corpus must exercise the editorial contract, or the
  // template stops demonstrating the thing it is trying to teach.
  assert(
    claimDocs.length >= 1,
    "no work item contributed claims — the editorial contract (outcome/evidence) is not reaching the evidence pack",
  );
} else if (!claimDocs.length) {
  // Optional for an adopter, but it is the difference between Fit citing a
  // whole statement and Fit citing a fragment. Worth saying out loud.
  console.warn(
    "fit-smoke: no work item defines outcome/evidence — Fit will quote text " +
      "fragments instead of authored claims. See content/work/*.yaml.",
  );
}

function loadFitConfig(): FitMatchConfig {
  return loadJson<FitMatchConfig>("dist", "fit-config.json");
}
const fitCfg = loadFitConfig();
assert(Array.isArray(fitCfg.extraStops), "fit-config must include extraStops");
assert(
  fitCfg.extraStops!.length > 0,
  "fit-config should stop the site owner's name tokens (tenant data, not core)",
);

/*
 * Two tiers of assertion, and the split matters for adopters.
 *
 * ENGINE invariants hold for ANY corpus and always run: cite-or-missing,
 * nonsense produces nothing aligned, caveats come from config, the two
 * evidence packs agree.
 *
 * DEMO expectations ("a CI/CD JD must cite Harbor Gate") are about THIS
 * repo's fictional corpus. On an adopter's own content they are meaningless
 * and fail, which would mean a correctly-initialized site cannot pass
 * `npm test` — the same trap the fictional-corpus gate had.
 */
const cicdJd = `
Senior Platform Engineer

Requirements
- Experience building CI/CD pipelines with GitHub Actions
- Deploy static sites to Cloudflare Pages
- Strong TypeScript skills

Nice to have
- Kubernetes cluster operations
`;

const cicd = matchFit(cicdJd, docs, fitCfg);
const cicdAligned = cicd.requirements.filter((r) => r.status === "aligned");
for (const r of cicdAligned) {
  assert(r.evidence.length >= 1, `aligned requires citation: ${r.text}`);
}

let citesHarbor = false;
if (SITE_CONFIG.demo) {
  assert(cicdAligned.length >= 1, "CI/CD JD should produce ≥1 aligned requirement");
  citesHarbor = cicd.requirements.some(
    (r) =>
      (r.status === "aligned" || r.status === "partial") &&
      r.evidence.some((e) => /harbor gate/i.test(e.title) || /harbor-gate/i.test(e.url)),
  );
  assert(citesHarbor, "CI/CD JD must cite Harbor Gate");
}

const k8sJd = `
Platform Engineer

Requirements
- Deep Kubernetes experience running production clusters
- Helm chart authoring and operators
`;

const k8s = matchFit(k8sJd, docs, fitCfg);
const k8sAligned = k8s.requirements.filter((r) => r.status === "aligned");
if (SITE_CONFIG.demo) {
  assert(k8sAligned.length === 0, "Kubernetes must not be aligned on demo corpus");
}
for (const r of k8s.requirements) {
  assert(
    r.status !== "aligned" || r.evidence.length >= 1,
    "cite-or-missing: aligned without evidence",
  );
}

// Negative: empty / garbage must not invent aligned claims
const empty = matchFit("", docs, fitCfg);
assert(empty.requirements.every((r) => r.status !== "aligned"), "empty JD must not align");

const nonsense = matchFit(
  `
Unicorn Wrangler

Requirements
- Telepathy with distributed consensus pigeons
- Underwater Kubernetes on Mars
`,
  docs,
  fitCfg,
);
const nonsenseAligned = nonsense.requirements.filter((r) => r.status === "aligned");
assert(nonsenseAligned.length === 0, "nonsense JD must not produce aligned");
assert(nonsense.gaps.length >= 1 || nonsense.requirements.some((r) => r.status !== "aligned"), "nonsense should surface gaps");

// Caveats must be tenant data, not engine constants. An adopter who never
// touches fit.yaml still gets a clean brief; the demo disclaimer only appears
// because THIS repo's fit.yaml asks for it. Regression guard for the bug where
// "Demo corpus is fictional (Avery Quill)" was hardcoded in src/fit/match.ts
// and therefore shipped in every adopter's recruiter-facing brief.
const bare = matchFit("Platform engineer with CI/CD experience.", docs);
assert(bare.caveats.length === 2, `engine must emit exactly 2 caveats, got ${bare.caveats.length}`);
assert(
  !bare.caveats.some((c) => /fictional|avery|quill|demo/i.test(c)),
  "engine caveats must not mention the demo corpus",
);
const tenant = matchFit("Platform engineer with CI/CD experience.", docs, fitCfg);
assert(
  tenant.caveats.length === 2 + (fitCfg.extraCaveats || []).length,
  "tenant caveats must be the engine pair plus fit.yaml extraCaveats",
);

console.log("fit-smoke OK");
console.log(`  CI/CD aligned=${cicdAligned.length} harbor-cited=${citesHarbor}`);
console.log(`  K8s aligned=${k8sAligned.length} (expected 0)`);
console.log(`  nonsense aligned=${nonsenseAligned.length} (expected 0)`);
console.log(`  fit-config extraStops=${(fitCfg.extraStops || []).join(",")}`);
