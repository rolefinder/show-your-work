/**
 * `npm run additive:check` — the template must stay add-only.
 *
 * The contract: an adopter never edits and never deletes a file this template
 * ships. They add files, and each one takes over from its demo counterpart.
 * That is what makes a fork updatable — there is no merge conflict in a file
 * you never touched — and it is why a half-finished setup produces an
 * INCOMPLETE site rather than a broken one.
 *
 * A contract nothing checks is a comment. This asserts the three structural
 * facts it rests on:
 *
 *   1. The template commits nothing at an adopter path. If `content/config/
 *      site.yaml` shipped, standing up a site would mean editing it, and
 *      pulling template updates would mean resolving conflicts in your own
 *      identity.
 *   2. Every adopter path has a demo counterpart. The fallback has to exist,
 *      or an adopter who has not written that file yet gets a crash instead of
 *      the demo's version.
 *   3. tokens/adopter.css exists and is imported last. It is how a palette
 *      override lands without editing tokens/colors.css.
 *
 * Usage: node scripts/check-additive.mjs [--help]
 * Exit 0 = add-only | 1 = a violation.
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?/, ""));
  process.exit(0);
}

/** Files an adopter may add. Each must have a demo fallback. */
const ADOPTER_FILES = [
  ["about", "profile.yaml"],
  ["config", "site.yaml"],
  ["config", "skills.yaml"],
  ["config", "fit.yaml"],
  ["config", "sources.yaml"],
  ["config", "corpus-guard.yaml"],
];
const CORPORA = ["work", "blog"];

const errors = [];

// ---------- 1. nothing committed at an adopter path ----------
const tracked = spawnSync("git", ["ls-files", "content/"], { cwd: root, encoding: "utf8" });
if (tracked.status === 0) {
  const stray = tracked.stdout
    .split("\n")
    .map((l) => l.trim().split("\\").join("/"))
    .filter(Boolean)
    .filter((p) => !p.startsWith("content/demo/"));
  for (const p of stray) {
    errors.push(
      `${p} is committed at an adopter path. Shipped content belongs under content/demo/, ` +
        "or standing up a site means editing a template file and every update means a conflict",
    );
  }
} else {
  console.warn("check-additive: not a git checkout - skipping the tracked-files rule");
}

// ---------- 2. every adopter path has a demo fallback ----------
for (const parts of ADOPTER_FILES) {
  const demo = join(root, "content", "demo", ...parts);
  if (!existsSync(demo)) {
    errors.push(
      `content/demo/${parts.join("/")} is missing — an adopter who has not added ` +
        `content/${parts.join("/")} yet would have nothing to fall back to`,
    );
  }
}
for (const kind of CORPORA) {
  const demo = join(root, "content", "demo", kind);
  if (!existsSync(demo)) {
    errors.push(`content/demo/${kind}/ is missing — the site would have no corpus before you add one`);
  }
}

// ---------- 3. the theming escape hatch is wired ----------
const adopterCss = join(root, "tokens", "adopter.css");
if (!existsSync(adopterCss)) {
  errors.push("tokens/adopter.css is missing — a theme: override would have nowhere to land");
} else {
  const manifest = readFileSync(join(root, "tokens", "tokens.css"), "utf8");
  const imports = [...manifest.matchAll(/@import\s+"\.\/([\w-]+\.css)"/g)].map((m) => m[1]);
  if (!imports.includes("adopter.css")) {
    errors.push("tokens/tokens.css does not import adopter.css — a theme: override would never load");
  } else if (imports[imports.length - 1] !== "adopter.css") {
    errors.push(
      `adopter.css must be imported LAST (it is ${imports.indexOf("adopter.css") + 1} of ${imports.length}) — ` +
        "later @imports win on equal specificity, so anything after it overrides the adopter's palette",
    );
  }
}

if (errors.length) {
  console.error("check-additive: FAILED");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(
  `check-additive: ok (nothing committed at an adopter path; ` +
    `${ADOPTER_FILES.length} config fallbacks + ${CORPORA.length} corpora present; theme override wired)`,
);
