/**
 * Sigma.js orchestration — create / update / destroy.
 * Public API: window.RMPortfolioGraph.create(host, opts)
 */
import Sigma from "sigma";
import { NodeCircleProgram, EdgeLineProgram } from "sigma/rendering";
import { buildGraphology, PG_LAYER_IDS } from "./layout.mjs";
import { readTheme } from "./theme.mjs";
import { resolveForces } from "./forces.mjs";

function fitCamera(sigma, graph, compact) {
  if (!sigma || !graph || graph.order === 0) return;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  graph.forEachNode((id) => {
    const x = graph.getNodeAttribute(id, "x");
    const y = graph.getNodeAttribute(id, "y");
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  });
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const w = Math.max(maxX - minX, 40);
  const h = Math.max(maxY - minY, 40);
  const camera = sigma.getCamera();
  const { width, height } = sigma.getDimensions();
  const pad = compact ? 1.35 : 1.2;
  const ratio = Math.max((w * pad) / Math.max(width, 1), (h * pad) / Math.max(height, 1));
  // Sigma v3 framed space: normalize graph coords into camera x/y ∈ ~[0,1]
  camera.setState({ x: 0.5, y: 0.5, ratio: Math.max(ratio, 0.08), angle: 0 });
  // Re-center using graph→viewport mapping after first paint
  try {
    const gp = sigma.graphToViewport({ x: cx, y: cy });
    const midX = width / 2;
    const midY = height / 2;
    const dx = (midX - gp.x) / width;
    const dy = (midY - gp.y) / height;
    const cur = camera.getState();
    camera.setState({ ...cur, x: cur.x - dx * cur.ratio, y: cur.y - dy * cur.ratio });
  } catch {
    /* ignore */
  }
}

/**
 * @param {HTMLElement} container
 * @param {object} opts
 *   nodes, edges, compact?, contextId?, layers?, forces?, onNavigate?, preview?
 */
