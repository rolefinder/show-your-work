/**
 * Build a Graphology model + ForceAtlas2 layout from {nodes, edges}.
 * Forces come only from resolveForces(opts) — no window globals.
 */
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { resolveForces } from "./forces.mjs";

export const PG_LAYER_IDS = ["related", "skills", "writing"];

function nodeColor(meta, theme, hot) {
  if (hot) return theme.here;
  if (meta.orphan) return theme.orphan;
  if (meta.kind === "skill") return theme.skill;
  if (meta.kind === "post") return theme.post;
  if (meta.kind === "page" || meta.kind === "focus") return theme.node;
  return meta.pro ? theme.pro : theme.personal;
}

function nodeSize(meta, degree, compact) {
  const u = compact ? 0.9 : 1.15;
  const r = degree || 0;
  const minS = 3.2;
  const maxS = 9.6;
  const f = Math.min(1, Math.log(1 + r) / Math.log(13));
  return (minS + (maxS - minS) * f) * u;
}

function filterView(nodes, edges, opts) {
  const layers = opts.layers || { related: true, skills: true, writing: true };
  const contextId = opts.contextId || null;
  let viewNodes = nodes.slice();
  let viewEdges = edges.filter((e) => {
    const layer = e.layer || "related";
    return layers[layer] !== false;
  });

  if (contextId) {
    const keep = new Set([contextId]);
    viewEdges.forEach((e) => {
      if (e.source === contextId || e.target === contextId) {
        keep.add(e.source);
        keep.add(e.target);
      }
    });
    // depth-2
    viewEdges.forEach((e) => {
      if (keep.has(e.source) || keep.has(e.target)) {
        keep.add(e.source);
        keep.add(e.target);
      }
    });
    viewNodes = viewNodes.filter((n) => keep.has(n.id));
    const ids = new Set(viewNodes.map((n) => n.id));
    viewEdges = viewEdges.filter((e) => ids.has(e.source) && ids.has(e.target));
  }

  return { viewNodes, viewEdges };
}

/**
 * @param {Array} nodes
 * @param {Array} edges
 * @param {object} opts
 */
