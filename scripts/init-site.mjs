/**
 * `npm run init` — turn this template into YOUR site.
 *
 * Everything the setup runbook asks a human to do by hand, done in one pass:
 * writes content/config/site.yaml and content/about/profile.yaml, swaps the
 * demo persona's Fit stop words for yours, clears the demo disclaimer, flips
 * demo mode off, and optionally replaces the demo corpus with starter files
 * that show the editorial contract.
 *
 * Two modes, because a scaffolder you cannot script is only half a tool:
 *   node scripts/init-site.mjs                     interactive prompts
 *   node scripts/init-site.mjs --config me.json    non-interactive
 * Add --dry-run to print what would change and write nothing, or
 * --replace-content to also rewrite content/work and content/blog.
 *
 * It never touches src/. If it did, it would be re-introducing exactly the
 * code-edit burden ADR 016 removed.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const replaceContent = args.includes("--replace-content");
const configFlag = args.indexOf("--config");
const configPath = configFlag >= 0 ? args[configFlag + 1] : null;

const FIELDS = [
  { key: "name", q: "Your name", required: true },
  { key: "tagline", q: "One-line tagline (what you do)", required: true },
  { key: "location", q: "Location", required: true },
  { key: "email", q: "Contact email", required: true },
  { key: "origin", q: "Site origin (https://…)", required: true },
  { key: "summary", q: "Short summary paragraph", required: true },
  { key: "github", q: "GitHub URL (blank to skip)", required: false },
  { key: "linkedin", q: "LinkedIn URL (blank to skip)", required: false },
  { key: "accent", q: "Accent color hex (blank keeps #0f5c4c)", required: false },
];

function yamlString(s) {
  // Always quote: names and taglines routinely contain ':' and '#'.
  return JSON.stringify(String(s ?? ""));
}

/** Name tokens become Fit stop words, or every JD match scores your own name. */
function nameStops(name) {
  return String(name)
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter((t) => t.length > 1);
}

function validate(answers) {
  const errors = [];
  if (!/^https?:\/\/[^\s/]+/.test(answers.origin || "")) {
    errors.push(`origin must be an absolute URL, got ${JSON.stringify(answers.origin || "")}`);
  }
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(answers.email || "")) {
    errors.push(`email does not look like an address: ${JSON.stringify(answers.email || "")}`);
  }
  if (answers.accent && !/^#[0-9a-f]{6}$/i.test(answers.accent)) {
    errors.push(`accent must be a 6-digit hex color, got ${JSON.stringify(answers.accent)}`);
  }
  for (const f of FIELDS) {
    if (f.required && !String(answers[f.key] || "").trim()) errors.push(`${f.key} is required`);
  }
  return errors;
}

async function collect() {
  if (configPath) {
    const raw = JSON.parse(readFileSync(configPath, "utf8"));
    return raw;
  }
  const rl = createInterface({ input: stdin, output: stdout });
  const answers = {};
  console.log("recruit-me init - answers go to content/, never to code.\n");
  for (const f of FIELDS) {
    answers[f.key] = (await rl.question(`${f.q}: `)).trim();
  }
  rl.close();
  return answers;
}

function siteYaml(a) {
  return `# Adopter config: everything that identifies THIS deployment.
# Written by scripts/init-site.mjs. Safe to hand-edit afterwards.
#
# Nothing here should ever be hardcoded in src/, index.html, or manifest.json
# — scripts/emit-html.ts writes those from this file at build time.

origin: ${yamlString(a.origin.replace(/\/+$/, ""))}

title_suffix: ${yamlString(a.name)}

description: ${yamlString(a.summary.replace(/\s+/g, " ").trim().slice(0, 200))}

short_name: ${yamlString(a.name)}

# Keep in sync with --rm-bg in tokens/colors.css and the dark --bg.
theme_color: "#f7f4ef"
theme_color_dark: "#131211"

# Demo chrome off: this is a real corpus now.
demo: false
`;
}

function profileYaml(a) {
  const links = [];
  if (a.github) links.push({ label: "GitHub", href: a.github });
  if (a.linkedin) links.push({ label: "LinkedIn", href: a.linkedin });
  const linkBlock = links.length
    ? "\nlinks:\n" + links.map((l) => `  - label: ${l.label}\n    href: ${l.href}`).join("\n") + "\n"
    : "\n# links:\n#   - label: GitHub\n#     href: https://github.com/you\n";
  return `name: ${yamlString(a.name)}
tagline: ${yamlString(a.tagline)}
location: ${yamlString(a.location)}
email: ${yamlString(a.email)}
summary: >
  ${a.summary.replace(/\s+/g, " ").trim()}

# Skills power the skill bank, the graph, and Fit matching. Add yours.
skills:
  - Add
  - your
  - skills
${linkBlock}`;
}

