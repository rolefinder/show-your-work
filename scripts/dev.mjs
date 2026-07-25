/**
 * `npm run dev` — the authoring loop.
 *
 * A full `npm run build` is ~23s, and 59% of that is prerendering, which is a
 * PUBLISH-time concern: nothing you do while writing needs per-route documents
 * or social cards. So this runs the smallest chain that makes a change visible
 * and skips prerender entirely.
 *
 * What each change costs:
 *   content/work|blog/*.yaml   emit → bundle → evidence + fit-config   (~2s)
 *   content/config|about/*     the above, plus emit:artifacts          (~4s)
 *   src/**                     bundle                                  (~1s)
 *   tokens/** · styles.css     straight file copy                      (instant)
 *
 * Identity only changes when site.yaml/profile.yaml do, so emit:artifacts is
 * skipped for ordinary content edits — that's where most of the saving is.
 *
 * The preview server runs the built dist/, so what you see is the real
 * artifact, not a dev-only rendering path.
 */
import { spawn, spawnSync } from "node:child_process";
import { watch, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const PORT = Number(process.env.PORT || 4173);

const run = (cmd) => spawnSync(cmd, { cwd: root, shell: true, stdio: "inherit" }).status === 0;

/** Watched roots → which rebuild tier they trigger. */
const TIERS = {
  identity: ["content/config", "content/about"],
  content: ["content/work", "content/blog"],
  app: ["src"],
  styles: ["tokens", "styles.css"],
};

function rebuild(tier) {
  const started = Date.now();
  let ok = true;

  if (tier === "styles") {
    // No build needed — dist serves these as plain files.
    for (const rel of ["styles.css"]) {
      if (existsSync(join(root, rel))) copyFileSync(join(root, rel), join(dist, rel));
    }
    mkdirSync(join(dist, "tokens"), { recursive: true });
    for (const f of ["tokens.css", "colors.css", "typography.css", "spacing.css",
                     "effects.css", "base.css", "graph.css"]) {
      const from = join(root, "tokens", f);
      if (existsSync(from)) copyFileSync(from, join(dist, "tokens", f));
    }
  } else if (tier === "app") {
    ok = run("npm run bundle");
  } else {
    ok = run("npm run emit") && run("npm run bundle");
    if (ok) ok = run("npm run emit:evidence") && run("npm run emit:fit-config");
    // Identity and the route table only move when config/profile do.
    if (ok && tier === "identity") ok = run("npm run emit:artifacts");
  }

  const ms = Date.now() - started;
  console.log(
    ok
      ? `dev: rebuilt (${tier}) in ${(ms / 1000).toFixed(1)}s — reload the page`
      : `dev: rebuild FAILED (${tier}) after ${(ms / 1000).toFixed(1)}s — fix the error above; watching still active`,
  );
}

function tierFor(changed) {
  const rel = relative(root, changed).split(sep).join("/");
  for (const [tier, roots] of Object.entries(TIERS)) {
    if (roots.some((r) => rel === r || rel.startsWith(r + "/"))) return tier;
  }
  return null;
}

console.log("dev: first build (full, minus prerender)…");
if (!run("npm run emit && npm run typecheck && npm run build:graph && npm run bundle && npm run emit:artifacts && npm run emit:evidence && npm run emit:fit-config")) {
  console.error("dev: initial build failed — fix the error above and re-run");
  process.exit(1);
}

const server = spawn(process.execPath, [join(root, "scripts", "preview.mjs"), "--port", String(PORT)], {
  cwd: root,
  stdio: "inherit",
});
process.on("SIGINT", () => {
  server.kill();
  process.exit(0);
});

/* fs.watch coalescing: editors write a file several times per save, and a
   recursive watch reports each one. Without a debounce a single Ctrl-S can
   kick off three overlapping rebuilds. */
let pending = null;
let timer = null;
const PRIORITY = ["identity", "content", "app", "styles"];

function schedule(tier) {
  pending = pending && PRIORITY.indexOf(pending) < PRIORITY.indexOf(tier) ? pending : tier;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const t = pending;
    pending = null;
    rebuild(t);
  }, 120);
}

/*
 * Each watch root carries the tier to assume when we can't tell what changed.
 * `filename` is nullable — Node documents it as unreliable on some platforms,
 * and it is routinely null when watching a single FILE. Without a fallback,
 * styles.css edits would never fire at all, and a content/ edit would resolve
 * to no tier because only its subdirectories are mapped. content/ falls back
 * to `identity`, the most conservative tier, so an unidentified change there
 * rebuilds everything rather than silently rebuilding nothing.
 */
const WATCH = [
  ["content", "identity"],
  ["src", "app"],
  ["tokens", "styles"],
  ["styles.css", "styles"],
];

for (const [target, fallback] of WATCH) {
  const abs = join(root, target);
  if (!existsSync(abs)) continue;
  watch(abs, { recursive: true }, (_event, filename) => {
    if (filename && filename.includes("generated")) return; // our own output
    const tier = (filename && tierFor(join(abs, filename))) || fallback;
    schedule(tier);
  });
}

console.log(
  `dev: watching content/ src/ tokens/ styles.css — prerender is skipped (run \`npm run build\` before deploying)`,
);
