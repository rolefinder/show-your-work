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
  globalName: "SYWPortfolioGraphBundle",
  platform: "browser",
  target: ["es2020"],
  minify: true,
  // This file is a committed redistribution of Graphology, ForceAtlas2 and
  // Sigma, all MIT. Their published dists carry no license banners today, so
  // attribution lives in THIRD-PARTY-NOTICES.md — but "none" would silently
  // drop a banner the day one of them starts shipping it. "eof" keeps any such
  // notice in the artifact, at the end, out of the hot path.
  legalComments: "eof",
  logLevel: "info",
});

writeFileSync(
  join(outDir, "graph-engine.version"),
  new Date().toISOString().slice(0, 10) + "\n",
  "utf8",
);

const src = readFileSync(outFile, "utf8");
if (!src.includes("SYWPortfolioGraph")) {
  console.error("graph-engine.js missing SYWPortfolioGraph export");
  process.exit(1);
}
console.log("built assets/graph-engine.js");
