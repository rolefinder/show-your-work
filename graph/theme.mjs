/** Resolve any CSS color syntax via off-screen canvas readback (oklch-safe). */

function resolveCssColor(doc, value, fallback) {
  if (!value) return fallback;
  if (value.startsWith("#")) return value;
  try {
    const canvas = resolveCssColor._c || (resolveCssColor._c = doc.createElement("canvas"));
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillStyle = value;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    if (d[3] === 0) return fallback.startsWith("#") ? fallback : "#d4d4d4";
    const hex = (v) => v.toString(16).padStart(2, "0");
    return `#${hex(d[0])}${hex(d[1])}${hex(d[2])}`;
  } catch {
    return fallback.startsWith("#") ? fallback : "#d4d4d4";
  }
}

export function readTheme(host) {
  const root =
    host.closest(".pg-page") ||
    host.closest(".kg-lens") ||
    host.closest(".work-graph-viewport") ||
    host;
  const s = getComputedStyle(root);
  const doc = host.ownerDocument || document;
  const v = (name, fb) => resolveCssColor(doc, s.getPropertyValue(name).trim() || fb, fb);
  return {
    canvas: v("--pg-canvas-bg", "#1e1e1e"),
    node: v("--pg-node", "#d4d4d4"),
    pro: v("--pg-pro", "#7aa2f7"),
    personal: v("--pg-personal", "#9ece6a"),
    skill: v("--pg-skill", "#e0af68"),
    post: v("--pg-post", "#bb9af7"),
    here: v("--pg-here", "#f7768e"),
    orphan: v("--pg-orphan", "#565f89"),
    link: v("--pg-link", "#414868"),
  };
}
