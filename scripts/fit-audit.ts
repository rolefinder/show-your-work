/**
 * `bun run fit:audit [path…]` — what your corpus does NOT yet answer.
 *
 * The matcher already evaluates every requirement in a job description and
 * marks the ones nothing published covers. Every display path then throws that
 * away: highlight mode filters those rows out of the brief, the browser never
 * transmits them, and /api/fit stores nothing. So the one output that is
 * addressed to the AUTHOR rather than the recruiter is computed on every run
 * and discarded.
 *
 * This turns it around. Point it at job descriptions you actually care about
 * and it reports coverage — how much of each one your published work can cite,
 * and which requirements it cannot. That list is a writing queue, drawn from
 * real postings rather than guesswork.
 *
 * Entirely local. It reads files you already have and prints to your terminal:
 * no network, no beacon, no storage, nothing written anywhere. The privacy
 * posture is untouched because a visitor is never involved.
 *
 * Usage:
 *   bun run fit:audit                 # every .txt / .md under ./jds/
 *   bun run fit:audit some-role.txt   # one file
 *   bun run fit:audit a/ b/ c.txt     # any mix of files and directories
 *   bun run fit:audit --json          # machine-readable, for a wrapper
 *
 * Exit 0 always when it ran: an uncovered requirement is information, not a
 * failure. Exit 2 if there was nothing to read.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative, extname, basename, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { buildEvidencePack } from "../src/fit/evidence";
import { matchFit } from "../src/fit/match";
import type { FitMatchConfig } from "../src/fit/config";
import { BLOG, EDUCATION, EXPERIENCE, SITE_PROFILE, WORK } from "../src/generated/content";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);

if (argv.includes("--help") || argv.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?/, ""));
  process.exit(0);
}

const asJson = argv.includes("--json");
const targets = argv.filter((a) => !a.startsWith("--"));
const READABLE = new Set([".txt", ".md"]);

/** Every readable JD under the given paths, or ./jds/ when none were named. */
function collect(paths: string[]): string[] {
  const roots = paths.length ? paths : [join(root, "jds")];
  const out: string[] = [];
  for (const p of roots) {
    if (!existsSync(p)) continue;
    if (statSync(p).isDirectory()) {
      for (const f of readdirSync(p).sort()) {
        const full = join(p, f);
        if (statSync(full).isFile() && READABLE.has(extname(f))) out.push(full);
      }
    } else {
      out.push(p);
    }
  }
  return out;
}

const files = collect(targets);
if (!files.length) {
  const where = targets.length ? targets.join(", ") : "./jds/";
  console.error(
    `fit:audit: nothing to read at ${where}\n` +
      `  Save a job description as a .txt or .md file and pass its path, or put\n` +
      `  several under ./jds/ and run this with no arguments.`,
  );
  process.exit(2);
}

/* The adopter's tenant config — synonyms, stop words, thresholds — so the
   audit scores exactly the way the published brief will. Absent before the
   first build, in which case the engine defaults are the honest answer. */
let cfg: FitMatchConfig = {};
const cfgPath = join(root, "dist", "fit-config.json");
if (existsSync(cfgPath)) cfg = JSON.parse(readFileSync(cfgPath, "utf8")) as FitMatchConfig;

// showGaps is the whole point: the discarded rows are what this reports.
const auditCfg: FitMatchConfig = { ...cfg, showGaps: true };
const docs = buildEvidencePack(SITE_PROFILE, WORK, BLOG, EXPERIENCE, EDUCATION);

/* A path inside the repo reads better relative; one outside it (a scratch
   directory, an absolute path) reads better as just the filename than as a
   chain of `../`. */
function label(f: string): string {
  const rel = relative(root, f);
  return rel.startsWith("..") || isAbsolute(rel) ? basename(f) : rel;
}

type Report = {
  file: string;
  role_read: string;
  total: number;
  aligned: number;
  partial: number;
  uncited: string[];
};

const reports: Report[] = files.map((f) => {
  const brief = matchFit(readFileSync(f, "utf8"), docs, auditCfg);
  const reqs = brief.requirements;
  return {
    file: label(f),
    role_read: brief.role_read,
    total: reqs.length,
    aligned: reqs.filter((r) => r.status === "aligned").length,
    partial: reqs.filter((r) => r.status === "partial").length,
    uncited: reqs
      .filter((r) => r.status !== "aligned" && r.status !== "partial")
      .map((r) => r.text),
  };
});

if (asJson) {
  console.log(JSON.stringify({ docs: docs.length, reports }, null, 2));
  process.exit(0);
}

const totals = reports.reduce(
  (a, r) => ({
    total: a.total + r.total,
    aligned: a.aligned + r.aligned,
    partial: a.partial + r.partial,
    uncited: a.uncited + r.uncited.length,
  }),
  { total: 0, aligned: 0, partial: 0, uncited: 0 },
);

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

console.log(
  `fit:audit — ${reports.length} job description${reports.length === 1 ? "" : "s"} ` +
    `against ${docs.length} published doc${docs.length === 1 ? "" : "s"}\n`,
);

for (const r of reports) {
  console.log(`${r.file}`);
  console.log(`  ${r.role_read}`);
  console.log(
    `  ${r.total} requirements · ${r.aligned} aligned · ${r.partial} partial · ` +
      `${r.uncited.length} uncited`,
  );
  if (r.uncited.length) {
    console.log("  nothing published covers:");
    for (const u of r.uncited.slice(0, 12)) console.log(`    - ${u}`);
    if (r.uncited.length > 12) console.log(`    …and ${r.uncited.length - 12} more`);
  }
  console.log("");
}

if (reports.length > 1) {
  console.log(
    `total: ${totals.total} requirements · ${totals.aligned} aligned ` +
      `(${pct(totals.aligned, totals.total)}) · ${totals.partial} partial · ` +
      `${totals.uncited} uncited`,
  );
}

/* Deliberately exit 0 even with everything uncited. This is a mirror, not a
   gate: a requirement your work does not cover is a fact about the posting as
   much as about you, and failing a build over it would be nonsense. */
process.exit(0);
