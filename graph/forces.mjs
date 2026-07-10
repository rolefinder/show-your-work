/**
 * Typed force overrides for the portfolio graph engine.
 * Callers pass `opts.forces` — never read window globals (multi-instance safe).
 */

/** @typedef {{
 *   gravity?: number,
 *   scalingRatio?: number,
 *   hubPull?: number,
 *   macroRingBase?: number,
 * }} PortfolioGraphForces */

/** @type {Required<PortfolioGraphForces>} */
export const DEFAULT_FORCES = {
  gravity: 0.55,
  scalingRatio: 12,
  hubPull: 0.38,
  macroRingBase: 220,
};

/** @type {Required<PortfolioGraphForces>} */
export const COMPACT_FORCES = {
  gravity: 0.35,
  scalingRatio: 30,
  hubPull: 0.26,
  macroRingBase: 0,
};

/**
 * @param {{ compact?: boolean, forces?: PortfolioGraphForces, hubPull?: number, macroRingBase?: number }} opts
 * @returns {Required<PortfolioGraphForces>}
 */
export function resolveForces(opts) {
  const base = opts.compact ? COMPACT_FORCES : DEFAULT_FORCES;
  const f = opts.forces || {};
  return {
    gravity: f.gravity != null ? f.gravity : base.gravity,
    scalingRatio: f.scalingRatio != null ? f.scalingRatio : base.scalingRatio,
    hubPull:
      opts.hubPull != null
        ? opts.hubPull
        : f.hubPull != null
          ? f.hubPull
          : base.hubPull,
    macroRingBase:
      opts.macroRingBase != null
        ? opts.macroRingBase
        : f.macroRingBase != null
          ? f.macroRingBase
          : base.macroRingBase,
  };
}
