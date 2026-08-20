/**
 * `bun run docs:check` — the documentation's numbers must match the source.
 *
 * ARCHITECTURE.md and README.md quote specific values: Fit's scoring weights
 * and thresholds, the search ranking table, input caps, the quota. Those were
 * verified by hand once. A doc that quietly drifts from the code is worse than
 * one that says nothing, because it is trusted.
 *
 * Each rule reads the CURRENT value out of source and asserts the doc still
 * states it. Change a weight and this fails until the prose is updated.
 *
 * Usage: node scripts/check-doc-drift.mjs [--help]
 * Exit 0 = in sync | 1 = drift.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?/, ""));
  process.exit(0);
}

const read = (...p) => readFileSync(join(root, ...p), "utf8");
// Docs wrap, so compare against a whitespace-flattened copy. An earlier
// hand-check produced a false positive purely because a phrase spanned a line.
const flat = (s) => s.replace(/\s+/g, " ");

const docs = flat(read("ARCHITECTURE.md") + "\n" + read("README.md"));
const cfg = read("src", "fit", "config.ts");
const search = read("src", "search", "searchGraph.ts");
const fitPage = read("src", "fit", "FitPage.tsx");
const api = read("functions", "api", "fit.ts");

const num = (src, key) => (src.match(new RegExp(`${key}:\\s*(\\d+)`)) || [])[1];

/** [label, value from source, phrase the docs must contain] */
const RULES = [
  ["fit skill weight", num(cfg, "skill"), (v) => `skill-tag match is worth ${v}`],
  ["fit title weight", num(cfg, "title"), (v) => `a title match ${v}`],
  ["fit corpus weight", num(cfg, "corpus"), (v) => `a body match ${v}`],
  ["fit minHit", num(cfg, "minHit"), (v) => `\`minHit\` ${v}`],
  ["fit partialMin", num(cfg, "partialMin"), (v) => `\`partialMin\` ${v}`],
  ["fit alignedMin", num(cfg, "alignedMin"), (v) => `\`alignedMin\` ${v}`],
  ["search title score", (search.match(/_title!\.includes\(term\)\) score \+= (\d+)/) || [])[1], (v) => `title ${v}`],
  ["search index score", (search.match(/_index!\.includes\(term\)\) score \+= (\d+)/) || [])[1], (v) => `index ${v}`],
  ["search sub score", (search.match(/_sub!\.includes\(term\)\) score \+= (\d+)/) || [])[1], (v) => `sub ${v}`],
  ["search chips score", (search.match(/_chips!\.includes\(term\)\) score \+= (\d+)/) || [])[1], (v) => `chips ${v}`],
  ["search exact-title bonus", (search.match(/includes\(q\)\) score \+= (\d+)/) || [])[1], (v) => `exact title +${v}`],
  ["search connected cap", (search.match(/connected\.slice\(0, (\d+)\)/) || [])[1], (v) => `max ${v}`],
  ["fit char cap", (fitPage.match(/MAX_CHARS = (\d+)/) || [])[1], (v) => `${Number(v) / 1000}k character cap`],
  ["fit quota", (api.match(/used >= (\d+)/) || [])[1], () => "daily cap"],
];

const failures = [];
for (const [label, value, phrase] of RULES) {
  if (value === undefined) {
    failures.push(`${label}: could not read the value from source - this check has rotted, fix the extractor`);
    continue;
  }
  const expected = phrase(value);
  if (!docs.includes(expected)) {
    failures.push(`${label}: source says ${value}, but the docs never state "${expected}"`);
  }
}

if (failures.length) {
  console.error("check-doc-drift: FAILED");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`check-doc-drift: ok (${RULES.length} documented values match source)`);
