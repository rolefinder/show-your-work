/**
 * Readiness preflight for /build-show-your-work.
 *
 * Answers one question deterministically, so the skill doesn't have to
 * eyeball it: is this config actually filled in, or is it still the template?
 *
 * Exit 0 = ready to build. Exit 1 = still has placeholders (listed). Exit 2 =
 * a dependency the build needs is missing.
 *
 * Placeholders are reported, never fixed — guessing an adopter's identity is
 * exactly the kind of invention this project exists to avoid.
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEMO, corpusDir, isDemo, isOwn, rel, resolve } from "./lib/content-paths.mjs";
import { scalar } from "./lib/yaml-lite.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");

const blockers = [];   // content/config problems -> exit 1
const missingDeps = []; // toolchain problems     -> exit 2
const warnings = [];

/* ---------- config ----------
   Every blocker below names a file to ADD. None asks anyone to edit or delete
   something the template ships: content/demo/ stays exactly as it came, and
   each file you add takes over from its demo counterpart. That is the whole
   contract, so the wording here has to hold it up — "still contains the demo
   corpus" was an instruction to delete, and it is gone. */
const site = readFileSync(resolve("config", "site.yaml"), "utf8");
const profile = readFileSync(resolve("about", "profile.yaml"), "utf8");

const origin = scalar(site, "origin");
if (!isOwn("config", "site.yaml")) {
  blockers.push(
    "content/config/site.yaml: not added yet — the build is using content/demo/config/site.yaml, " +
      `so the site's origin is ${origin || "unset"}. Add the file with your origin.`,
  );
} else if (!origin || origin.includes("example.com")) {
  blockers.push(`content/config/site.yaml: origin is ${origin || "unset"} — set your real domain`);
}

const name = scalar(profile, "name");
const email = scalar(profile, "email");
if (isDemo()) {
  blockers.push(
    "content/about/profile.yaml: not added yet — every page and every JSON-LD Person block " +
      `still says "${name}". Add the file with your name, tagline, location, email and skills.`,
  );
} else {
  /* The file existing is not the same as the file being yours. Copying
     content/demo/about/profile.yaml across is a natural first move — the guide
     even suggests copying a config out to edit it — and on its own that flips
     demo mode OFF while the site still publishes "Fake Name" in every title
     and every JSON-LD Person block. Deriving demo mode from the file's
     PRESENCE is what makes this check load-bearing rather than redundant. */
  for (const [field, value] of [["name", name], ["email", email]]) {
    if (!value) blockers.push(`content/about/profile.yaml: ${field} is empty — fill it in`);
  }

  /* Compare against the demo file's ACTUAL values rather than pattern-matching
     for "fake".

     A regex here would be a second definition of "is this the demo persona",
     and check-fictional-corpus.py already owns the first one — it requires the
     substring `fake` in the demo profile's name. Two definitions drift: a fork
     that renames its persona to "Fakeperson" satisfies that gate and slips
     past a \bfake\b word-boundary test. Reading the file both gates are
     talking about cannot disagree with itself. */
  const demoProfile = readFileSync(join(DEMO, "about", "profile.yaml"), "utf8");
  for (const [field, value] of [["name", name], ["email", email]]) {
    if (value && value === scalar(demoProfile, field)) {
      blockers.push(
        `content/about/profile.yaml: ${field} is still the demo's (${JSON.stringify(value)}) — ` +
          "this is a copy of content/demo/about/profile.yaml. Demo chrome is already off, so the " +
          "site would publish it as a real person.",
      );
    }
  }

  /* Backstop for a copy that was partially edited — a new name that is still
     obviously a placeholder, or an address at a reserved example domain
     (RFC 2606, which exists precisely so these cannot be real). */
  if (name && name !== scalar(demoProfile, "name") && /fake/i.test(name)) {
    blockers.push(`content/about/profile.yaml: name is still a placeholder (${JSON.stringify(name)})`);
  }
  if (email && email !== scalar(demoProfile, "email") && /@example\.(com|org|net)$/i.test(email)) {
    blockers.push(`content/about/profile.yaml: email is still the placeholder ${email}`);
  }
  if (/^\s*-\s*(Add|your|skills)\s*$/m.test(profile)) {
    blockers.push("content/about/profile.yaml: skills still say 'Add / your / skills'");
  }
}

// ---------- corpus ----------
const workDir = corpusDir("work");
const blogDir = corpusDir("blog");
const listYaml = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".yaml")) : [];

const work = listYaml(workDir);
const blog = listYaml(blogDir);

/* Adding one project switches the whole corpus over — the demo projects are
   not merged in alongside. So this is a single "add your first one", never a
   "now go delete the others". */
if (!work.length || rel(workDir).startsWith("content/demo/")) {
  blockers.push(
    "content/work/: no projects of your own — the site is showing the demo corpus. " +
      "Add content/work/<slug>.yaml (slug must equal the filename); the demo projects " +
      "drop out as soon as you do.",
  );
}
if (blog.length && rel(blogDir).startsWith("content/demo/")) {
  warnings.push(
    "content/blog/: no posts of your own — the site is showing the demo posts. " +
      "Add content/blog/<slug>.yaml, or leave it: writing is optional.",
  );
}

