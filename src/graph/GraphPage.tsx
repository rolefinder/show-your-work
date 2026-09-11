import type { KgEdge, KgNode } from "./buildKnowledgeGraph";

export type PortfolioGraphForces = {
  gravity?: number;
  scalingRatio?: number;
  hubPull?: number;
  macroRingBase?: number;
};

export type PortfolioGraphHandle = {
  stats: () => Record<string, unknown>;
  resize: () => void;
  zoomBy: (factor: number) => void;
  resetLayout: () => void;
  fitView: () => void;
  update: (patch: Record<string, unknown>) => void;
  destroy: () => void;
};

export type PortfolioGraphApi = {
  create: (
    host: HTMLElement,
    opts: {
      nodes: KgNode[];
      edges: KgEdge[];
      compact?: boolean;
      contextId?: string | null;
      layers?: Partial<Record<"related" | "skills" | "writing", boolean>>;
      forces?: PortfolioGraphForces;
      onNavigate?: (meta: KgNode) => void;
      preview?: boolean;
    },
  ) => PortfolioGraphHandle;
  layers: string[];
  resolveForces: (opts: {
    compact?: boolean;
    forces?: PortfolioGraphForces;
  }) => Required<PortfolioGraphForces>;
};

declare global {
  interface Window {
    SYWPortfolioGraph?: PortfolioGraphApi;
  }
}

type GraphCanvasProps = {
  nodes: KgNode[];
  edges: KgEdge[];
  forces?: PortfolioGraphForces;
  compact?: boolean;
  layers?: Partial<Record<"related" | "skills" | "writing", boolean>>;
  onNavigate?: (meta: KgNode) => void;
  graphRef?: { current: PortfolioGraphHandle | null };
};

