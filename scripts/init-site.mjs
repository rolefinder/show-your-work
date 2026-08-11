/**
 * `npm run init` — turn this template into YOUR site.
 *
 * Everything the setup runbook asks a human to do by hand, done in one pass:
 * creates content/config/site.yaml, content/about/profile.yaml and
 * content/config/fit.yaml, and optionally starter project/post files showing
 * the editorial contract. Demo mode turns itself off, because it is derived
 * from whether content/about/profile.yaml exists rather than declared.
 *
 * Two modes, because a scaffolder you cannot script is only half a tool:
 *   node scripts/init-site.mjs                     interactive prompts
 *   node scripts/init-site.mjs --config me.json    non-interactive
 * Add --dry-run to print what would be created, --starter-content to also add
 * example project/post files, or --force to replace answers you already gave.
 *
 * It only ever CREATES files, and only under content/. It does not touch src/,
 * it does not touch tokens/, and it does not touch content/demo/ — the demo
 * corpus stays exactly as it shipped and simply stops being used once you have
 * added your own. Refusing to overwrite is the point: a template you have to
 * edit or delete is one you cannot safely re-run or update.
 */
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { banner } from "./banner.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
/* --starter-content ADDS example files. It replaced --replace-content, which
   deleted the demo corpus: nothing needs deleting now, because adding one
   project switches the site off the demo corpus by itself. */
const starterContent = args.includes("--starter-content");
const force = args.includes("--force");
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

# Keep in sync with --syw-bg in tokens/colors.css and the dark --bg.
theme_color: "#f7f4ef"
theme_color_dark: "#131211"

# Where this deploys. See docs/guide/deploy.md.
#   github-pages     no new account; needs a <user>.github.io repo or a custom
#                    domain, because the site serves at the root only. GitHub
#                    Pages cannot set response headers, so the CSP ships as a
#                    <meta http-equiv> — weaker, and no frame-ancestors.
#   cloudflare-pages real headers, so the strict CSP in public/_headers applies.
deploy:
  target: ${deployTarget(a)}
  custom_domain: ${yamlString(customDomain(a))}
${themeBlock(a)}`;
}

/**
 * Accent lives here, not in tokens/colors.css.
 *
 * init used to rewrite the --syw-brand declaration in that file, which made
 * theming an edit to a tracked template file — exactly what this repo now
 * refuses to require. The build turns these into tokens/adopter.css instead.
 * Omitted entirely when you did not pick one, so the shipped palette applies.
 */
function themeBlock(a) {
  if (!a.accent) return "";
  return `
# Overrides the four adopter variables in tokens/colors.css, without editing
# it. The build writes these into tokens/adopter.css, which loads last.
theme:
  accent: ${yamlString(a.accent)}
`;
}

/**
 * A fresh fit.yaml, written rather than derived from the demo's.
 *
 * init used to read content/config/fit.yaml, regex out the demo persona's stop
 * words, and write it back — an edit to a shipped file, and the source of the
 * CRLF bug where the regex silently matched nothing on every Windows fork.
 * Creating the file outright has neither problem: there is nothing to match.
 *
 * Only the two keys that are genuinely per-person are emitted. Everything else
 * (synonyms, weights, thresholds, show_gaps) falls back to the defaults in
 * src/fit/config.ts, so an adopter tunes matching only if they want to.
 */
function fitYaml(a) {
  const stops = nameStops(a.name).map((s) => `  - ${s}`).join("\n");
  return `# Fit matcher overrides for this site. Keys are snake_case; the emitter
# translates them to the matcher's camelCase fields (ADR 020).
#
# Only what is person-specific lives here. Core English stops, generic tech
# synonyms, weights and thresholds all come from src/fit/config.ts — add a key
# here only to override one.

# Your own name tokens, or every job description scores a match on your name.
extra_stops:
${stops}

# Sentences appended after the two engine caveats on every brief. The demo's
# "this corpus is fictional" disclaimer is NOT copied here — it belongs to
# content/demo/config/fit.yaml and stays there.
extra_caveats: []
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

  /* Every entry is a file that does not exist yet. init CREATES; it never
     edits and never deletes. content/demo/ is left exactly as it shipped, and
     each file written here takes over from its demo counterpart because the
     resolver prefers content/<path> when it is present. */
  const writes = [
    ["content/config/site.yaml", siteYaml(answers)],
    ["content/about/profile.yaml", profileYaml(answers)],
    ["content/config/fit.yaml", fitYaml(answers)],
  ];

  if (starterContent) {
    writes.push(["content/work/first-project.yaml", STARTER_WORK]);
    writes.push(["content/blog/first-post.yaml", STARTER_POST]);
  }

  /* Refuse rather than clobber. Re-running init after you have written real
     content used to overwrite site.yaml and profile.yaml wholesale, which is
     the one way this tool could destroy work. --force is there for the case
     where you genuinely want to start the answers over. */
  const collisions = writes.map(([p]) => p).filter((p) => existsSync(join(root, p)));
  if (collisions.length && !force) {
    console.error("init: these already exist, and init does not overwrite:");
    for (const c of collisions) console.error(`  - ${c}`);
    console.error("\nEdit them directly, or re-run with --force to replace them.");
    process.exit(1);
  }

  if (dryRun) {
    console.log("init: --dry-run, nothing written\n");
    for (const [p] of writes) console.log(`  ${existsSync(join(root, p)) ? "REPLACE" : "create "}  ${p}`);
    console.log("\nNothing under content/demo/ is touched.");
    return;
  }

  for (const [p, body] of writes) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), body, "utf8");
  }

  console.log("init: done.");
  for (const [p] of writes) console.log(`  wrote   ${p}`);
  console.log("\nNothing under content/demo/ was touched — it is still there, and still");
  console.log("what the site falls back to for anything you have not added yet.");
  console.log("\nNext:");
  console.log("  1. Add your skills in content/about/profile.yaml");
  console.log(
    starterContent
      ? "  2. Fill in content/work/first-project.yaml — the demo projects are already out of the site"
      : "  2. Add content/work/<slug>.yaml — the demo projects drop out as soon as you add one",
  );
  console.log("  3. npm run ready");
}

main(await collect());
