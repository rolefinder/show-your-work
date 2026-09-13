#!/usr/bin/env node
/**
 * Smoke: graph vendor exists, exposes create + resolveForces, and forces
 * resolve from opts (not window.HHPG_FORCES).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveForces, DEFAULT_FORCES } from "../graph/forces.mjs";
import { framedFitState, FIT_PAD_FULL, FIT_PAD_COMPACT } from "../graph/camera-fit.mjs";
import { glowDiameter, colorWithAlpha, GLOW_MIN_PX, HOVER_SCALE } from "../graph/hover.mjs";

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

const fullFit = framedFitState(false);
if (fullFit.x !== 0.5 || fullFit.y !== 0.5 || fullFit.angle !== 0) {
  console.error("FAIL: framed fit must center the framed bbox", fullFit);
  process.exit(1);
}
if (fullFit.ratio !== FIT_PAD_FULL || fullFit.ratio <= 1) {
  console.error("FAIL: full-graph fit ratio must zoom out past 1 for padding", fullFit);
  process.exit(1);
}
const compactFit = framedFitState(true);
if (compactFit.ratio !== FIT_PAD_COMPACT || compactFit.ratio <= fullFit.ratio) {
  console.error("FAIL: compact fit needs more padding than the full page", compactFit);
  process.exit(1);
}

if (glowDiameter(0) !== GLOW_MIN_PX || glowDiameter(-1) !== GLOW_MIN_PX) {
  console.error("FAIL: glow diameter must floor at GLOW_MIN_PX", glowDiameter(0));
  process.exit(1);
}
if (glowDiameter(8) < GLOW_MIN_PX) {
  console.error("FAIL: typical node glow must be at least the min hit halo", glowDiameter(8));
  process.exit(1);
}
if (HOVER_SCALE <= 1) {
  console.error("FAIL: hover scale must enlarge the focused node", HOVER_SCALE);
  process.exit(1);
}
const rgba = colorWithAlpha("#f7768e", 0.55);
if (!rgba.startsWith("rgba(") || !rgba.includes("0.55")) {
  console.error("FAIL: colorWithAlpha must emit rgba for canvas fill", rgba);
  process.exit(1);
}

const engineSrc = readFileSync(join(root, "graph", "engine.mjs"), "utf8");
if (!engineSrc.includes('itemSizesReference: "screen"')) {
  console.error("FAIL: graph engine must keep node hit targets screen-sized after fit");
  process.exit(1);
}
if (engineSrc.includes("pg-node-glow") || engineSrc.includes("graphToViewport")) {
  console.error("FAIL: DOM glow / graphToViewport hover path returned — use canvas drawNodeGlow");
  process.exit(1);
}

const graphCss = readFileSync(join(root, "tokens", "graph.css"), "utf8");
if (!graphCss.includes("canvas.sigma-mouse") || !graphCss.includes("position: absolute")) {
  console.error("FAIL: graph.css must overlay Sigma canvases; inline styles are CSP-blocked");
  process.exit(1);
}

console.log("graph-smoke ok", {
  bundleBytes: src.length,
  gravity: custom.gravity,
  compactScaling: compact.scalingRatio,
  fitRatio: fullFit.ratio,
});
