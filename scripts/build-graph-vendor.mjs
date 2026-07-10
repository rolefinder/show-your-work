#!/usr/bin/env node
// Bundle Graphology + ForceAtlas2 + Sigma into assets/graph-engine.js (CSP-safe).
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "assets");
const outFile = join(outDir, "graph-engine.js");

mkdirSync(outDir, { recursive: true });

await build({
  entryPoints: [join(root, "graph", "index.mjs")],
  outfile: outFile,
  bundle: true,
  format: "iife",
  globalName: "RMPortfolioGraphBundle",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  legalComments: "none",
  logLevel: "info",
});

writeFileSync(
  join(outDir, "graph-engine.version"),
  new Date().toISOString().slice(0, 10) + "\n",
  "utf8",
);

const src = readFileSync(outFile, "utf8");
if (!src.includes("RMPortfolioGraph")) {
  console.error("graph-engine.js missing RMPortfolioGraph export");
  process.exit(1);
}
console.log("built assets/graph-engine.js");
