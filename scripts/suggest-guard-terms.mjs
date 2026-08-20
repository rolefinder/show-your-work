/**
 * `bun run guard:suggest` — who have you worked for, according to your own sources?
 *
 * The publication guard needs to know your employers. Hardcoding them would be
 * wrong twice over: it is adopter-specific data in a template, and it would be
 * *someone else's* employer list in your fork. So they are discovered from the
 * same sources the site is built from — content/config/sources.yaml names a
 * resume and a GitHub handle, and `/build-show-your-work` already drafts content
 * out of them. Anything an employer's name can reach, this can see first.
 *
 * CANDIDATES, NOT DECISIONS. Every line printed is a guess. Half of them will
 * be a section heading or a technology. A person picks which are real, and
 * decides for each whether it is merely unwanted on a personal site (commit it)
 * or actually sensitive (the gitignored file). That judgement is what
 * `/sanitize` is for; this only does the finding.
 *
 * Nothing is written. This prints; you choose.
 *
 * Usage: node scripts/suggest-guard-terms.mjs [--help] [--json]
 * Exit 0 always — an empty result is a valid answer, not a failure.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { resolve } from "./lib/content-paths.mjs";
import { nested, scalar } from "./lib/yaml-lite.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const asJson = process.argv.includes("--json");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?/, ""));
  process.exit(0);
}

const sourcesFile = resolve("config", "sources.yaml");
const sources = existsSync(sourcesFile) ? readFileSync(sourcesFile, "utf8") : "";

/* Words that turn up on employment lines and are never an employer. Kept
   deliberately short: this filter is for the obvious, not for cleverness.
   Over-inclusion costs a line someone skips; exclusion costs a leak. */
const NEVER = new Set(
  ("present current remote hybrid onsite contract freelance intern " +
   "january february march april may june july august september october november december " +
   "experience education skills summary projects certifications")
    .split(" "),
);

/** slug -> {term, why, source}, deduped case-insensitively. */
const found = new Map();
const add = (term, why, source) => {
  const clean = String(term).replace(/\s+/g, " ").trim().replace(/[.,;:]+$/, "");
  if (clean.length < 3 || clean.length > 60) return;
  if (clean.split(" ").every((w) => NEVER.has(w.toLowerCase()))) return;
  const key = clean.toLowerCase();
  if (!found.has(key)) found.set(key, { term: clean, why, source });
};

// ---------- GitHub: organisation membership is a strong signal ----------
const handle = nested(sources, "github", "user");
if (handle) {
  const gh = spawnSync("gh", ["api", `users/${handle}/orgs`, "--jq", ".[].login"], {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  if (gh.status === 0) {
    for (const org of gh.stdout.split("\n").map((s) => s.trim()).filter(Boolean)) {
      add(org, "a GitHub org you belong to", `github.com/${handle}`);
    }
  } else {
    add.warned = "gh unavailable or not authenticated - GitHub orgs not checked";
  }
}

/* ---------- Resume ----------
   Employment lines are recognisable without parsing the document: an
   organisation sits next to a date range, or carries a legal/industry suffix.
   Both are noisy on purpose. A missed employer is a leak; a false positive is
   one line someone ignores. */
const DATE_LINE = /\b(19|20)\d{2}\s*(-|–|—|to|–)\s*((19|20)\d{2}|present|current)\b/i;
const ORG_SUFFIX =
  /\b([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,4}\s+(?:Inc|Inc\.|LLC|L\.L\.C\.|Ltd|Ltd\.|Limited|Corp|Corp\.|Corporation|Company|Co\.|PLC|GmbH|AG|NV|SA|Group|Holdings|Partners|Labs|Laboratories|Technologies|Systems|Solutions|Financial|Bank|Health|University|Institute|Foundation))\b/g;
/** Title Case or ALLCAPS runs — what an employer looks like on a resume line. */
const PROPER_RUN = /\b([A-Z][\w&.'-]*(?:\s+(?:of|and|&)?\s*[A-Z][\w&.'-]*){0,3})\b/g;

const resumeRel = scalar(sources, "resume");
if (resumeRel) {
  const resumePath = resolvePath(root, resumeRel);
  if (existsSync(resumePath)) {
    const lines = readFileSync(resumePath, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const m of line.matchAll(ORG_SUFFIX)) {
        add(m[1], "carries a company suffix", `${resumeRel}:${i + 1}`);
      }
      // A line with employment dates, or the line immediately above one.
      const employment = DATE_LINE.test(line) || DATE_LINE.test(lines[i + 1] || "");
      if (employment) {
        for (const m of line.matchAll(PROPER_RUN)) {
          add(m[1], "sits on a line with employment dates", `${resumeRel}:${i + 1}`);
        }
      }
    });
  } else {
    add.missing = `${resumeRel} (named in sources.yaml) does not exist`;
  }
}

const results = [...found.values()].sort((a, b) => a.term.localeCompare(b.term));

if (asJson) {
  console.log(JSON.stringify({ candidates: results, notes: [add.warned, add.missing].filter(Boolean) }, null, 2));
  process.exit(0);
}

if (!handle && !resumeRel) {
  console.log(
    "guard:suggest: content/config/sources.yaml names no resume and no GitHub handle,\n" +
      "  so there is nothing to read. Fill those in, or add terms by hand - see /sanitize.",
  );
  process.exit(0);
}

for (const note of [add.warned, add.missing].filter(Boolean)) console.warn(`guard:suggest: NOTE  ${note}`);

if (!results.length) {
  console.log("guard:suggest: no candidates found in your sources.");
  process.exit(0);
}

console.log(`guard:suggest: ${results.length} candidate(s). These are guesses - pick the real ones.\n`);
for (const r of results) {
  console.log(`  ${r.term}`);
  console.log(`      ${r.why}  (${r.source})`);
}
console.log(
  "\nFor each one you keep, decide WHERE it goes:\n" +
    "  content/config/corpus-guard.yaml        committed - fine for a public company name\n" +
    "  content/config/corpus-guard.local.yaml  gitignored - anything you would not publish\n" +
    "Then: bun run publication:check\n",
);
