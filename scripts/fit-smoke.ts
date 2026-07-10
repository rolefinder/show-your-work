/**
 * Fit smoke tests against Avery Quill demo corpus.
 * - CI/CD JD must cite Harbor Gate and produce ≥1 aligned with citation
 * - Kubernetes must NOT be aligned
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEvidencePack } from "../src/fit/evidence";
import { matchFit } from "../src/fit/match";
import type { BlogPost, SiteProfile, WorkItem } from "../src/types";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadYamlishFromApp(): { profile: SiteProfile; work: WorkItem[]; blog: BlogPost[] } {
  // Prefer evidence.json from build; fall back to reconstructing from emit markers is heavy —
  // use the TypeScript constants via a tiny inline pack from evidence.json.
  const evidencePath = join(root, "dist", "evidence.json");
  const pack = JSON.parse(readFileSync(evidencePath, "utf8")) as {
    docs: Array<{ id: string; kind: string; title: string; url: string; text: string; skills: string[] }>;
  };

  const about = pack.docs.find((d) => d.kind === "about");
  const profile: SiteProfile = {
    name: "Avery Quill",
    tagline: about?.text.slice(0, 80) || "",
    location: "demo",
    email: "avery.quill@example.com",
    summary: about?.text || "",
    skills: about?.skills || [],
  };

  const work: WorkItem[] = pack.docs
    .filter((d) => d.kind === "work")
    .map((d) => ({
      slug: d.id.replace(/^work:/, ""),
      title: d.title,
      summary: d.text.slice(0, 160),
      body: d.text,
      skills: d.skills,
      visible: true,
    }));

  const blog: BlogPost[] = pack.docs
    .filter((d) => d.kind === "blog")
    .map((d) => ({
      slug: d.id.replace(/^blog:/, ""),
      title: d.title,
      summary: d.text.slice(0, 160),
      body: d.text,
      skills: d.skills,
      visible: true,
    }));

  return { profile, work, blog };
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const { profile, work, blog } = loadYamlishFromApp();
const docs = buildEvidencePack(profile, work, blog);

const cicdJd = `
Senior Platform Engineer

Requirements
- Experience building CI/CD pipelines with GitHub Actions
- Deploy static sites to Cloudflare Pages
- Strong TypeScript skills

Nice to have
- Kubernetes cluster operations
`;

const cicd = matchFit(cicdJd, docs);
const cicdAligned = cicd.requirements.filter((r) => r.status === "aligned");
assert(cicdAligned.length >= 1, "CI/CD JD should produce ≥1 aligned requirement");
for (const r of cicdAligned) {
  assert(r.evidence.length >= 1, `aligned requires citation: ${r.text}`);
}
const citesHarbor = cicd.requirements.some(
  (r) =>
    (r.status === "aligned" || r.status === "partial") &&
    r.evidence.some((e) => /harbor gate/i.test(e.title) || /harbor-gate/i.test(e.url)),
);
assert(citesHarbor, "CI/CD JD must cite Harbor Gate");

const k8sJd = `
Platform Engineer

Requirements
- Deep Kubernetes experience running production clusters
- Helm chart authoring and operators
`;

const k8s = matchFit(k8sJd, docs);
const k8sAligned = k8s.requirements.filter((r) => r.status === "aligned");
assert(k8sAligned.length === 0, "Kubernetes must not be aligned on demo corpus");

console.log("fit-smoke OK");
console.log(`  CI/CD aligned=${cicdAligned.length} harbor-cited=${citesHarbor}`);
console.log(`  K8s aligned=${k8sAligned.length} (expected 0)`);