export function createPortfolioGraph(container, opts) {
  if (!container) throw new Error("RMPortfolioGraph.create: container required");

  const state = {
    compact: !!opts.compact,
    preview: !!opts.preview,
    contextId: opts.contextId || null,
    layers: { related: true, skills: true, writing: true, ...(opts.layers || {}) },
    selected: null,
    hovered: null,
    forces: resolveForces(opts),
  };

  container.classList.add("pg-host");
  container.innerHTML = "";
  let theme = readTheme(container);
  container.style.background = theme.canvas;
  container.style.position = container.style.position || "relative";

  const glow = document.createElement("div");
  glow.className = "pg-node-glow";
  glow.style.cssText =
    "position:absolute;pointer-events:none;opacity:0;width:28px;height:28px;margin:-14px 0 0 -14px;border-radius:50%;background:radial-gradient(circle,rgba(247,118,142,0.55),transparent 70%);z-index:2;transition:opacity .12s";
  container.appendChild(glow);

  const hostAspect = () => {
    const r = container.getBoundingClientRect();
    return r.height > 0 ? r.width / r.height : 1.6;
  };

  let built = buildGraphology(opts.nodes || [], opts.edges || [], {
    compact: state.compact,
    contextId: state.contextId,
    layers: state.layers,
    theme,
    forces: state.forces,
    hubPull: opts.hubPull,
    macroRingBase: opts.macroRingBase,
    aspect: hostAspect(),
  });
  let graph = built.graph;

  const viewMeta = {
    order: graph.order,
    size: graph.size,
    viewNodes: built.viewNodes.length,
    viewEdges: built.viewEdges.length,
  };

  let sigma = new Sigma(graph, container, {
    allowInvalidContainer: true,
    renderLabels: !state.compact,
    labelFont: "Segoe UI, sans-serif",
    labelSize: 11,
    labelWeight: "500",
    labelColor: { color: "#c0caf5" },
    defaultDrawNodeHover: () => {},
    nodeProgramClasses: { circle: NodeCircleProgram },
    edgeProgramClasses: { line: EdgeLineProgram },
  });

  const applyReducers = () => {
    const hot = state.hovered || state.selected;
    const neighbor = new Set();
    if (hot && graph.hasNode(hot)) {
      neighbor.add(hot);
      graph.forEachNeighbor(hot, (nb) => neighbor.add(nb));
    }
    sigma.setSetting("nodeReducer", (node, data) => {
      const meta = data.meta || {};
      const isHot = hot && (node === hot || neighbor.has(node));
      const dim = hot && !isHot;
      return {
        ...data,
        color: dim ? theme.orphan : nodeColorSafe(meta, theme, isHot && node === hot),
        label: state.compact && !isHot ? "" : data.label,
        zIndex: isHot ? 4 : 2,
        size: data.size * (isHot && node === hot ? 1.25 : 1),
        hidden: false,
        forceLabel: !!isHot,
      };
    });
    sigma.setSetting("edgeReducer", (edge, data) => {
      if (!hot) return data;
      const [a, b] = graph.extremities(edge);
      const keep = neighbor.has(a) && neighbor.has(b);
      return { ...data, hidden: !keep, color: keep ? theme.here : data.color };
    });
    sigma.refresh();
  };

  function nodeColorSafe(meta, th, hot) {
    if (hot) return th.here;
    if (meta.orphan) return th.orphan;
    if (meta.kind === "skill") return th.skill;
    if (meta.kind === "post") return th.post;
    if (meta.kind === "page" || meta.kind === "focus") return th.node;
    return meta.pro ? th.pro : th.personal;
  }

  function positionGlow(nodeId) {
    if (!nodeId || !graph.hasNode(nodeId)) {
      glow.style.opacity = "0";
      return;
    }
    try {
      const attrs = graph.getNodeAttributes(nodeId);
      const p = sigma.graphToViewport({ x: attrs.x, y: attrs.y });
      glow.style.left = p.x + "px";
      glow.style.top = p.y + "px";
      glow.style.opacity = "1";
    } catch {
      glow.style.opacity = "0";
    }
  }

  const guard = (name, fn) => (ev) => {
    try {
      fn(ev);
    } catch (err) {
      console.warn("[RMPortfolioGraph]", name, err);
    }
  };

  let isDragging = false;
  let dragNode = null;
  let dragMoved = false;

  sigma.on(
    "enterNode",
    guard("enterNode", ({ node }) => {
      state.hovered = node;
      applyReducers();
      positionGlow(node);
    }),
  );
  sigma.on(
    "leaveNode",
    guard("leaveNode", () => {
      state.hovered = null;
      applyReducers();
      glow.style.opacity = "0";
    }),
  );
  sigma.getCamera().on(
    "updated",
    guard("camera", () => {
      if (state.hovered) positionGlow(state.hovered);
    }),
  );

  if (!state.preview && opts.onNavigate) {
    sigma.on(
      "clickNode",
      guard("clickNode", ({ node }) => {
        if (dragMoved) {
          dragMoved = false;
          return;
        }
        const meta = graph.getNodeAttributes(node).meta;
        if (!meta) return;
        state.selected = node;
        applyReducers();
        opts.onNavigate(meta);
      }),
    );
  }

  sigma.on(
    "doubleClickStage",
    guard("dbl", () => fitCamera(sigma, graph, state.compact)),
  );

  sigma.on(
    "downNode",
    guard("downNode", ({ node }) => {
      isDragging = true;
      dragNode = node;
      dragMoved = false;
    }),
  );
  sigma.getMouseCaptor().on(
    "mousemovebody",
    guard("drag", (ev) => {
      if (!isDragging || !dragNode) return;
      dragMoved = true;
      const pos = sigma.viewportToGraph(ev);
      const ox = graph.getNodeAttribute(dragNode, "x");
      const oy = graph.getNodeAttribute(dragNode, "y");
      const dx = pos.x - ox;
      const dy = pos.y - oy;
      graph.setNodeAttribute(dragNode, "x", pos.x);
      graph.setNodeAttribute(dragNode, "y", pos.y);
      graph.forEachNeighbor(dragNode, (nb) => {
        graph.setNodeAttribute(nb, "x", graph.getNodeAttribute(nb, "x") + dx * 0.55);
        graph.setNodeAttribute(nb, "y", graph.getNodeAttribute(nb, "y") + dy * 0.55);
      });
      if (ev.preventSigmaDefault) ev.preventSigmaDefault();
    }),
  );
  sigma.getMouseCaptor().on(
    "mouseup",
    guard("mouseup", () => {
      isDragging = false;
      dragNode = null;
    }),
  );

  applyReducers();
  fitCamera(sigma, graph, state.compact);

  const rebuild = () => {
    state.hovered = null;
    glow.style.opacity = "0";
    theme = readTheme(container);
    container.style.background = theme.canvas;
    built = buildGraphology(opts.nodes || [], opts.edges || [], {
      compact: state.compact,
      contextId: state.contextId,
      layers: state.layers,
      theme,
      forces: state.forces,
      hubPull: opts.hubPull,
      macroRingBase: opts.macroRingBase,
      aspect: hostAspect(),
    });
    graph = built.graph;
    viewMeta.order = graph.order;
    viewMeta.size = graph.size;
    viewMeta.viewNodes = built.viewNodes.length;
    viewMeta.viewEdges = built.viewEdges.length;
    sigma.setGraph(graph);
    applyReducers();
    fitCamera(sigma, graph, state.compact);
  };

  const refit = () => {
    sigma.resize();
    fitCamera(sigma, graph, state.compact);
  };

  return {
    stats: () => ({ ...viewMeta, forces: { ...state.forces } }),
    resize() {
      refit();
    },
    zoomBy(factor) {
      if (!sigma || !factor) return;
      const camera = sigma.getCamera();
      const cur = camera.getState();
      camera.animate({ ...cur, ratio: cur.ratio / factor }, { duration: 150 });
    },
    resetLayout() {
      rebuild();
    },
    fitView() {
      refit();
    },
    update(patch) {
      let dirty = false;
      if (patch.layers) {
        state.layers = { ...state.layers, ...patch.layers };
        dirty = true;
      }
      if (patch.contextId !== undefined) {
        state.contextId = patch.contextId;
        dirty = true;
      }
      if (patch.compact !== undefined) {
        state.compact = !!patch.compact;
        dirty = true;
      }
      if (patch.forces) {
        state.forces = resolveForces({ ...opts, compact: state.compact, forces: { ...state.forces, ...patch.forces } });
        dirty = true;
      }
      if (patch.nodes) {
        opts.nodes = patch.nodes;
        dirty = true;
      }
      if (patch.edges) {
        opts.edges = patch.edges;
        dirty = true;
      }
      if (patch.selectedId !== undefined) state.selected = patch.selectedId || null;
      if (dirty) rebuild();
      else applyReducers();
    },
    destroy() {
      try {
        [...container.querySelectorAll("canvas")].forEach((c) => {
          const gl = c.getContext("webgl") || c.getContext("webgl2");
          const ext = gl && gl.getExtension("WEBGL_lose_context");
          if (ext) ext.loseContext();
        });
      } catch {
        /* ignore */
      }
      glow.remove();
      sigma.kill();
      sigma = null;
      graph = null;
    },
  };
}

export { PG_LAYER_IDS, resolveForces };
