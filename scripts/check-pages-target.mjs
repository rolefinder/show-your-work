/**
 * `bun run pages:check` — will this actually serve at the root on GitHub Pages?
 *
 * Every asset in the document is referenced absolutely (`/app.js`,
 * `/styles.css`, `/assets/...`) and the client router reads
 * `window.location.pathname` raw. A project site published at
 * `<owner>.github.io/<repo>/` therefore 404s on every stylesheet and script,
 * and the router never matches a route. The page loads; it is blank.
 *
 * recruit-me supports the root path only, which is also the right shape for a
 * portfolio. That means one of:
 *
 *   - the repository is named `<owner>.github.io`, or
 *   - `deploy.custom_domain` is set, which emits dist/CNAME.
 *
 * This runs in preflight AND in the deploy workflow, because the workflow is
 * the last point before something becomes public.
 *
 * Usage: node scripts/check-pages-target.mjs [--help]
 * Exit 0 = will serve at the root (or target is not GitHub Pages) | 1 = will not.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isDemo, rel, resolve } from "./lib/content-paths.mjs";
import { nested as yNested, scalar as yScalar } from "./lib/yaml-lite.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?/, ""));
  process.exit(0);
}

/* Read site.yaml, NOT src/generated/content.ts.
   `init` writes YAML and does not run the emitter, so on the very common
   `init` then `pages:setup` path the generated module still says demo: true
   and carries the demo origin. Reading it there would skip this check exactly
   when it first starts to matter, and could enable Pages on a subpath repo.
   Config's source of truth is the YAML; that is what this must see.

   Parsed by scripts/lib/yaml-lite.mjs, which is the ONLY minimal YAML reader
   in the Node gates. This file used to carry its own, and it disagreed with
   check-ready.mjs about inline comments.

   Resolved, not hardcoded: content/config/site.yaml does not exist until an
   adopter adds it, and until then the demo's is what the build uses. */
const sitePath = resolve("config", "site.yaml");
const siteYaml = readFileSync(sitePath, "utf8");

const target = yNested(siteYaml, "deploy", "target") || "github-pages";

/* While this is still the template it is not somebody's site: the repo is
   named recruit-me and origin is example.com, both correctly. Enforcing the
   root-path rule here would fail the template's own test run forever. Adding
   content/about/profile.yaml is exactly the moment the rule starts to matter
   (ADR 021). */
const stillTemplate = isDemo();

/**
 * `--deploy-guard`: answer "should the deploy workflow run at all?" in
 * GITHUB_OUTPUT form, and nothing else.
 *
 * The workflow used to decide this with its own
 * `grep -Eq '^demo:[[:space:]]*(true|yes|on)[[:space:]]*$' content/config/site.yaml`.
 * Two readers of one fact is two chances to disagree, and they did:
 * `demo: "true"`, `demo: True` and a trailing `# comment` all evaded that
 * anchored, case-sensitive pattern while this file read them as true — so the
 * workflow would have deployed a placeholder site while the root-path check
 * inside it skipped.
 *
 * ADR 021 then removed the `demo:` key outright, and content/config/site.yaml
 * does not exist at all until an adopter adds it — so that grep would now hit
 * a missing file, exit 2, and let the TEMPLATE repo deploy itself. One reader,
 * and it is the one that already owns the question.
 */
if (process.argv.includes("--deploy-guard")) {
  console.log(`deploy=${stillTemplate ? "false" : "true"}`);
  process.exit(0);
}

if (target !== "github-pages") {
  console.log(`check-pages-target: skipped (deploy.target is ${target})`);
  process.exit(0);
}

if (stillTemplate) {
  console.log(
    `check-pages-target: skipped (no content/about/profile.yaml yet, so this is still the ` +
      `template — config is coming from ${rel(sitePath)})`,
  );
  process.exit(0);
}

/** owner/repo, from Actions if we are in it, otherwise from the git remote. */
function repoSlug() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  const r = spawnSync("git", ["remote", "get-url", "origin"], { cwd: root, encoding: "utf8" });
  if (r.status !== 0) return null;
  const m = r.stdout.trim().match(/[:/]([^/:]+)\/([^/]+?)(?:\.git)?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

const slug = repoSlug();
const customDomain = yNested(siteYaml, "deploy", "custom_domain");
const origin = yScalar(siteYaml, "origin");

/* Hostnames are case-insensitive, so every comparison below is made on a
   lowercased host. `https://Octocat.github.io` is the same site as
   `https://octocat.github.io`, and failing on that would be the check being
   wrong rather than the config. */
const originHost = origin.replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase();

const errors = [];
const notes = [];

if (customDomain) {
  notes.push(`custom domain ${customDomain} — dist/CNAME is emitted, so the site serves at the root`);
  // A CNAME that disagrees with `origin` means every canonical URL, the
  // sitemap and every OG image URL point at a host the site is not on.
  if (originHost && originHost !== customDomain.toLowerCase()) {
    errors.push(
      `deploy.custom_domain is ${customDomain} but origin is ${origin} — canonical URLs, ` +
        "the sitemap and every OG image URL would point at a different host than the site is served from",
    );
  }
} else if (!slug) {
  errors.push(
    "cannot determine the repository (no GITHUB_REPOSITORY and no git remote), so the " +
      "root-path requirement cannot be verified — set deploy.custom_domain, or run this inside the repo",
  );
} else {
  const [owner, repo] = slug.split("/");
  const userSite = `${owner.toLowerCase()}.github.io`;
  if (repo.toLowerCase() !== userSite) {
    errors.push(
      `${slug} would publish to https://${owner.toLowerCase()}.github.io/${repo}/, a subpath. ` +
        "recruit-me serves at the root only: every asset href is absolute, so the deployed page " +
        "would load blank.\n" +
        `      Fix it either way:\n` +
        `        - rename the repository to ${userSite} (Settings -> General -> Repository name), or\n` +
        `        - set deploy.custom_domain in content/config/site.yaml to a domain you own`,
    );
  } else {
    notes.push(`${slug} is a user site, so it publishes at https://${userSite}/`);
    if (originHost !== userSite) {
      errors.push(
        `origin is ${origin} but this repo publishes at https://${userSite} — ` +
          "canonical URLs and the sitemap would point somewhere the site is not",
      );
    }
  }
}

for (const n of notes) console.log(`check-pages-target: ${n}`);

if (errors.length) {
  console.error("check-pages-target: FAILED");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log("check-pages-target: ok (will serve at the root)");
