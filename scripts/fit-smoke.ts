/**
 * Fit smoke tests against the demo corpus.
 * - CI/CD JD must cite the merge-gate project and produce ≥1 aligned with citation
 * - Kubernetes must NOT be aligned
 * - A bare skill label must never carry `aligned` (F1)
 * - Education cites through achievements, never through the credential name (F3)
 * - Courses and certifications never enter the pack, and never publish an
 *   unevidenced skill (the evidence gate)
 * - Empty / nonsense JD must not invent aligned claims
 * - Tenant fit-config loads (extraStops / weights / extraCaveats)
 * - The browser's evidence pack and the Worker's dist/evidence.json agree
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEvidencePack } from "../src/fit/evidence";
import { retrieveEvidence } from "../src/fit/index";
import { matchFit } from "../src/fit/match";
import type { FitMatchConfig } from "../src/fit/config";
import type { EvidenceDoc } from "../src/types";
import {
  BLOG,
  CERTIFICATIONS,
  COURSES,
  EDUCATION,
  EXPERIENCE,
  SITE_CONFIG,
  SITE_PROFILE,
  WORK,
} from "../src/generated/content";

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
const docs = buildEvidencePack(SITE_PROFILE, WORK, BLOG, EXPERIENCE, EDUCATION);
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
  /* Absent and empty are DIFFERENT here — absent means the title matches,
     empty means it deliberately does not — so they are compared through a
     sentinel rather than coalesced. Coalescing would let one implementation
     forget `titleText` on an education doc and still pass, which is the exact
     drift this loop exists to catch. */
  const titleText = (d: EvidenceDoc) => (d.titleText === undefined ? "<absent>" : d.titleText);
  assert(
    titleText(theirs) === titleText(mine),
    `evidence drift on ${mine.id}.titleText: browser ${titleText(mine)}, worker ${titleText(theirs)}`,
  );
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
 * DEMO expectations ("a CI/CD JD must cite the merge-gate project") are about THIS
 * repo's fictional corpus. On an adopter's own content they are meaningless
 * and fail, which would mean a correctly-initialized site cannot pass
 * `bun run test` — the same trap the fictional-corpus gate had.
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

/*
 * F1: a bare skill label is not a citation.
 *
 * `bun run init` scaffolds `skill_notes: {}`, so the default new-adopter state
 * is a corpus whose skills carry no authored sentence. Such a row must land
 * `partial`, not `aligned`: the skill is genuinely tagged, and nothing
 * published says anything about it.
 *
 * Built through buildEvidencePack rather than by hand, deliberately. A
 * hand-written EvidenceDoc can omit things the real builder always does, and
 * the first version of this check did exactly that — it left skills out of
 * `text`, so it passed while production still returned `aligned` by quoting
 * the skill list back through snippetAround. Test the shape that ships.
 */
const bareWork = [
  {
    slug: "bare-label",
    title: "Untitled",
    summary: "A short summary about unrelated matters.",
    body: "Nothing here mentions those skills by name.",
    skills: ["TypeScript", "Kubernetes"],
    skillNotes: {},
    visible: true,
  },
] as unknown as typeof WORK;
const bareDocs = buildEvidencePack(
  { ...SITE_PROFILE, skills: [], summary: "", tagline: "" },
  bareWork,
  [],
  [],
);
for (const d of bareDocs) {
  for (const skill of d.skills) {
    assert(
      !d.text.toLowerCase().includes(skill.toLowerCase()),
      `skills must stay out of doc.text, or a skill match manufactures a snippet citation: ${d.id} / ${skill}`,
    );
  }
}
const bareLabel = matchFit(
  "Requirements:\n- Strong TypeScript and Kubernetes experience\n",
  bareDocs,
  { ...fitCfg, showGaps: true },
);
for (const r of bareLabel.requirements) {
  assert(
    r.status !== "aligned",
    `a bare skill label must not carry aligned: ${r.text}`,
  );
}
assert(
  bareLabel.requirements.some((r) => r.status === "partial"),
  "a tagged-but-unevidenced skill should still reach partial",
);

/*
 * The other half of the same contract, and it has to be gated too: the
 * authoring guide tells people that writing a `skill_notes` entry is what
 * turns a bare tag into an aligned claim. If that stops being true the guide
 * is lying, and nothing else would notice.
 *
 * The note deliberately does NOT repeat the requirement's wording — an
 * authored sentence about a skill is evidence for it whether or not it says
 * the word again, and scoring it any other way would reward keyword echo.
 */
