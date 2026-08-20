/**
 * `bun run parity:check` — the two content resolvers must agree.
 *
 * Some facts in this repo have to be read from both Python and Node. The
 * emitters and content gates are Python; the preflight, the deploy guard and
 * the skills report are Node. Neither can call the other cheaply, so a few
 * things genuinely exist twice.
 *
 * Twice is survivable. Twice AND UNCHECKED is not — this repo has produced
 * that bug four times:
 *
 *   - the deploy workflow's `grep` for the demo flag vs check-pages-target's
 *     scalar(): disagreed on quoted, capitalised and comment-trailed values,
 *     and the workflow would have deployed a placeholder site
 *   - a `\bfake\b` test in check-ready vs corpus:check's `fake` substring:
 *     "Fakeperson Doe" passed one and failed the other
 *   - check-ready's YAML scalar vs check-pages-target's: one stripped inline
 *     comments and one did not, so both gates read `origin` differently
 *   - the browser and Worker evidence packs, which is the ONE case that was
 *     handled correctly from the start — because `fit-smoke` asserts equality
 *
 * The pattern that worked is the pattern generalised here. Where a second
 * implementation is unavoidable, a test asserts the two agree. Where it is
 * avoidable, there is one implementation (scripts/lib/yaml-lite.mjs).
 *
 * This checks packages/content/paths.py against scripts/lib/content-paths.mjs
 * across fixture trees covering every state an adopter passes through.
 *
 * Usage: node scripts/check-parity.mjs [--help] [--verbose]
 * Exit 0 = agree | 1 = drift | 2 = cannot run.
 */
import { mkdirSync, writeFileSync, rmSync, readFileSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const verbose = process.argv.includes("--verbose");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?/, ""));
  process.exit(0);
}

/** The states an adopter actually passes through, in order. */
const FIXTURES = [
  { name: "pristine template", add: [] },
  { name: "config added, nothing else", add: ["config/site.yaml"] },
  { name: "profile added (demo turns off)", add: ["about/profile.yaml"] },
  { name: "config + profile", add: ["config/site.yaml", "about/profile.yaml"] },
  { name: "first project added", add: ["about/profile.yaml", "work/mine.yaml"] },
  { name: "project + post", add: ["about/profile.yaml", "work/mine.yaml", "blog/post.yaml"] },
  { name: "every config overridden", add: [
    "about/profile.yaml", "config/site.yaml", "config/skills.yaml",
    "config/fit.yaml", "config/sources.yaml", "work/mine.yaml",
  ] },
];

/** A tree with the same shape as the real one: demo files, plus `add`. */
function buildFixture(add) {
  const dir = mkdtempSync(join(tmpdir(), "rm-parity-"));
  const write = (rel, body) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), body, "utf8");
  };
  for (const rel of [
    "content/demo/about/profile.yaml",
    "content/demo/config/site.yaml",
    "content/demo/config/skills.yaml",
    "content/demo/config/fit.yaml",
    "content/demo/config/sources.yaml",
    "content/demo/work/fake-one.yaml",
    "content/demo/work/fake-two.yaml",
    "content/demo/blog/fake-post.yaml",
  ]) {
    write(rel, "# demo\n");
  }
  for (const rel of add) write(`content/${rel}`, "# adopter\n");
  return dir;
}

/** Same questions, same order, from each implementation. */
const PROBE_JS = `
import { corpusDir, corpusFiles, isDemo, isOwn, rel, resolve } from ${JSON.stringify(
  // A file:// URL, not a bare path: Node's ESM loader rejects "C:\..." as an
  // unsupported URL scheme ('c:').
  pathToFileURL(join(root, "scripts", "lib", "content-paths.mjs")).href,
)};
const out = { isDemo: isDemo() };
for (const p of [["about","profile.yaml"],["config","site.yaml"],["config","skills.yaml"],["config","fit.yaml"],["config","sources.yaml"]]) {
  out["resolve:" + p.join("/")] = rel(resolve(...p));
  out["isOwn:" + p.join("/")] = isOwn(...p);
}
for (const k of ["work","blog"]) {
  out["corpusDir:" + k] = rel(corpusDir(k));
  out["corpusFiles:" + k] = corpusFiles(k).slice().sort();
}
console.log(JSON.stringify(out));
`;

const PROBE_PY = `
import json, sys
sys.path.insert(0, ${JSON.stringify(root.split("\\").join("/"))})
from packages.content.paths import corpus_dir, corpus_files, is_demo, is_own, rel, resolve
out = {"isDemo": is_demo()}
for p in [("about","profile.yaml"),("config","site.yaml"),("config","skills.yaml"),("config","fit.yaml"),("config","sources.yaml")]:
    out["resolve:" + "/".join(p)] = rel(resolve(*p))
    out["isOwn:" + "/".join(p)] = is_own(*p)
for k in ("work","blog"):
    out["corpusDir:" + k] = rel(corpus_dir(k))
    out["corpusFiles:" + k] = sorted(f.name for f in corpus_files(k))
print(json.dumps(out))
`;

/* No `shell: true`. process.execPath is "C:\Program Files\nodejs\node.exe"
   on Windows, and routing that through cmd.exe splits it at the space. Direct
   spawn resolves both interpreters from PATH fine. */
function run(cmd, args, cwd, env) {
  return spawnSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, ...env } });
}

/* Resolve the interpreter by RUNNING it: on Windows `python3` is the Store
   stub, which exists on PATH and exits non-zero. */
const py = ["python", "python3"].find(
  (c) => spawnSync(`${c} -c "pass"`, { shell: true, stdio: "ignore" }).status === 0,
);
if (!py) {
  console.error("check-parity: no working python interpreter - cannot compare the two resolvers");
  process.exit(2);
}

const failures = [];
let compared = 0;
let answers = 0;

for (const fixture of FIXTURES) {
  const dir = buildFixture(fixture.add);
  try {
    const jsPath = join(dir, "_probe.mjs");
    const pyPath = join(dir, "_probe.py");
    writeFileSync(jsPath, PROBE_JS, "utf8");
    writeFileSync(pyPath, PROBE_PY, "utf8");

    const js = run(process.execPath, [jsPath], dir, { RM_ROOT: dir });
    const pyOut = run(py, [pyPath], dir, { RM_ROOT: dir });

    if (js.status !== 0) { failures.push(`${fixture.name}: node probe failed\n${js.stderr}`); continue; }
    if (pyOut.status !== 0) { failures.push(`${fixture.name}: python probe failed\n${pyOut.stderr}`); continue; }

    const a = JSON.parse(js.stdout);
    const b = JSON.parse(pyOut.stdout);
    compared++;
    answers = Object.keys(a).length;

    for (const key of Object.keys(a)) {
      const x = JSON.stringify(a[key]);
      const y = JSON.stringify(b[key]);
      if (x !== y) {
        failures.push(`${fixture.name}: ${key} — node says ${x}, python says ${y}`);
      }
    }
    if (verbose) console.log(`  ${fixture.name}: ${Object.keys(a).length} answers agree`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (failures.length) {
  console.error("check-parity: FAILED — the two content resolvers disagree");
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    "\n  Fix the divergence, do not adjust this test. Two readers of one fact is how\n" +
      "  four separate bugs got into this repo; see the header of this file.",
  );
  process.exit(1);
}

console.log(
  `check-parity: ok (paths.py and content-paths.mjs agree on ${answers} answers across ${compared} adopter states)`,
);
