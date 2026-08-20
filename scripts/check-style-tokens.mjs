/**
 * Design-token discipline gate.
 *
 * The component layer (styles.css) must express every value as a token, so a
 * fork can re-theme the whole site from tokens/colors.css without grepping
 * component rules. This check enforces three properties:
 *
 *   1. No raw color literals in the component layer. Raw values belong in
 *      tokens/, which is where an adopter expects to edit them.
 *   2. Every var(--x) actually resolves to a token defined under tokens/.
 *      Catches the silent-fallback bug where a renamed token leaves
 *      `var(--line, #ddd5c8)` quietly painting a stale color.
 *   3. The reverse: every SEMANTIC token is actually read by a var(). A token
 *      nothing consumes is a promise the stylesheet does not keep, and it is
 *      invisible to property 2 — which is how `--rm-brand-deep` shipped as one
 *      of four documented adopter variables while changing nothing when set.
 *      ADR 015 was written to kill exactly that bug for `--rm-brand`; without
 *      this direction it simply grew back on the next variable over.
 *
 *      RAMP_PREFIXES below are exempt. A type, spacing or z scale is published
 *      as a complete ramp and legitimately ships a step ahead of its first
 *      use — deleting the unused step is what makes a scale incoherent. The
 *      exemption is deliberately narrow: it covers ramps only, so every
 *      semantic alias (--brand*, --surface*, --fg*, --container-*, --wash-*)
 *      still has to earn its place.
 *
 * There used to be a third property here: tokens that TypeScript built by
 * name at runtime had to be asserted separately, because the skill-bank dots
 * rendered `style="background: var(--cat-3)"` and CSS-only analysis could not
 * see the reference. That inline style violated `style-src 'self'`, so the
 * palette now lives in styles.css as eight real rules — which property 2
 * already covers.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokensDir = join(root, "tokens");

/** Files whose values must be tokens, not literals.
 *
 * og-card.css is here because the social card is the most-viewed rendering of
 * the site and was, until it became a real stylesheet, exempt from every rule
 * in this file — it had drifted to its own font stack, its own ink ramp, and an
 * eyebrow tracked at 0.14em against the token's 0.12em. A card that renders in
 * the template's colours on someone else's site is a branding bug, so it is
 * held to the same standard as the page. */
const COMPONENT_LAYER = ["styles.css", "scripts/lib/og-card.css"];

const COLOR_LITERAL =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\s*\(/gi;

/* Published scales. An unused step in a ramp is a scale, not a dead promise —
   see property 3. Anything not matching one of these must be consumed. */
const RAMP_PREFIXES = [
  "--space-",
  "--text-",
  "--line-",
  "--tracking-",
  "--weight-",
  "--radius-",
  "--shadow-",
  "--dur-",
  "--ease-",
  "--z-",
  "--cat-",
  "--ink-",
  "--bp-",
];

const isRamp = (name) => RAMP_PREFIXES.some((p) => name.startsWith(p));

const errors = [];

/** Strip comments so documented examples don't trip any of the scans. */
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/* Comments are stripped here too, not just for the literal scan. A token name
   written in prose ("no --container-narrow: use --measure-reading") matches the
   definition pattern, which would register a phantom token — and a phantom is
   defined-but-never-read, so property 3 would report a token that does not
   exist and cannot be removed. */
const tokenFiles = readdirSync(tokensDir).filter((f) => f.endsWith(".css"));
const defined = new Set();
for (const file of tokenFiles) {
  const css = stripComments(readFileSync(join(tokensDir, file), "utf8"));
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:/gi)) defined.add(m[1]);
}

for (const rel of COMPONENT_LAYER) {
  const css = stripComments(readFileSync(join(root, rel), "utf8"));
  css.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(COLOR_LITERAL)) {
      errors.push(
        `${rel}:${i + 1}: raw color "${m[0]}" — define it in tokens/ and reference the token`,
      );
    }
  });
}

const used = new Set();
for (const rel of [...COMPONENT_LAYER, ...tokenFiles.map((f) => `tokens/${f}`)]) {
  const css = stripComments(readFileSync(join(root, rel), "utf8"));
  css.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) {
      used.add(m[1]);
      if (!defined.has(m[1])) {
        errors.push(`${rel}:${i + 1}: var(${m[1]}) is not defined under tokens/`);
      }
    }
  });
}

/* A token name can also be read from JS rather than referenced by a var(). Two
   real cases: the skill-bank dots used to assemble --cat-N (see the note
   above), and graph/theme.mjs resolves every --pg-* through getComputedStyle
   on the nearest .pg-page ancestor. Neither is visible to a CSS-only scan, so
   count a literal occurrence in either tree as a use. */
function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(abs, out);
    else if (/\.(tsx?|mjs)$/.test(entry.name)) out.push(abs);
  }
  return out;
}
for (const dir of ["src", "graph"]) {
  for (const abs of sourceFiles(join(root, dir))) {
    for (const m of readFileSync(abs, "utf8").matchAll(/(--[a-z0-9-]+)/gi)) {
      used.add(m[1]);
    }
  }
}

for (const name of [...defined].sort()) {
  if (used.has(name) || isRamp(name)) continue;
  errors.push(
    `tokens/: ${name} is defined but no var() reads it — ` +
      `give it a consumer or remove it (see property 3)`,
  );
}

if (errors.length) {
  console.error("check-style-tokens: FAILED");
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}

console.log(
  `check-style-tokens: ok (${defined.size} tokens defined across ${tokenFiles.length} files)`,
);