export function buildGraphology(nodes, edges, opts) {
  const forces = resolveForces(opts);
  const theme = opts.theme;
  const { viewNodes, viewEdges } = filterView(nodes, edges, opts);

  const degree = {};
  viewEdges.forEach((e) => {
    degree[e.source] = (degree[e.source] || 0) + 1;
    degree[e.target] = (degree[e.target] || 0) + 1;
  });

  // Hub assignment for post-FA2 pull
  const homeHub = new Map();
  viewNodes.forEach((node) => {
    const id = node.id;
    const ownDeg = degree[id] || 0;
    const neighbors = [];
    viewEdges.forEach((e) => {
      if (e.source === id) neighbors.push(e.target);
      if (e.target === id) neighbors.push(e.source);
    });
    let bestHub = null;
    let bestDeg = -1;
    neighbors.forEach((nid) => {
      const dg = degree[nid] || 0;
      const preferProj = nid.startsWith("proj:") && !(bestHub && bestHub.startsWith("proj:"));
      if (dg > bestDeg || (preferProj && dg >= bestDeg - 1)) {
        bestDeg = dg;
        bestHub = nid;
      }
    });
    if (bestHub !== null && (bestDeg > ownDeg || (bestHub.startsWith("proj:") && !id.startsWith("proj:")))) {
      homeHub.set(id, bestHub);
    }
  });

  const clusterOf = new Map();
  viewNodes.forEach((node) => {
    const hub = homeHub.get(node.id) || node.id;
    if (!clusterOf.has(hub)) clusterOf.set(hub, []);
    clusterOf.get(hub).push(node.id);
  });
  const hubs = [...clusterOf.keys()].sort((a, b) => {
    const da = clusterOf.get(a).length;
    const db = clusterOf.get(b).length;
    if (db !== da) return db - da;
    return a < b ? -1 : 1;
  });

  const graph = new Graph({ multi: false, type: "undirected" });
  const macroBase = forces.macroRingBase;
  const seedPos = new Map();
  if (!opts.compact && hubs.length && macroBase > 0) {
    const multi = hubs.filter((h) => (clusterOf.get(h) || []).length >= 2);
    const ringHubs = multi.length >= 2 ? multi : hubs;
    const ringR = macroBase * Math.max(1.05, Math.sqrt(Math.max(ringHubs.length, 2)) * 0.85);
    ringHubs.forEach((hub, hi) => {
      const members = clusterOf.get(hub) || [hub];
      const angle = (hi / ringHubs.length) * Math.PI * 2;
      const hx = Math.cos(angle) * ringR;
      const hy = Math.sin(angle) * ringR;
      seedPos.set(hub, { x: hx, y: hy });
      const sats = members.filter((id) => id !== hub);
      sats.forEach((id, si) => {
        const a = angle + ((si + 1) / (sats.length + 1) - 0.5) * 1.2;
        const r = 18 + (si % 5) * 8;
        seedPos.set(id, { x: hx + Math.cos(a) * r, y: hy + Math.sin(a) * r });
      });
    });
  }

  const n = viewNodes.length || 1;
  const spread = opts.compact ? 280 : 420;
  viewNodes.forEach((node, i) => {
    const seeded = seedPos.get(node.id);
    let x;
    let y;
    if (seeded) {
      x = seeded.x;
      y = seeded.y;
    } else {
      const t = Math.sqrt((i + 0.5) / n);
      const angle = i * Math.PI * (3 - Math.sqrt(5));
      const r = spread * t;
      x = Math.cos(angle) * r;
      y = Math.sin(angle) * r;
    }
    graph.addNode(node.id, {
      label: node.label,
      x,
      y,
      size: nodeSize(node, degree[node.id], opts.compact),
      color: nodeColor(node, theme, false),
      meta: node,
      hidden: false,
      fixed: !degree[node.id],
      zIndex: 2,
    });
  });

  viewEdges.forEach((e) => {
    if (!graph.hasNode(e.source) || !graph.hasNode(e.target)) return;
    const key = e.source + "\u2194" + e.target;
    if (graph.hasEdge(key)) return;
    graph.addEdgeWithKey(key, e.source, e.target, {
      size: e.layer === "writing" || e.inferred ? 0.03 : 0.06,
      color: theme.link,
      inferred: !!e.inferred,
      layoutSkip: !opts.compact && e.layer === "writing",
      zIndex: 0,
    });
  });

  if (graph.order > 1) {
    const order = graph.order;
    const skipped = [];
    if (!opts.compact) {
      graph.forEachEdge((key, attrs, s, t) => {
        if (!attrs.layoutSkip) return;
        skipped.push({ key, s, t, attrs: { ...attrs } });
      });
      skipped.forEach((e) => {
        if (graph.hasEdge(e.key)) graph.dropEdge(e.key);
      });
    }
    forceAtlas2.assign(graph, {
      iterations: Math.min(500, 150 + order * 8),
      settings: {
        gravity: forces.gravity,
        scalingRatio: forces.scalingRatio,
        strongGravityMode: true,
        linLogMode: true,
        outboundAttractionDistribution: true,
        adjustSizes: true,
        barnesHutOptimize: order > 12,
        slowDown: opts.compact ? 2.2 : 2,
      },
    });
    skipped.forEach((e) => {
      if (!graph.hasNode(e.s) || !graph.hasNode(e.t) || graph.hasEdge(e.key)) return;
      graph.addEdgeWithKey(e.key, e.s, e.t, e.attrs);
    });

    const pull = forces.hubPull;
    viewNodes.forEach((node) => {
      const hub = homeHub.get(node.id);
      if (!hub || !graph.hasNode(hub)) return;
      const hx = graph.getNodeAttribute(hub, "x");
      const hy = graph.getNodeAttribute(hub, "y");
      const nx = graph.getNodeAttribute(node.id, "x");
      const ny = graph.getNodeAttribute(node.id, "y");
      graph.setNodeAttribute(node.id, "x", nx + (hx - nx) * pull);
      graph.setNodeAttribute(node.id, "y", ny + (hy - ny) * pull);
    });

    if (!opts.compact && opts.aspect > 1) {
      const stretch = Math.min(2.2, Math.pow(opts.aspect, 0.7));
      graph.forEachNode((id) => {
        graph.setNodeAttribute(id, "x", graph.getNodeAttribute(id, "x") * stretch);
      });
    }
  }

  return { graph, viewNodes, viewEdges, degree, forces };
}
