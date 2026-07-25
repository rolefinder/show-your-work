/**
 * `npm run docs:links` — every relative link and anchor in the docs resolves.
 *
 * A README that links to a moved ADR is a small thing that erodes trust in the
 * whole document. Checks relative file links and in-page `#anchor` targets;
 * external URLs are deliberately NOT fetched, so this needs no network and
 * can't fail because someone else's site is down.
 *
 * Usage: node scripts/check-doc-links.mjs [--help]
 * Exit 0 = all resolve | 1 = broken links.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?/, ""));
  process.exit(0);
}

/** Every tracked markdown file, minus dependencies and build output. */
function markdown(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", "dist", ".git", ".wrangler"].includes(entry.name)) continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) markdown(abs, out);
    else if (entry.name.endsWith(".md")) out.push(abs);
  }
  return out;
}

/** GitHub's heading -> anchor slug. */
const slug = (h) =>
  h
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

const failures = [];
let checked = 0;

for (const file of markdown(root)) {
  const rel = file.slice(root.length + 1).split("\\").join("/");
  const text = readFileSync(file, "utf8");
  const anchors = new Set((text.match(/^#{1,6} .+$/gm) || []).map((h) => slug(h.replace(/^#+ /, ""))));

  for (const m of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = m[1].trim();
    if (/^(https?:|mailto:|#!)/.test(target)) continue; // external: not our problem
    checked++;

    if (target.startsWith("#")) {
      if (!anchors.has(target.slice(1))) failures.push(`${rel}: anchor ${target} has no matching heading`);
      continue;
    }
    const [path, hash] = target.split("#");
    const abs = resolve(dirname(file), path);
    if (!existsSync(abs)) {
      failures.push(`${rel}: ${target} does not exist`);
      continue;
    }
    if (hash && abs.endsWith(".md") && statSync(abs).isFile()) {
      const targetAnchors = new Set(
        (readFileSync(abs, "utf8").match(/^#{1,6} .+$/gm) || []).map((h) => slug(h.replace(/^#+ /, ""))),
      );
      if (!targetAnchors.has(hash)) failures.push(`${rel}: ${target} - no such heading in the target file`);
    }
  }
}

if (failures.length) {
  console.error("check-doc-links: FAILED");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`check-doc-links: ok (${checked} relative links and anchors resolve)`);
