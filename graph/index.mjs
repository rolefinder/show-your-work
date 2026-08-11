/**
 * CSP-safe portfolio graph engine entry (esbuild IIFE → assets/graph-engine.js).
 * Global: window.SYWPortfolioGraph = { create, layers, resolveForces }
 */
import { createPortfolioGraph, PG_LAYER_IDS, resolveForces } from "./engine.mjs";

if (typeof window !== "undefined") {
  window.SYWPortfolioGraph = {
    create: createPortfolioGraph,
    layers: PG_LAYER_IDS,
    resolveForces,
  };
}

export { createPortfolioGraph, PG_LAYER_IDS, resolveForces };
