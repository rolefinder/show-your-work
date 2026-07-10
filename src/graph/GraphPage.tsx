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
    RMPortfolioGraph?: PortfolioGraphApi;
  }
}

type GraphCanvasProps = {
  nodes: KgNode[];
  edges: KgEdge[];
  forces?: PortfolioGraphForces;
  compact?: boolean;
  onNavigate?: (meta: KgNode) => void;
};

export function GraphCanvas(props: GraphCanvasProps) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const engineRef = React.useRef<PortfolioGraphHandle | null>(null);

  React.useEffect(() => {
    const host = hostRef.current;
    const api = window.RMPortfolioGraph;
    if (!host || !api?.create) return;

    engineRef.current?.destroy();
    engineRef.current = api.create(host, {
      nodes: props.nodes,
      edges: props.edges,
      compact: props.compact,
      forces: props.forces,
      onNavigate: props.onNavigate,
    });

    const onResize = () => engineRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      engineRef.current?.destroy();
      engineRef.current = null;
    };
    // Remount when topology identity changes; forces via update below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.nodes, props.edges, props.compact, props.onNavigate]);

  React.useEffect(() => {
    if (!engineRef.current || !props.forces) return;
    engineRef.current.update({ forces: props.forces });
  }, [props.forces]);

  return React.createElement("div", {
    ref: hostRef,
    className: "pg-host work-graph-viewport",
    role: "img",
    "aria-label": "Portfolio knowledge graph",
  });
}

type GraphPageProps = {
  nodes: KgNode[];
  edges: KgEdge[];
  onNavigate: (href: string) => void;
};

export function GraphPage(props: GraphPageProps) {
  const [gravity, setGravity] = React.useState(0.55);
  const forces = React.useMemo(
    () => ({ gravity, scalingRatio: 12, hubPull: 0.38, macroRingBase: 180 }),
    [gravity],
  );

  const ready = typeof window !== "undefined" && !!window.RMPortfolioGraph?.create;

  return React.createElement(
    "section",
    { className: "page pg-page" },
    React.createElement("p", { className: "eyebrow" }, "Knowledge graph"),
    React.createElement("h1", null, "Graph"),
    React.createElement(
      "p",
      { className: "lede" },
      "CSP-safe Sigma + Graphology engine. Forces come from typed opts.forces (no window globals).",
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
        "label",
        null,
        "Gravity ",
        React.createElement("input", {
          type: "range",
          min: 0.2,
          max: 1.2,
          step: 0.05,
          value: gravity,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
            setGravity(Number(e.target.value)),
        }),
        React.createElement("span", { className: "muted" }, String(gravity)),
      ),
    ),
    React.createElement(GraphCanvas, {
      nodes: props.nodes,
      edges: props.edges,
      forces,
      onNavigate: (meta) => {
        if (meta.href) props.onNavigate(meta.href);
      },
    }),
    React.createElement(
      "p",
      { className: "muted graph-hint" },
      `${props.nodes.length} nodes · ${props.edges.length} edges · drag nodes · double-click canvas to fit`,
    ),
  );
}
