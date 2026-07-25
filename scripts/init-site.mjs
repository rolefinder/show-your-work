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
import { banner } from "./banner.mjs";

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
  { key: "youtube", q: "YouTube channel URL (blank to skip)", required: false },
  { key: "website", q: "Personal site / blog URL (blank to skip)", required: false },
  { key: "accent", q: "Accent color hex (blank keeps #0f5c4c)", required: false },
];

/* These four are prompted because they are the common case. `links` accepts
   ANY key, so a --config file can pass { links: { mastodon: "…" } } and the
   site renders it with no code change. */
const LINK_PROMPTS = ["github", "linkedin", "youtube", "website"];

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
  console.log(banner());
  console.log("Answers go to content/, never to code.\n");
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

# Where this deploys. See docs/guide/deploy.md.
#   github-pages     no new account; needs a <user>.github.io repo or a custom
#                    domain, because the site serves at the root only. GitHub
#                    Pages cannot set response headers, so the CSP ships as a
#                    <meta http-equiv> — weaker, and no frame-ancestors.
#   cloudflare-pages real headers, so the strict CSP in public/_headers applies.
deploy:
  target: ${deployTarget(a)}
  custom_domain: ${yamlString(customDomain(a))}
`;
}

/** `github-pages` unless the config asked for Cloudflare. */
function deployTarget(a) {
  const value = String(a.deploy_target || a.deployTarget || "github-pages").trim();
  if (value !== "github-pages" && value !== "cloudflare-pages") {
    console.error(`init: deploy_target must be github-pages or cloudflare-pages, got ${JSON.stringify(value)}`);
    process.exit(1);
  }
  return value;
}

/**
 * Derived from `origin` rather than prompted for: on GitHub Pages a custom
 * domain IS the origin's host, and asking for the same fact twice is how the
 * two end up disagreeing. `<user>.github.io` needs no CNAME.
 */
function customDomain(a) {
  if (a.custom_domain !== undefined) return a.custom_domain;
  if (deployTarget(a) !== "github-pages") return "";
  const host = String(a.origin || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return /\.github\.io$/i.test(host) ? "" : host;
}

/**
 * An explicit `links` map from a --config file wins and may use any keys;
 * the individually prompted platforms are merged in on top. Blanks are dropped.
 */
function collectLinks(a) {
  const out = { ...(a.links || {}) };
  for (const key of LINK_PROMPTS) {
    const value = String(a[key] || "").trim();
    if (value) out[key] = value;
  }
  return out;
}

function profileYaml(a) {
  const rows = Object.entries(collectLinks(a)).map(([k, v]) => `  ${k}: ${v}`);
  const profileBlock =
    "\n# Profile URLs, keyed by platform, in render order. Add any key you like —\n" +
    "# the label is derived from it, so a new platform needs no code change.\n" +
    (rows.length
      ? "links:\n" + rows.join("\n") + "\n"
      : "links: {}\n#  github: https://github.com/you\n#  youtube: https://www.youtube.com/@you\n");
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
${profileBlock}`;
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
  /* \r?\n, not \n: git checks these files out with CRLF on Windows, so a
     \n-only pattern matched nothing and init silently left the DEMO persona's
     stop words in place on every Windows fork. This predates the snake_case
     rename — the old camelCase pattern had the identical flaw. [ \t]+ rather
     than \s+ for the same class of reason: \s swallows line breaks. */
  /* Match BOTH spellings. emit-fit-config.py still accepts the deprecated
     camelCase keys for a release, so a fork made before the rename has
     `extraStops:` — and a snake_case-only pattern would silently no-op there,
     which is precisely the failure above. Rewriting to snake_case also
     migrates the file, so the next emit stops warning. */
  const eol = fit.includes("\r\n") ? "\r\n" : "\n";
  fit = fit.replace(
    /^(?:extra_stops|extraStops):\r?\n(?:[ \t]+- .*\r?\n)*/m,
    "extra_stops:" + eol + nameStops(answers.name).map((s) => `  - ${s}${eol}`).join(""),
  );
  fit = fit.replace(
    /^(?:extra_caveats|extraCaveats):\r?\n(?:[ \t]+- .*\r?\n)*/m,
    "extra_caveats: []" + eol,
  );
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
