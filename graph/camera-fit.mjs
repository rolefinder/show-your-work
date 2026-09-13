/**
 * Sigma v3 camera fit.
 *
 * Camera x/y are framedGraph coordinates: the graph bbox is normalized so
 * the full layout sits in ~[0, 1], and ratio 1 shows that bbox in the
 * viewport. Smaller ratio zooms in; larger ratio adds padding around it.
 *
 * A previous helper computed ratio from graph-pixels / viewport-pixels and
 * then recentered with graphToViewport. That mixed two coordinate systems,
 * so the graph opened zoomed into empty space and "fit" did the same thing.
 */

export const FIT_PAD_FULL = 1.2;
export const FIT_PAD_COMPACT = 1.35;

/**
 * @param {boolean} [compact]
 * @returns {{ x: number, y: number, ratio: number, angle: number }}
 */
export function framedFitState(compact) {
  return {
    x: 0.5,
    y: 0.5,
    ratio: compact ? FIT_PAD_COMPACT : FIT_PAD_FULL,
    angle: 0,
  };
}
