/**
 * Adopter-config discipline gate.
 *
 * The promise of this template is that standing up your own site is an edit to
 * content/ — never a code change. That promise decays quietly: someone types a
 * name into a heading, a title suffix, a Fit caveat, and now every fork ships
 * the demo persona's identity until they find and delete it by hand.
 *
 * So this inverts the check. It reads the CURRENT identity out of the generated
 * content module and asserts none of those strings appear anywhere in code. It
 * needs no hardcoded blocklist and keeps working after a fork renames the
 * persona: whatever your identity is, it belongs in YAML, not in src/.
 *
 * Regression guard for two real bugs: the "Demo corpus is fictional (Avery
 * Quill)" caveat baked into src/fit/match.ts (shipped to adopters' recruiters),
 * and the hand-edited <title>/og:* block in index.html.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Code that must stay identity-free. */
const SCAN_DIRS = ["src", "functions", "graph"];
const SCAN_FILES = ["index.html", "404.html", "manifest.json"];
const SCAN_EXT = new Set([".ts", ".tsx", ".js", ".mjs", ".html", ".json", ".css"]);
/** Generated FROM the config, so of course it contains it. */
const EXCLUDE = ["src/generated/", "functions/_lib/"];

const generated = readFileSync(join(root, "src", "generated", "content.ts"), "utf8");

/** Pull a string literal out of the generated module by key. */
function generatedValue(key) {
  const m = generated.match(new RegExp(`\\b${key}:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  return m ? JSON.parse(`"${m[1]}"`) : null;
}

/**
 * Identity strings that must not appear in code. Short or highly generic
 * values are skipped — a one-word tagline would match half the repo and the
 * gate would be noise instead of signal.
 */
const identity = [
  ["profile name", generatedValue("name")],
  ["profile email", generatedValue("email")],
  ["title suffix", generatedValue("titleSuffix")],
  ["manifest short_name", generatedValue("shortName")],
].filter(([, v]) => v && v.trim().length >= 5);

if (!identity.length) {
  console.error("check-adopter-config: could not read any identity from src/generated/content.ts");
  process.exit(1);
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (SCAN_EXT.has(entry.slice(entry.lastIndexOf(".")))) out.push(abs);
  }
  return out;
}

const files = [
  ...SCAN_DIRS.flatMap((d) => walk(join(root, d))),
  ...SCAN_FILES.map((f) => join(root, f)),
].filter((abs) => {
  const rel = relative(root, abs).split("\\").join("/");
  return !EXCLUDE.some((ex) => rel.startsWith(ex));
});

const errors = [];
for (const abs of files) {
  const rel = relative(root, abs).split("\\").join("/");
  const text = readFileSync(abs, "utf8");
  text.split("\n").forEach((line, i) => {
    for (const [label, value] of identity) {
      if (line.includes(value)) {
        errors.push(
          `${rel}:${i + 1}: hardcodes the ${label} ("${value}") — read it from ` +
            "content/config/ via src/generated/content.ts instead",
        );
      }
    }
  });
}

if (errors.length) {
  console.error("check-adopter-config: FAILED");
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}

console.log(
  `check-adopter-config: ok (${identity.length} identity values absent from ${files.length} code files)`,
);