const notedWork = [
  {
    ...(bareWork[0] as unknown as Record<string, unknown>),
    slug: "noted",
    skills: ["TypeScript"],
    skillNotes: {
      TypeScript: "Every content shape is a compile error before it is a runtime blank.",
    },
  },
] as unknown as typeof WORK;
const noted = matchFit(
  "Requirements:\n- Strong TypeScript experience\n",
  buildEvidencePack({ ...SITE_PROFILE, skills: [], summary: "", tagline: "" }, notedWork, [], []),
  { ...fitCfg, showGaps: true },
);
assert(
  noted.requirements.some((r) => r.status === "aligned"),
  "a skill backed by an authored skill_notes entry must reach aligned",
);

/*
 * F3: education is citable through its achievements, and ONLY through them.
 *
 * Both directions are gated because the two failure modes are opposite. If the
 * credential became matchable, "BS, Information Systems" would answer a third
 * of the postings in the industry on title weight alone — the collision ADR 027
 * refused education over, arriving through the back door. If the achievements
 * were not matchable, a capstone that is structurally a work `evidence` bullet
 * stays uncitable, which is the defect itself.
 */
const eduDocs = buildEvidencePack(
  { ...SITE_PROFILE, skills: [], summary: "", tagline: "" },
  [],
  [],
  [],
  [
    {
      slug: "degree",
      institution: "Fictional Institute of Technology",
      credential: "BS, Fictional Information Systems",
      date: "2022",
      achievements: ["Capstone shipped a schema migration the department kept running."],
      visible: true,
    },
  ] as unknown as typeof EDUCATION,
);
const eduDoc = eduDocs.find((d) => d.kind === "education");
assert(eduDoc, "education must reach the evidence pack (F3)");
assert(eduDoc!.titleText === "", "an education doc's title must not be matchable");
for (const term of ["information systems", "technology", "fictional"]) {
  assert(
    !eduDoc!.text.toLowerCase().includes(term),
    `credential and institution must stay out of an education doc's text: found ${term}`,
  );
}
assert(
  retrieveEvidence("Bachelor of Science in Information Systems", eduDocs, fitCfg).length === 0,
  "a degree name must not retrieve its own education doc (ADR 027's collision)",
);
const eduHit = retrieveEvidence("schema migration", eduDocs, fitCfg);
assert(eduHit.length === 1 && eduHit[0].quote_kind === "claim", "an achievement must cite as a whole claim");

/*
 * The evidence gate, asserted rather than assumed — both halves.
 *
 * SAFETY: no citation may ever resolve to a syllabus or a credential. That is
 * what makes ADR 027's collision hazard structurally impossible for these two
 * corpora rather than merely mitigated: they are not documents in the pack, so
 * there is nothing to collide with. Only a change to buildEvidencePack could
 * break it, and nothing else would notice.
 *
 * LIVENESS: every skill a course or credential publishes is claimed by one of
 * its own linked projects. packages/content/emit_site.py derives that subset at
 * emit time; this checks the derivation against the generated module, so an
 * emitter regression cannot quietly start publishing the ungated `taught:`
 * list. Checked here rather than in check-content.py because that gate reads
 * YAML before the build and this is a fact about what the build produced.
 */
for (const doc of docs) {
  assert(
    doc.kind !== "courses" && doc.kind !== "certifications" && !/^(course|certification):/.test(doc.id),
    `a course or credential must never become a citable document: ${doc.id}`,
  );
}
for (const [label, items] of [["course", COURSES], ["certification", CERTIFICATIONS]] as const) {
  for (const item of items) {
    const evidenced = new Set(
      item.projects
        .flatMap((slug) => WORK.find((w) => w.slug === slug && w.visible !== false)?.skills || [])
        .map((s) => s.toLowerCase()),
    );
    for (const skill of item.skills) {
      assert(
        evidenced.has(skill.toLowerCase()),
        `${label} ${item.slug} publishes ${JSON.stringify(skill)}, which none of its linked projects claims — ` +
          "the evidence gate in packages/content/emit_site.py is not holding",
      );
    }
  }
}

