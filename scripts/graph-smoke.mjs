#!/usr/bin/env node
/**
 * Smoke: graph vendor exists, exposes create + resolveForces, and forces
 * resolve from opts (not window.HHPG_FORCES).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveForces, DEFAULT_FORCES } from "../graph/forces.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = join(root, "assets", "graph-engine.js");

if (!existsSync(bundle)) {
  console.error("FAIL: assets/graph-engine.js missing — run bun run build:graph");
  process.exit(1);
}

const src = readFileSync(bundle, "utf8");
for (const needle of ["SYWPortfolioGraph", "create"]) {
  if (!src.includes(needle)) {
    console.error(`FAIL: bundle missing ${needle}`);
    process.exit(1);
  }
}
if (src.includes("HHPG_FORCES")) {
  console.error("FAIL: bundle still references window.HHPG_FORCES");
  process.exit(1);
}

const custom = resolveForces({ forces: { gravity: 0.9, hubPull: 0.5 } });
if (custom.gravity !== 0.9 || custom.hubPull !== 0.5) {
  console.error("FAIL: resolveForces did not honor opts.forces", custom);
  process.exit(1);
}
const compact = resolveForces({ compact: true });
if (compact.scalingRatio !== 30) {
  console.error("FAIL: compact forces wrong", compact);
  process.exit(1);
}
const plain = resolveForces({});
if (plain.gravity !== DEFAULT_FORCES.gravity) {
  console.error("FAIL: default forces wrong", plain);
  process.exit(1);
}

console.log("graph-smoke ok", {
  bundleBytes: src.length,
  gravity: custom.gravity,
  compactScaling: compact.scalingRatio,
});