export function GraphCanvas(props: GraphCanvasProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const engineRef = React.useRef<PortfolioGraphHandle | null>(null);
  const layersRef = React.useRef(props.layers);

  React.useEffect(() => {
    const host = hostRef.current;
    const api = window.SYWPortfolioGraph;
    if (!host || !api?.create) return;

    engineRef.current?.destroy();
    engineRef.current = api.create(host, {
      nodes: props.nodes,
      edges: props.edges,
      compact: props.compact,
      layers: props.layers,
      forces: props.forces,
      onNavigate: props.onNavigate,
    });
    if (props.graphRef) props.graphRef.current = engineRef.current;

    const onResize = () => engineRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      engineRef.current?.destroy();
      engineRef.current = null;
      if (props.graphRef) props.graphRef.current = null;
    };
    // Remount when topology identity changes; forces/layers via update below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.nodes, props.edges, props.compact, props.onNavigate]);

  React.useEffect(() => {
    if (!engineRef.current || !props.forces) return;
    engineRef.current.update({ forces: props.forces });
  }, [props.forces]);

  React.useEffect(() => {
    const prev = layersRef.current;
    layersRef.current = props.layers;
    if (!engineRef.current || !props.layers || prev === props.layers) return;
    engineRef.current.update({ layers: props.layers });
  }, [props.layers]);

  return React.createElement("div", {
    ref: hostRef,
    className: props.compact
      ? "pg-host pg-host--lens work-graph-viewport"
      : "pg-host work-graph-viewport",
    role: "img",
    "aria-label":
      "Portfolio knowledge graph. Hover a node to see its neighbors; click to open the page.",
  });
}

/**
 * Compact graph embedded on content pages — how the work connects, shown
 * rather than described, with the full view one link away. Labels appear on
 * hover; the link carries the full-graph affordance.
 *
 * The prerenderer blocks graph-engine.js on non-/graph routes, so this
 * snapshots as an empty host: crawlers get the heading and the link, not a
 * half-initialized canvas.
 */
export function KnowledgeLens(props: {
  nodes: KgNode[];
  edges: KgEdge[];
  onNavigate: (href: string) => void;
}) {
  if (!props.nodes.length) return null;
  return React.createElement(
    "section",
    { className: "knowledge-lens" },
    React.createElement("h2", { className: "knowledge-lens__title" }, "How the work connects"),
    React.createElement(
      "p",
      { className: "muted knowledge-lens__hint" },
      `${props.nodes.length} nodes · ${props.edges.length} edges · `,
      React.createElement(
        "a",
        {
          href: "/graph",
          className: "prose-link",
          onClick: (e: React.MouseEvent) => {
            e.preventDefault();
            props.onNavigate("/graph");
          },
        },
        "open the full graph",
      ),
    ),
    React.createElement(GraphCanvas, {
      nodes: props.nodes,
      edges: props.edges,
      compact: true,
      forces: { gravity: 0.75, scalingRatio: 30, hubPull: 0.4, macroRingBase: 140 },
      onNavigate: (meta) => {
        if (meta.href) props.onNavigate(meta.href);
      },
    }),
  );
}

type GraphPageProps = {
  nodes: KgNode[];
  edges: KgEdge[];
  onNavigate: (href: string) => void;
};

type GraphLayerId = "related" | "skills" | "writing";

const LAYER_LABELS: Record<GraphLayerId, string> = {
  related: "Related work",
  skills: "Skills",
  writing: "Writing",
};

const DEFAULT_LAYERS: Record<GraphLayerId, boolean> = {
  related: true,
  skills: true,
  writing: true,
};

export function GraphPage(props: GraphPageProps) {
  const graphRef = React.useRef<PortfolioGraphHandle | null>(null);
  const [layers, setLayers] = React.useState(DEFAULT_LAYERS);
  const ready = typeof window !== "undefined" && !!window.SYWPortfolioGraph?.create;

  const toggleLayer = (id: GraphLayerId) => {
    setLayers((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (!next.related && !next.skills && !next.writing) return prev;
      return next;
    });
  };

  return React.createElement(
    "section",
    { className: "page pg-page" },
    React.createElement("p", { className: "eyebrow" }, "Knowledge graph"),
    React.createElement("h1", null, "Graph"),
    React.createElement(
      "p",
      { className: "lede" },
      "How published work, skills, and writing connect. Hover a node to see its neighbors. Click a node to open the page.",
    ),
    !ready
      ? React.createElement(
          "p",
          { className: "error" },
          "Graph engine not loaded. Ensure assets/graph-engine.js is built and included in index.html.",
        )
      : null,
    React.createElement(
      "div",
      { className: "graph-toolbar" },
      React.createElement(
        "fieldset",
        { className: "graph-layers" },
        React.createElement("legend", { className: "visually-hidden" }, "Edge layers"),
        (Object.keys(LAYER_LABELS) as GraphLayerId[]).map((id) =>
          React.createElement(
            "label",
            { key: id },
            React.createElement("input", {
              type: "checkbox",
              checked: layers[id],
              onChange: () => toggleLayer(id),
            }),
            LAYER_LABELS[id],
          ),
        ),
      ),
      React.createElement(
        "button",
        {
          type: "button",
          className: "btn secondary",
          onClick: () => graphRef.current?.fitView(),
        },
        "Fit",
      ),
    ),
    React.createElement(
      "ul",
      { className: "graph-legend" },
      [
        ["work", "Work"],
        ["writing", "Writing"],
        ["skill", "Skill"],
      ].map(([kind, label]) =>
        React.createElement(
          "li",
          { key: kind, className: "graph-legend__item" },
          React.createElement("span", {
            className: `graph-legend__swatch graph-legend__swatch--${kind}`,
            "aria-hidden": true,
          }),
          label,
        ),
      ),
    ),
    React.createElement(GraphCanvas, {
      nodes: props.nodes,
      edges: props.edges,
      layers,
      graphRef,
      onNavigate: (meta) => {
        if (meta.href) props.onNavigate(meta.href);
      },
    }),
    React.createElement(
      "p",
      { className: "muted graph-hint" },
      `${props.nodes.length} nodes · ${props.edges.length} edges · hover for labels · Fit shows everything`,
    ),
  );
}
