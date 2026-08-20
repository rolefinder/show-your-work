#!/usr/bin/env node
/**
 * `bun run copy:check` — lint the *rendered* copy in dist/.
 *
 * Every other gate here checks structure: do slugs resolve, does the sitemap
 * match, is the config complete. None of them read the words. That is a real
 * gap, because the defects a visitor actually notices are prose defects, and
 * they survive a green build.
 *
 * It scans dist/**\/*.html rather than content/**.yaml deliberately. The
 * rendered document is what ships, and it is the only place where an
 * authoring-time construct that failed to *become* something is visible — a
 * cross-link token renders as literal braces in HTML while looking perfectly
 * well-formed in the YAML it came from.
 *
 * Runs after the build, so it needs dist/ to exist.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

if (!existsSync(dist)) {
  console.error("FAIL: dist/ does not exist — run `bun run build` first");
  process.exit(1);
}

function htmlFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) htmlFiles(abs, out);
    else if (entry.name.endsWith(".html")) out.push(abs);
  }
  return out;
}

/* Only the rendered body text. Script, style and JSON-LD blocks are code and
   data — a doubled word inside minified JS is not a copy defect, and the
   prerendered app bundle would otherwise produce nothing but false positives.
 *
 * Tags become NEWLINES, not spaces. With spaces, the text of two adjacent
 * elements runs together and invents adjacencies that no reader ever sees:
 * the skill-bank heading "Languages & content" followed by the skill
 * "content pipelines" reported a doubled "content" on its first run. One text
 * node per line, and the doubled-word check stays inside one. */
function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<!--[\s\S]*?-->/g, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ");
}

const CHECKS = [
  {
    // {{work:slug|Label}} that never became a link. In YAML it looks fine; in
    // the document it is literal braces in the middle of a sentence.
    name: "unrendered cross-link token",
    re: /\{\{[^}\n]{1,120}\}\}/g,
    hint: "a {{work:…}} / {{blog:…}} token reached the page unparsed — check the slug exists and is visible",
  },
  {
    name: "authoring placeholder",
    re: /\b(TODO|FIXME|TKTK|Lorem ipsum)\b/gi,
    hint: "placeholder text is published — fill it in or set visible: false",
  },
  {
    // "the the", "a a", "and and" — the classic copy defect, and one nobody
    // catches by rereading their own sentence.
    name: "doubled word",
    // [ \t]+ not \s+: a repeat that spans a newline spans two text nodes, and
    // is an artefact of flattening the DOM rather than something on the page.
    re: /\b([A-Za-z]{2,})[ \t]+\1\b/g,
    hint: "a word is repeated",
    // "had had" and "that that" are grammatical; so is a repeated proper noun
    // across a sentence boundary, which the \b…\1 form cannot see.
    allow: /^(had|that|is|from|new|york|sing|bye)$/i,
  },
];

const failures = [];

for (const file of htmlFiles(dist)) {
  const rel = relative(root, file).replace(/\\/g, "/");
  const text = visibleText(readFileSync(file, "utf8"));
  for (const check of CHECKS) {
    for (const m of text.matchAll(check.re)) {
      if (check.allow && check.allow.test(m[1] || "")) continue;
      const context = text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 40).replace(/\s+/g, " ").trim();
      failures.push(`${rel}: ${check.name} — ${check.hint}\n      …${context}…`);
    }
  }
}

if (failures.length) {
  console.error("check-copy: FAILED");
  for (const f of failures.slice(0, 20)) console.error(`  - ${f}`);
  if (failures.length > 20) console.error(`  … and ${failures.length - 20} more`);
  process.exit(1);
}

const scanned = htmlFiles(dist).length;
console.log(`check-copy: ok (${scanned} rendered documents, no unparsed tokens, placeholders or doubled words)`);
