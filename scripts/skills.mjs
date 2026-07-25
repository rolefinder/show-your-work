/**
 * `npm run skills` — show the skill vocabulary actually in use.
 *
 * Platform review U5: skills are free text with no way to see what already
 * exists while authoring, which is how `TypeScript` becomes `Typescript`. This
 * makes the taxonomy visible at the moment you are about to add to it.
 *
 * Reads content/ directly rather than the generated module, so it works before
 * a build and reflects what you just typed.
 *
 * Usage: node scripts/skills.mjs [--help]
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?/, ""));
  process.exit(0);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Minimal reader for `skills:` list items — avoids a Node YAML dependency. */
function skillsIn(text) {
  const m = text.match(/^skills:\s*\n((?:\s*-\s*.+\n?)+)/m);
  if (!m) return [];
  return m[1]
    .split("\n")
    .map((l) => l.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean);
}

const counts = new Map();
const where = new Map();
for (const kind of ["work", "blog"]) {
  const dir = join(root, "content", kind);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".yaml"))) {
    for (const s of skillsIn(readFileSync(join(dir, f), "utf8"))) {
      counts.set(s, (counts.get(s) || 0) + 1);
      where.set(s, [...(where.get(s) || []), `${kind}/${f}`]);
    }
  }
}
// Same vocabulary: profile skills render on /about and become the `about`
// doc's skills in the Fit evidence pack.
const profile = join(root, "content", "about", "profile.yaml");
if (existsSync(profile)) {
  for (const s of skillsIn(readFileSync(profile, "utf8"))) {
    counts.set(s, (counts.get(s) || 0) + 1);
    where.set(s, [...(where.get(s) || []), "about/profile.yaml"]);
  }
}

if (!counts.size) {
  console.log("skills: none found in content/work or content/blog");
  process.exit(0);
}

const mapped = new Set();
const cfg = join(root, "content", "config", "skills.yaml");
if (existsSync(cfg)) {
  for (const line of readFileSync(cfg, "utf8").split("\n")) {
    const m = line.match(/^\s{2}(.+?):\s*\S/);
    if (m) mapped.add(m[1].trim());
  }
}

const width = Math.max(...[...counts.keys()].map((s) => s.length));
console.log(`skills: ${counts.size} in use\n`);
for (const [label, n] of [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
  const flag = mapped.has(label) ? "" : "  (uncategorised)";
  console.log(`  ${label.padEnd(width)}  ${String(n).padStart(2)}${flag}`);
}

// Same normalisation check-content blocks on, surfaced here as a nudge.
const buckets = new Map();
for (const label of counts.keys()) {
  const key = label.toLowerCase().replace(/[^a-z0-9]/g, "");
  buckets.set(key, [...(buckets.get(key) || []), label]);
}
const dupes = [...buckets.values()].filter((v) => v.length > 1);
if (dupes.length) {
  console.log("\nnear-duplicates (check-content will block on these):");
  for (const v of dupes) console.log(`  ${v.join("  vs  ")}`);
}
