/**
 * Hover feedback for the portfolio graph.
 *
 * Sigma's default hover is a white label pill — unreadable on the dark
 * canvas — and a DOM glow with inline styles is stripped by `style-src
 * 'self'`. Canvas 2d fill is not a stylesheet, so the glow lives here.
 *
 * `itemSizesReference: "screen"` (set in engine.mjs) is the other half:
 * default sizing shrinks nodes when the camera is zoomed out to fit, and
 * the hit targets go with them. Screen-referenced sizes stay clickable.
 */

export const HOVER_SCALE = 1.55;
export const LABEL_HIDE_THRESHOLD = 999;
export const GLOW_MIN_PX = 34;
export const GLOW_SIZE_FACTOR = 8.5;

/**
 * @param {number} nodeSize  display size in pixels
 * @returns {number} glow diameter in pixels
 */
export function glowDiameter(nodeSize) {
  const n = Number(nodeSize);
  if (!Number.isFinite(n) || n <= 0) return GLOW_MIN_PX;
  return Math.max(GLOW_MIN_PX, n * GLOW_SIZE_FACTOR);
}

/**
 * Theme colors from readTheme() are #rrggbb. Canvas fillStyle accepts rgba().
 * @param {string} hex
 * @param {number} alpha
 * @returns {string}
 */
export function colorWithAlpha(hex, alpha) {
  const a = Number(alpha);
  const alphaCh = Number.isFinite(a) ? Math.min(1, Math.max(0, a)) : 1;
  const h = String(hex || "").trim();
  const m = h.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return `rgba(255,255,255,${alphaCh})`;
  let r;
  let g;
  let b;
  if (m[1].length === 3) {
    r = parseInt(m[1][0] + m[1][0], 16);
    g = parseInt(m[1][1] + m[1][1], 16);
    b = parseInt(m[1][2] + m[1][2], 16);
  } else {
    r = parseInt(m[1].slice(0, 2), 16);
    g = parseInt(m[1].slice(2, 4), 16);
    b = parseInt(m[1].slice(4, 6), 16);
  }
  return `rgba(${r},${g},${b},${alphaCh})`;
}

/**
 * Radial glow under the hovered node. Labels stay on Sigma's label layer
 * (`forceLabel`); this only paints the halo.
 *
 * @param {CanvasRenderingContext2D} context
 * @param {{ x: number, y: number, size: number }} data
 * @param {string} glowColor  #rrggbb
 */
export function drawNodeGlow(context, data, glowColor) {
  if (!context || !data) return;
  const radius = glowDiameter(data.size) / 2;
  const inner = Math.max(1, data.size * 0.35);
  const grd = context.createRadialGradient(data.x, data.y, inner, data.x, data.y, radius);
  grd.addColorStop(0, colorWithAlpha(glowColor, 0.55));
  grd.addColorStop(0.45, colorWithAlpha(glowColor, 0.22));
  grd.addColorStop(1, colorWithAlpha(glowColor, 0));
  context.save();
  context.fillStyle = grd;
  context.beginPath();
  context.arc(data.x, data.y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}
