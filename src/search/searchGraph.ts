import type { BlogPost, WorkItem } from "../types";
import { linkTokens, stripTokens } from "./richText";

export type SearchKind = "work" | "blog" | "skill" | "page";

export type SearchNode = {
  id: string;
  kind: SearchKind;
  kindLabel: string;
  title: string;
  sub: string;
  chips: string[];
  href: string;
  text: string;
  _t?: string;
  _title?: string;
  _sub?: string;
  _chips?: string;
  _index?: string;
};

export type SearchHit = {
  node: SearchNode;
  kind: "result" | "connected";
  via?: string;
};

export type SearchResult = {
  groups: { key: string; label: string; items: SearchHit[] }[];
  flat: SearchHit[];
  empty: boolean;
  count: number;
};

function skillSlug(label: string): string {
  return String(label || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildSearchGraph(
  work: WorkItem[],
  blog: BlogPost[],
): { nodes: SearchNode[]; edges: Map<string, Set<string>>; byId: Map<string, SearchNode> } {
  const nodes: SearchNode[] = [];
  const edges = new Map<string, Set<string>>();

  const addEdge = (a: string, b: string) => {
    if (!a || !b || a === b) return;
    if (!edges.has(a)) edges.set(a, new Set());
    if (!edges.has(b)) edges.set(b, new Set());
    edges.get(a)!.add(b);
    edges.get(b)!.add(a);
  };

  work
    .filter((w) => w.visible !== false)
    .forEach((w) => {
      const id = "work:" + w.slug;
      const chips = [...(w.skills || [])];
      const text = [w.title, w.summary, stripTokens(w.body), chips.join(" ")]
        .filter(Boolean)
        .join(" — ");
      nodes.push({
        id,
        kind: "work",
        kindLabel: "Work",
        title: w.title,
        sub: w.summary,
        chips,
        href: "/work/" + w.slug,
        text,
      });
      linkTokens(w.body || "").forEach((tid) => addEdge(id, tid));
      linkTokens(w.summary || "").forEach((tid) => addEdge(id, tid));
    });

  blog
    .filter((b) => b.visible !== false)
    .forEach((b) => {
      const id = "blog:" + b.slug;
      const chips = [...(b.skills || [])];
      const text = [b.title, b.summary, stripTokens(b.body), chips.join(" ")]
        .filter(Boolean)
        .join(" — ");
      nodes.push({
        id,
        kind: "blog",
        kindLabel: "Blog",
        title: b.title,
        sub: b.summary,
        chips,
        href: "/blog/" + b.slug,
        text,
      });
      linkTokens(b.body || "").forEach((tid) => addEdge(id, tid));
      linkTokens(b.summary || "").forEach((tid) => addEdge(id, tid));
    });

  const skillLabels = new Map<string, string>();
  work.forEach((w) =>
    (w.skills || []).forEach((s) => {
      const sl = skillSlug(s);
      if (sl) skillLabels.set(sl, s);
    }),
  );
  blog.forEach((b) =>
    (b.skills || []).forEach((s) => {
      const sl = skillSlug(s);
      if (sl) skillLabels.set(sl, s);
    }),
  );

  skillLabels.forEach((label, sl) => {
    const id = "skill:" + sl;
    nodes.push({
      id,
      kind: "skill",
      kindLabel: "Skill",
      title: label,
      sub: "Portfolio skill",
      chips: [label],
      href: "/work?skill=" + encodeURIComponent(label),
      text: label + " skill expertise work blog",
    });
    work.forEach((w) => {
      if ((w.skills || []).includes(label)) addEdge("work:" + w.slug, id);
    });
    blog.forEach((b) => {
      if ((b.skills || []).includes(label)) addEdge("blog:" + b.slug, id);
    });
  });

  nodes.push({
    id: "page:home",
    kind: "page",
    kindLabel: "Page",
    title: "Home",
    sub: "Demo portfolio",
    chips: [],
    href: "/",
    text: "home about portfolio demo",
  });
  nodes.push({
    id: "page:work",
    kind: "page",
    kindLabel: "Page",
    title: "Work",
    sub: "Projects",
    chips: [],
    href: "/work",
    text: "work projects portfolio",
  });
  nodes.push({
    id: "page:blog",
    kind: "page",
    kindLabel: "Page",
    title: "Blog",
    sub: "Notes and posts",
    chips: [],
    href: "/blog",
    text: "blog writing notes posts",
  });
  nodes.push({
    id: "page:fit",
    kind: "page",
    kindLabel: "Page",
    title: "Fit",
    sub: "JD → evidence brief",
    chips: [],
    href: "/fit",
    text: "fit recruiter evidence cite missing",
  });
  nodes.push({
    id: "page:graph",
    kind: "page",
    kindLabel: "Page",
    title: "Graph",
    sub: "Knowledge graph",
    chips: [],
    href: "/graph",
    text: "graph knowledge lens skills",
  });

  const lc = (s: string) => String(s || "").toLowerCase();
  nodes.forEach((n) => {
    n._index = lc([n.title, n.sub].filter(Boolean).join(" — "));
    n._t = lc(n.text);
    n._title = lc(n.title);
    n._sub = lc(n.sub);
    n._chips = lc(n.chips.join(" "));
  });

  return { nodes, edges, byId: new Map(nodes.map((n) => [n.id, n])) };
}

export function runSearch(
  query: string,
  graph: ReturnType<typeof buildSearchGraph>,
): SearchResult {
  const q = (query || "").trim().toLowerCase();
  if (!q) return { groups: [], flat: [], empty: true, count: 0 };

  const terms = q.split(/\s+/).filter(Boolean);
  const scored: { node: SearchNode; score: number }[] = [];

  graph.nodes.forEach((n) => {
    let ok = true;
    let score = 0;
    for (const term of terms) {
      if (!n._t!.includes(term) && !n._index!.includes(term)) {
        ok = false;
        break;
      }
      if (n._index!.includes(term)) score += 10;
      if (n._title!.includes(term)) score += 12;
      if (n._sub!.includes(term)) score += 6;
      if (n._chips!.includes(term)) score += 5;
      score += Math.min(4, n._t!.split(term).length - 1);
    }
    if (!ok) return;
    if (n._title!.includes(q)) score += 16;
    if (n.kind === "work") score += 2;
    scored.push({ node: n, score });
  });

  scored.sort(
    (a, b) => b.score - a.score || a.node.title.localeCompare(b.node.title),
  );

  const matched = new Set(scored.map((s) => s.node.id));
  const seen = new Set(matched);
  const connected: { node: SearchNode; via: string }[] = [];
  scored.forEach((s) => {
    const nbrs = graph.edges.get(s.node.id);
    if (!nbrs) return;
    nbrs.forEach((nid) => {
      if (seen.has(nid)) return;
      seen.add(nid);
      const nbr = graph.byId.get(nid);
      if (nbr) connected.push({ node: nbr, via: s.node.title });
    });
  });

  const order: SearchKind[] = ["work", "blog", "skill", "page"];
  const labelFor: Record<SearchKind, string> = {
    work: "Work",
    blog: "Blog",
    skill: "Skills",
    page: "Pages",
  };
  const groups: SearchResult["groups"] = [];
  order.forEach((k) => {
    const items = scored
      .filter((s) => s.node.kind === k)
      .map((s) => ({ node: s.node, kind: "result" as const }));
    if (items.length) groups.push({ key: k, label: labelFor[k], items });
  });
  if (connected.length) {
    groups.push({
      key: "connected",
      label: "Connected",
      items: connected.slice(0, 6).map((c) => ({
        node: c.node,
        via: c.via,
        kind: "connected" as const,
      })),
    });
  }

  const flat: SearchHit[] = [];
  groups.forEach((grp) => grp.items.forEach((it) => flat.push(it)));
  return { groups, flat, empty: false, count: scored.length };
}
