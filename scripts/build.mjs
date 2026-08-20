import * as esbuild from "esbuild";
import { cpSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

// Wipe first: prerendered route docs and social cards are named after content
// slugs, so deleting a project would otherwise leave its page and card behind
// in dist/, served for a path no longer in the sitemap. This is the first step
// in `bun run build` that writes to dist/, so nothing downstream is lost.
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await esbuild.build({
  entryPoints: [join(root, "src", "app.tsx")],
  bundle: true,
  format: "iife",
  outfile: join(dist, "app.js"),
  platform: "browser",
  target: ["es2020"],
  jsxFactory: "React.createElement",
  jsxFragment: "React.Fragment",
  external: ["react", "react-dom"],
  logLevel: "info",
});

/** Copy `from` (repo-relative) to `to` (dist-relative). */
function copy(from, to = from) {
  const src = join(root, from);
  const dest = join(dist, to);
  if (!existsSync(src)) return;
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { recursive: true });
}

// public/ is the web root: its contents land at dist/, not dist/public/. These
// are the files an adopter never edits — identity is injected into the copies
// in dist/ by emit-html.ts, so the sources stay templates.
for (const rel of ["index.html", "404.html", "manifest.json", "_headers", "_redirects"]) {
  copy(join("public", rel), rel);
}

// Authored surfaces, copied verbatim: the component layer, the token files it
// reads, and the images/fonts/vendored React.
for (const rel of ["styles.css", "tokens", "assets"]) {
  copy(rel);
}

console.log("bundled dist/app.js + static assets");
