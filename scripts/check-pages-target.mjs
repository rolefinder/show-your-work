/**
 * `npm run pages:check` — will this actually serve at the root on GitHub Pages?
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

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?/, ""));
  process.exit(0);
}

const generated = readFileSync(join(root, "src", "generated", "content.ts"), "utf8");
const value = (key) => {
  const m = generated.match(new RegExp(`\\b${key}:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  return m ? JSON.parse(`"${m[1]}"`) : "";
};

const target = value("deployTarget");
if (target !== "github-pages") {
  console.log(`check-pages-target: skipped (deploy.target is ${target || "unset"})`);
  process.exit(0);
}

/* While demo is true this IS the template, not somebody's site: the repo is
   named recruit-me and origin is example.com, both correctly. Enforcing the
   root-path rule here would fail the template's own test run forever. `init`
   sets demo: false, which is exactly the moment the rule starts to matter. */
if (/\bdemo:\s*true\b/.test(generated)) {
  console.log("check-pages-target: skipped (demo: true — still the template, not a deployment)");
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
const customDomain = value("customDomain");
const origin = value("origin");

const errors = [];
const notes = [];

if (customDomain) {
  notes.push(`custom domain ${customDomain} — dist/CNAME is emitted, so the site serves at the root`);
  // A CNAME that disagrees with `origin` means every canonical URL, the
  // sitemap and every OG image URL point at a host the site is not on.
  const host = origin.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (host && host !== customDomain) {
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
    if (origin.replace(/\/+$/, "") !== `https://${userSite}`) {
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
