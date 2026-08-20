#!/usr/bin/env node
/**
 * `npm run layout:check` — the repo's top-level shape matches the tree in
 * ARCHITECTURE.md, and no junk is committed.
 *
 * Agents are a primary contributor here, and a prose directory map is exactly
 * the kind of fact that drifts: someone adds a top-level directory, nothing
 * fails, and six weeks later the map describes a tree that no longer exists.
 * A second agent then cannot tell whether a directory is intentional or
 * leftover.
 *
 * ONE READER. The documented tree in ARCHITECTURE.md is the schema — this
 * parses it rather than keeping a parallel YAML of allowed names, because a
 * separate machine list is a second reader of the same fact and would drift
 * from the prose the same way the prose drifted from the tree. Adding a
 * top-level directory means drawing it in ARCHITECTURE.md, which is where
 * somebody would look for it anyway.
 *
 * Undocumented or missing directory -> exit 1. Committed junk -> exit 1.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/* Documented but never committed — the build writes it, .gitignore hides it.
   Listed so its presence in the tree is not read as an undocumented dir. */
const GENERATED = new Set(["dist"]);

/* Committed junk: scratch files that were never meant to ship. */
const JUNK = /(^|\/)(_tmp_|tmp_)|\.(tmp|orig|rej|bak)$|(^|\/)\.DS_Store$/;

const failures = [];

/* --- the documented tree -------------------------------------------------- */

const architecture = readFileSync(join(root, "ARCHITECTURE.md"), "utf8");
const section = architecture.match(/^## Directory structure$([\s\S]*?)^---$/m);
if (!section) {
  console.error("FAIL: ARCHITECTURE.md has no '## Directory structure' section to read");
  process.exit(1);
}

/* Only the top level: lines starting at column 0 with a branch glyph, naming
   a directory. Nested entries are indented under a │ and are not asserted —
   this gate is about the shape, not every file. */
const documented = new Set(
  [...section[1].matchAll(/^[├└]── ([A-Za-z0-9._-]+)\//gm)].map((m) => m[1]),
);

if (!documented.size) {
  console.error("FAIL: parsed the directory-structure section but found no top-level entries — the tree format changed");
  process.exit(1);
}

/* --- what is actually committed ------------------------------------------ */

const tracked = execSync("git ls-files", { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);

const actual = new Set(tracked.filter((f) => f.includes("/")).map((f) => f.split("/")[0]));

for (const dir of [...actual].sort()) {
  if (!documented.has(dir)) {
    failures.push(
      `${dir}/ is committed but not in ARCHITECTURE.md's directory tree — draw it there, or move the files somewhere already documented`,
    );
  }
}

for (const dir of [...documented].sort()) {
  if (!actual.has(dir) && !GENERATED.has(dir)) {
    failures.push(`ARCHITECTURE.md documents ${dir}/ but nothing is committed there — the tree is describing a directory that no longer exists`);
  }
}

/* --- junk ----------------------------------------------------------------- */

for (const file of tracked) {
  if (JUNK.test(file)) failures.push(`${file} looks like scratch output and should not be committed`);
}

if (failures.length) {
  console.error("check-layout: FAILED");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `check-layout: ok (${actual.size} top-level directories, all documented in ARCHITECTURE.md; no committed junk)`,
);
