/**
 * Readiness preflight for /build-recruit-me.
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

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFileSync(join(root, ...p), "utf8");

/** Minimal YAML scalar reader — avoids a Node YAML dep for a preflight. */
function scalar(text, key) {
  const m = text.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
  if (!m) return "";
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const blockers = [];
const warnings = [];

// ---------- config ----------
const site = read("content", "config", "site.yaml");
const profile = read("content", "about", "profile.yaml");

const origin = scalar(site, "origin");
if (!origin || origin.includes("example.com")) {
  blockers.push(`content/config/site.yaml: origin is still ${origin || "unset"} — set your real domain`);
}
if (/^true$/i.test(scalar(site, "demo"))) {
  blockers.push("content/config/site.yaml: demo is still true — set demo: false once content/ is yours");
}

const name = scalar(profile, "name");
if (!name || /fake/i.test(name)) {
  blockers.push(`content/about/profile.yaml: name is still the placeholder (${name || "unset"})`);
}
const email = scalar(profile, "email");
if (!email || email.includes("example.com")) {
  blockers.push(`content/about/profile.yaml: email is still ${email || "unset"}`);
}
if (/^\s*-\s*(Add|your|skills)\s*$/m.test(profile)) {
  blockers.push("content/about/profile.yaml: skills still contain the 'Add / your / skills' placeholder");
}

// ---------- corpus ----------
const workDir = join(root, "content", "work");
const blogDir = join(root, "content", "blog");
const listYaml = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".yaml")) : [];

const work = listYaml(workDir);
const blog = listYaml(blogDir);
if (!work.length) blockers.push("content/work/: no projects — the site has nothing to show a recruiter");
if (work.some((f) => /^fake-/.test(f))) {
  blockers.push("content/work/: still contains the demo corpus (fake-*.yaml)");
}
if (blog.some((f) => /^fake-/.test(f))) {
  blockers.push("content/blog/: still contains the demo corpus (fake-*.yaml)");
}

// Editorial contract is optional, but its absence is what makes Fit quote
// fragments instead of claims — worth saying, not worth blocking on.
let unreviewedDrafts = 0;
for (const f of work) {
  const text = readFileSync(join(workDir, f), "utf8");
  if (/^visible:\s*false/m.test(text)) {
    unreviewedDrafts++;
    if (/TODO/i.test(text)) {
      warnings.push(`content/work/${f}: draft awaiting review — still has TODO markers`);
    } else {
      warnings.push(`content/work/${f}: draft is visible: false — flip it once you've read it`);
    }
    continue; // an unpublished draft shouldn't also be nagged about its contract
  }
  if (!/^outcome:/m.test(text) || !/^evidence:/m.test(text)) {
    warnings.push(`content/work/${f}: no outcome/evidence — Fit will quote prose fragments here`);
  }
  if (/TODO/i.test(text)) {
    blockers.push(`content/work/${f}: published but still contains TODO markers`);
  }
}
if (unreviewedDrafts && unreviewedDrafts === work.length) {
  blockers.push("content/work/: every project is an unreviewed draft — nothing would be published");
}

// ---------- dependencies ----------
/* Resolve the interpreter by RUNNING it, not by finding it on PATH: on Windows
   `python3` is the Microsoft Store stub, which exists and exits non-zero. The
   probe is a single shell string because an empty-string argv entry gets
   dropped through the shell, turning `python -c ""` into a bare `python -c`. */
const py = ["python", "python3"].find(
  (c) => spawnSync(`${c} -c "pass"`, { shell: true, stdio: "ignore" }).status === 0,
);
if (!py) blockers.push("no working python interpreter (needed by the content emitter)");
else if (spawnSync(`${py} -c "import yaml"`, { shell: true, stdio: "ignore" }).status !== 0) {
  blockers.push(`${py} cannot import yaml — run: pip install --user pyyaml`);
}
if (!existsSync(join(root, "node_modules"))) blockers.push("node_modules missing — run: npm ci");

const pw = spawnSync("npx --yes playwright --version", { shell: true, stdio: "ignore" });
if (pw.status !== 0) {
  warnings.push(
    "playwright unavailable — the build will produce an SPA-only dist, so per-route " +
      "metadata will be invisible to crawlers. Run: npx playwright install chromium",
  );
}

// ---------- report ----------
for (const w of warnings) console.warn(`check-ready: WARN  ${w}`);
if (blockers.length) {
  console.error("check-ready: NOT READY");
  for (const b of blockers) console.error(`  - ${b}`);
  process.exit(1);
}
console.log(
  `check-ready: ready (${name}, ${origin}, ${work.length} projects, ${blog.length} posts` +
    `${warnings.length ? `, ${warnings.length} warning(s)` : ""})`,
);