let citesMergeGate = false;
if (SITE_CONFIG.demo) {
  assert(cicdAligned.length >= 1, "CI/CD JD should produce ≥1 aligned requirement");
  citesMergeGate = cicd.requirements.some(
    (r) =>
      (r.status === "aligned" || r.status === "partial") &&
      r.evidence.some((e) => /merge.gate/i.test(e.title) || /merge-gate/i.test(e.url)),
  );
  assert(citesMergeGate, "CI/CD JD must cite the merge-gate project");
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

const NONSENSE_JD = `
Unicorn Wrangler

Requirements
- Telepathy with distributed consensus pigeons
- Underwater Kubernetes on Mars
`;
const nonsense = matchFit(NONSENSE_JD, docs, fitCfg);
const nonsenseAligned = nonsense.requirements.filter((r) => r.status === "aligned");
assert(nonsenseAligned.length === 0, "nonsense JD must not produce aligned");
/* In highlight mode a nonsense JD yields an EMPTY brief - nothing matched, so
   nothing is shown. The gap reporting moved with the mode, so assert it where
   it now lives rather than deleting the check. */
assert(nonsense.requirements.length === 0, "nonsense JD should surface nothing in highlight mode");
const nonsenseAudit = matchFit(NONSENSE_JD, docs, { ...fitCfg, showGaps: true });
assert(nonsenseAudit.gaps.length >= 1, "audit mode should still surface gaps for a nonsense JD");

// Caveats must be tenant data, not engine constants. An adopter who never
// touches fit.yaml still gets a clean brief; the demo disclaimer only appears
// because THIS repo's fit.yaml asks for it. Regression guard for the bug where
// "Demo corpus is fictional (<persona>)" was hardcoded in src/fit/match.ts
// and therefore shipped in every adopter's recruiter-facing brief.
const bare = matchFit("Platform engineer with CI/CD experience.", docs);
assert(bare.caveats.length === 2, `engine must emit exactly 2 caveats, got ${bare.caveats.length}`);
assert(
  !bare.caveats.some((c) => /fictional|placeholder|fake|demo/i.test(c)),
  "engine caveats must not mention the demo corpus",
);
const tenant = matchFit("Platform engineer with CI/CD experience.", docs, fitCfg);
assert(
  tenant.caveats.length === 2 + (fitCfg.extraCaveats || []).length,
  "tenant caveats must be the engine pair plus fit.yaml extraCaveats",
);

/*
 * Surface mode. The matcher evaluates every requirement either way; showGaps
 * decides what the brief returns. Highlight mode (the default) must never leak
 * a dequalifying verdict, and audit mode must still be able to produce one --
 * so the honest path stays available rather than being deleted.
 */
const gapJd = `Senior Platform Engineer

Requirements
- Experience building CI/CD pipelines with GitHub Actions
- Rust systems programming for embedded devices
`;

const highlight = matchFit(gapJd, docs, { ...fitCfg, showGaps: false });
assert(
  highlight.requirements.every((r) => r.status === "aligned" || r.status === "partial"),
  `highlight mode leaked a dequalifying status: ${highlight.requirements.map((r) => r.status).join(", ")}`,
);
assert(highlight.gaps.length === 0, "highlight mode must not return a gaps list");
assert(
  highlight.requirements.length >= 1,
  "highlight mode still has to show the requirements that DO match",
);
assert(
  highlight.caveats.some((c) => /not an exhaustive review/i.test(c)),
  "highlight mode must say the brief is not exhaustive - otherwise omitting rows reads as a full audit",
);

const audit = matchFit(gapJd, docs, { ...fitCfg, showGaps: true });
assert(
  audit.requirements.length > highlight.requirements.length,
  "audit mode should surface at least one requirement highlight mode hides",
);
assert(
  audit.requirements.some((r) => r.status === "not_evidenced_on_site" || r.status === "missing"),
  "audit mode must still report unevidenced requirements",
);
assert(audit.gaps.length >= 1, "audit mode must still return a gaps list");

console.log("fit-smoke OK");
console.log(`  CI/CD aligned=${cicdAligned.length} merge-gate-cited=${citesMergeGate}`);
console.log(`  K8s aligned=${k8sAligned.length} (expected 0)`);
console.log(`  nonsense aligned=${nonsenseAligned.length} (expected 0)`);
console.log(`  fit-config extraStops=${(fitCfg.extraStops || []).join(",")}`);
