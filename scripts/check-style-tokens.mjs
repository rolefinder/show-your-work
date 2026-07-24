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
 *   3. Tokens that TypeScript reads by name still exist (the skill-bank dot
 *      palette builds `var(--cat-N)` strings at runtime, so CSS-only
 *      analysis would never see the reference).
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokensDir = join(root, "tokens");

/** Files whose values must be tokens, not literals. */
const COMPONENT_LAYER = ["styles.css"];
/** Tokens referenced from TypeScript rather than CSS. */
const RUNTIME_TOKENS = Array.from({ length: 8 }, (_, i) => `--cat-${i + 1}`);

const COLOR_LITERAL =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\s*\(/gi;

const errors = [];

const tokenFiles = readdirSync(tokensDir).filter((f) => f.endsWith(".css"));
const defined = new Set();
for (const file of tokenFiles) {
  const css = readFileSync(join(tokensDir, file), "utf8");
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:/gi)) defined.add(m[1]);
}

/** Strip comments so documented examples don't trip the literal scan. */
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

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

for (const rel of [...COMPONENT_LAYER, ...tokenFiles.map((f) => `tokens/${f}`)]) {
  const css = stripComments(readFileSync(join(root, rel), "utf8"));
  css.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) {
      if (!defined.has(m[1])) {
        errors.push(`${rel}:${i + 1}: var(${m[1]}) is not defined under tokens/`);
      }
    }
  });
}

for (const name of RUNTIME_TOKENS) {
  if (!defined.has(name)) {
    errors.push(`tokens/: ${name} is missing but src/skills/SkillBank.tsx builds it at runtime`);
  }
}

if (errors.length) {
  console.error("check-style-tokens: FAILED");
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}

console.log(
  `check-style-tokens: ok (${defined.size} tokens defined across ${tokenFiles.length} files)`,
);