/* YAML has more than one way to say false. PyYAML (which the emitter uses)
   hides `visible: no`, `visible: False` and `visible: off` too, so matching
   only the lowercase literal would treat a hidden file as published — and then
   block on its TODOs, or miss it in the all-drafts guard. */
const HIDDEN_RE = /^visible:\s*(false|no|off)\s*(#.*)?$/im;

/** Same rules for projects and posts: a published TODO ships to a recruiter. */
function auditCorpus(label, dir, files) {
  let drafts = 0;
  for (const f of files) {
    const text = readFileSync(join(dir, f), "utf8");
    if (HIDDEN_RE.test(text)) {
      drafts++;
      warnings.push(
        /TODO/i.test(text)
          ? `${label}/${f}: draft awaiting review — still has TODO markers`
          : `${label}/${f}: draft is hidden — flip visible once you've read it`,
      );
      continue; // an unpublished draft shouldn't also be nagged about its contract
    }
    if (/TODO/i.test(text)) {
      blockers.push(`${label}/${f}: published but still contains TODO markers`);
    }
    // Editorial contract is optional, but its absence is what makes Fit quote
    // fragments instead of claims — worth saying, not worth blocking on. Only
    // projects carry it.
    if (dir === workDir && (!/^outcome:/m.test(text) || !/^evidence:/m.test(text))) {
      warnings.push(`${label}/${f}: no outcome/evidence — Fit will quote prose fragments here`);
    }
  }
  return drafts;
}

const workDrafts = auditCorpus("content/work", workDir, work);
auditCorpus("content/blog", blogDir, blog);
if (workDrafts && workDrafts === work.length) {
  blockers.push("content/work/: every project is an unreviewed draft — nothing would be published");
}

// ---------- dependencies ----------
/* Node first, because every other probe below runs on it. esbuild and
   playwright both require 18+, and 18 is end-of-life — package.json says >=20,
   but bun, like npm before it, only WARNS on an engines mismatch, so an adopter
   on an old Node otherwise discovers it as an unrelated syntax error deep in
   the build. */
const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  missingDeps.push(`node ${process.versions.node} is too old — this build needs Node 20 or newer (see .nvmrc)`);
}

/* Resolve the interpreter by RUNNING it, not by finding it on PATH: on Windows
   `python3` is the Microsoft Store stub, which exists and exits non-zero. The
   probe is a single shell string because an empty-string argv entry gets
   dropped through the shell, turning `python -c ""` into a bare `python -c`. */
const py = ["python", "python3"].find(
  (c) => spawnSync(`${c} -c "pass"`, { shell: true, stdio: "ignore" }).status === 0,
);
if (!py) missingDeps.push("no working python interpreter (needed by the content emitter)");
else if (spawnSync(`${py} -c "import yaml"`, { shell: true, stdio: "ignore" }).status !== 0) {
  missingDeps.push(`${py} cannot import yaml — run: pip install --user pyyaml`);
}
/* bun installs the dependencies AND runs the four TypeScript build steps, so a
   missing bun is not a slow build — it is no build. Probed by running it, for
   the same reason python3 is: a shim on PATH is not an interpreter. */
if (spawnSync("bun --version", { shell: true, stdio: "ignore" }).status !== 0) {
  missingDeps.push("bun missing — install it from https://bun.sh, then run: bun install");
} else if (!existsSync(join(root, "node_modules"))) {
  missingDeps.push("node_modules missing — run: bun install --frozen-lockfile");
}

const pw = spawnSync("bunx playwright --version", { shell: true, stdio: "ignore" });
if (pw.status !== 0) {
  warnings.push(
    "playwright unavailable — the build will produce an SPA-only dist, so per-route " +
      "metadata will be invisible to crawlers. Run: bunx playwright install chromium",
  );
}

// ---------- report ----------
/* --json exists so an agent driving the setup flow branches on structure
   rather than on parsed prose. The exit code is unchanged either way: it is
   still the contract, and --json is a second view of the same answer. */
if (process.argv.includes("--json")) {
  const exit = missingDeps.length ? 2 : blockers.length ? 1 : 0;
  console.log(
    JSON.stringify(
      {
        ready: exit === 0,
        exit,
        blockers,
        missingDependencies: missingDeps,
        warnings,
        profile: { name, email, origin },
        corpus: { work: work.length, blog: blog.length, workDrafts },
      },
      null,
      2,
    ),
  );
  process.exit(exit);
}

for (const w of warnings) console.warn(`check-ready: WARN  ${w}`);

// Toolchain first, and with its own exit code: "your machine isn't set up" is
// a different problem from "your config isn't filled in", and the caller acts
// on them differently.
if (missingDeps.length) {
  console.error("check-ready: MISSING DEPENDENCIES");
  for (const d of missingDeps) console.error(`  - ${d}`);
  process.exit(2);
}
if (blockers.length) {
  console.error("check-ready: NOT READY");
  for (const b of blockers) console.error(`  - ${b}`);
  process.exit(1);
}
console.log(
  `check-ready: ready (${name}, ${origin}, ${work.length} projects, ${blog.length} posts` +
    `${warnings.length ? `, ${warnings.length} warning(s)` : ""})`,
);
