/**
 * `npm run pages:setup` — point GitHub Pages at the deploy workflow, over the
 * API, so nobody has to visit a settings page.
 *
 * Built to be driven by an agent, which means two properties matter more than
 * convenience:
 *
 *   1. **It never prompts and never touches a credential.** Authentication is
 *      the human's, through `gh auth login`, in their own terminal. This
 *      script only ever asks `gh` whether that already happened. An agent that
 *      types a password or pastes a token has done something it must not do,
 *      so the capability is simply absent here.
 *   2. **Exit codes separate "broken" from "needs a human".** 2 means stop and
 *      hand back with a specific instruction; 1 means something actually
 *      failed. An agent branches on that instead of parsing prose.
 *
 * Idempotent: enabling Pages twice is a no-op, not an error.
 *
 * Usage:
 *   node scripts/setup-github-pages.mjs [--repo owner/name] [--dry-run] [--json]
 *
 * Exit 0 = configured | 1 = failed | 2 = needs the human.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?/, ""));
  process.exit(0);
}

const dryRun = args.includes("--dry-run");
const asJson = args.includes("--json");
const repoFlag = args.indexOf("--repo");
const repoArg = repoFlag >= 0 ? args[repoFlag + 1] : null;

const steps = [];
const record = (step, detail) => {
  steps.push({ step, detail });
  if (!asJson) console.log(`pages:setup: ${detail}`);
};

/** Stop with an instruction the human runs themselves. */
function needsHuman(reason, action) {
  const payload = { ok: false, needsHuman: true, reason, action, steps };
  if (asJson) console.log(JSON.stringify(payload, null, 2));
  else {
    console.error(`pages:setup: NEEDS YOU — ${reason}`);
    console.error(`  run this yourself, then re-run pages:setup:\n    ${action}`);
  }
  process.exit(2);
}

function fail(message) {
  if (asJson) console.log(JSON.stringify({ ok: false, needsHuman: false, error: message, steps }, null, 2));
  else console.error(`pages:setup: FAILED — ${message}`);
  process.exit(1);
}

const run = (cmd, cmdArgs) =>
  spawnSync(cmd, cmdArgs, { cwd: root, encoding: "utf8", shell: process.platform === "win32" });

// ---------- 1. the CLI ----------
if (run("gh", ["--version"]).status !== 0) {
  needsHuman(
    "the GitHub CLI (gh) is not installed",
    "install it from https://cli.github.com, then: gh auth login",
  );
}

// ---------- 2. authentication ----------
/* `gh auth status` writes to stderr on both success and failure, so the exit
   code is the signal, not the stream. `--active` matters: gh supports several
   signed-in accounts and prints a Token scopes line for each, so reading the
   first one would report a different account's scopes than the one about to
   be used. */
const auth = run("gh", ["auth", "status", "--active"]);
if (auth.status !== 0) {
  needsHuman(
    "you are not signed in to the GitHub CLI",
    "gh auth login --scopes repo,workflow",
  );
}

/* Pushing .github/workflows/ requires the `workflow` scope, and enabling Pages
   requires `repo`. Missing either surfaces later as an opaque 403 on push or
   on the API call, so check now and name the exact command. */
const scopes = (auth.stderr + auth.stdout).match(/Token scopes:\s*(.+)/)?.[1] ?? "";
const has = (s) => new RegExp(`['"]?\\b${s}\\b['"]?`).test(scopes);
if (scopes && !(has("repo") && has("workflow"))) {
  needsHuman(
    `the signed-in token is missing a scope (has: ${scopes.trim()})`,
    "gh auth refresh --scopes repo,workflow",
  );
}
record("auth", "gh is authenticated with the scopes this needs");

// ---------- 3. which repository ----------
function repoSlug() {
  if (repoArg) return repoArg;
  const view = run("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
  if (view.status === 0 && view.stdout.trim()) return view.stdout.trim();
  return null;
}

const slug = repoSlug();
if (!slug) {
  needsHuman(
    "this directory has no GitHub repository",
    "gh repo create <owner>/<owner>.github.io --private --source=. --remote=origin --push",
  );
}
record("repo", `repository is ${slug}`);

// ---------- 4. will it serve at the root? ----------
/* Enabling Pages on a repo that publishes to a subpath produces a live URL
   that loads a blank page — worse than not deploying, because it looks like it
   worked. Refuse before touching any setting. */
const target = spawnSync(process.execPath, [join(root, "scripts", "check-pages-target.mjs")], {
  cwd: root,
  encoding: "utf8",
  env: { ...process.env, GITHUB_REPOSITORY: slug },
});
if (target.status !== 0) {
  fail(`this repository will not serve at the root:\n${target.stdout}${target.stderr}`);
}
/* Report what the checker actually said, not a summary of it. It skips while
   `demo: true`, and "the site will serve at the root" would be a claim nobody
   verified. */
record("root-path", target.stdout.trim().split("\n").pop().replace(/^check-pages-target:\s*/, ""));

if (dryRun) {
  record("dry-run", "stopping before any change was made");
  if (asJson) console.log(JSON.stringify({ ok: true, dryRun: true, repo: slug, steps }, null, 2));
  process.exit(0);
}

// ---------- 5. enable Pages, building from the workflow ----------
const api = (method, path, body) => {
  const a = ["api", "--method", method, path, "-H", "Accept: application/vnd.github+json"];
  for (const [k, v] of Object.entries(body ?? {})) a.push("-f", `${k}=${v}`);
  return run("gh", a);
};

const create = api("POST", `repos/${slug}/pages`, { build_type: "workflow" });
if (create.status === 0) {
  record("pages", "GitHub Pages enabled, building from the workflow");
} else if (/HTTP 409/.test(create.stderr)) {
  // Already enabled — make sure it builds from the workflow rather than from a
  // branch, which is the state a repo lands in if Pages was turned on by hand.
  const update = api("PUT", `repos/${slug}/pages`, { build_type: "workflow" });
  if (update.status !== 0) fail(`Pages is enabled but could not be switched to workflow builds:\n${update.stderr}`);
  record("pages", "GitHub Pages was already enabled; build source set to the workflow");
} else if (/HTTP 403/.test(create.stderr)) {
  needsHuman(
    `you do not have permission to change Pages settings on ${slug}`,
    `ask an admin of ${slug} to enable Pages with GitHub Actions as the source`,
  );
} else {
  fail(`could not enable Pages:\n${create.stderr}`);
}

// ---------- 6. report where it will live ----------
const site = run("gh", ["api", `repos/${slug}/pages`, "-q", ".html_url"]);
const url = site.status === 0 ? site.stdout.trim() : null;
if (url) record("url", `site will be served at ${url}`);

if (asJson) {
  console.log(JSON.stringify({ ok: true, repo: slug, url, steps }, null, 2));
} else {
  console.log(
    "\npages:setup: done. Push to main (or run the deploy-github-pages workflow) " +
      "and the site builds and publishes itself.",
  );
}