const STARTER_WORK = `slug: first-project
title: First project
summary: >
  One sentence a recruiter can read in three seconds.
body: >
  A paragraph of context. Cross-link other pages with
  {{blog:first-post|a post}} tokens.
skills:
  - Add
  - your
  - skills

# The editorial contract. Optional, but outcome and evidence are what Fit
# quotes, so filling them turns a citation into a whole statement.
problem: >
  What was broken or missing before this existed.
outcome: >
  What is true now that was not true before.
evidence:
  - Something concrete and checkable.
  - Another one.
decisions:
  - >
    A choice you made and why the alternative lost.

# skill label -> how it applied here (pairs with descriptions in
# content/config/skills.yaml to form a tooltip).
skill_notes: {}

visible: true
date: "2026-01"
`;

const STARTER_POST = `slug: first-post
title: First post
summary: >
  What this post argues, in one sentence.
body: >
  The body. Cross-link with {{work:first-project|a project}} tokens.
skills:
  - Add
  - your
  - skills
visible: true
date: "2026-01"
`;

function main(answers) {
  const errors = validate(answers);
  if (errors.length) {
    console.error("init: invalid answers");
    for (const e of errors) console.error("  - " + e);
    process.exit(1);
  }

  const writes = [
    ["content/config/site.yaml", siteYaml(answers)],
    ["content/about/profile.yaml", profileYaml(answers)],
  ];

  // Fit: the demo persona's stop words and disclaimer become yours / nothing.
  const fitPath = join(root, "content", "config", "fit.yaml");
  let fit = readFileSync(fitPath, "utf8");
  fit = fit.replace(
    /^extraStops:\n(?:\s+- .*\n)*/m,
    "extraStops:\n" + nameStops(answers.name).map((s) => `  - ${s}\n`).join(""),
  );
  fit = fit.replace(/^extraCaveats:\n(?:\s+- .*\n)*/m, "extraCaveats: []\n");
  writes.push(["content/config/fit.yaml", fit]);

  // The accent is the one token an adopter is most likely to want changed, and
  // it is a documented override surface — but it lives in CSS, so only the
  // four --rm-* lines are touched, never a component rule.
  if (answers.accent) {
    const colorsPath = join(root, "tokens", "colors.css");
    const colors = readFileSync(colorsPath, "utf8").replace(
      /(--rm-brand:\s*)#[0-9a-f]{6}/i,
      `$1${answers.accent}`,
    );
    writes.push(["tokens/colors.css", colors]);
  }

  const removals = [];
  if (replaceContent) {
    for (const dir of ["content/work", "content/blog"]) {
      for (const f of readdirSync(join(root, dir))) {
        if (f.endsWith(".yaml")) removals.push(`${dir}/${f}`);
      }
    }
    writes.push(["content/work/first-project.yaml", STARTER_WORK]);
    writes.push(["content/blog/first-post.yaml", STARTER_POST]);
  }

  if (dryRun) {
    console.log("init: --dry-run, nothing written\n");
    for (const r of removals) console.log(`  delete  ${r}`);
    for (const [p] of writes) console.log(`  write   ${p}`);
    return;
  }

  for (const r of removals) rmSync(join(root, r), { force: true });
  for (const [p, body] of writes) writeFileSync(join(root, p), body, "utf8");

  console.log("init: done.");
  for (const r of removals) console.log(`  deleted ${r}`);
  for (const [p] of writes) console.log(`  wrote   ${p}`);
  console.log("\nNext:");
  console.log("  1. Fill in your skills in content/about/profile.yaml");
  if (!replaceContent && readdirSync(join(root, "content/work")).some((f) => f.startsWith("fake-"))) {
    console.log("  2. Replace content/work/*.yaml and content/blog/*.yaml (still the demo corpus)");
    console.log("     — or re-run with --replace-content to swap in starter files");
  } else {
    console.log("  2. Write your real projects and posts in content/work and content/blog");
  }
  console.log("  3. npm test");
}

main(await collect());
