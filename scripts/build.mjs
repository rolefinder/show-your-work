import * as esbuild from "esbuild";
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

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

function copy(rel) {
  const from = join(root, rel);
  const to = join(dist, rel);
  if (!existsSync(from)) return;
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

for (const rel of [
  "index.html",
  "404.html",
  "manifest.json",
  "styles.css",
  "_headers",
  "_redirects",
  "tokens",
  "assets",
]) {
  copy(rel);
}

console.log("bundled dist/app.js + static assets");
