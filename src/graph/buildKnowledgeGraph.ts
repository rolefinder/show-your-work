import type { BlogPost, WorkItem } from "../types";

export type KgNodeKind = "project" | "post" | "skill" | "page";

export type KgNode = {
  id: string;
  label: string;
  kind: KgNodeKind;
  href?: string;
  pro?: boolean;
  orphan?: boolean;
};

export type KgEdgeLayer = "related" | "skills" | "writing";

export type KgEdge = {
  source: string;
  target: string;
  layer: KgEdgeLayer;
  inferred?: boolean;
};

export type KnowledgeGraph = {
  nodes: KgNode[];
  edges: KgEdge[];
};

/**
 * Build a knowledge graph from demo/tenant work + blog.
 * ID prefixes: proj:{slug}, blog:{slug}, skill:{label}
 * (Fit evidence keeps work:/blog:; adapters translate at the boundary.)
 */
export function buildKnowledgeGraph(
  work: WorkItem[],
  blog: BlogPost[],
): KnowledgeGraph {
  const nodes: KgNode[] = [];
  const edges: KgEdge[] = [];
  const seen = new Set<string>();

  function addNode(n: KgNode) {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    nodes.push(n);
  }

  const visibleWork = work.filter((w) => w.visible !== false);
  const visibleBlog = blog.filter((b) => b.visible !== false);

  for (const w of visibleWork) {
    addNode({
      id: `proj:${w.slug}`,
      label: w.title,
      kind: "project",
      href: `/work/${w.slug}`,
      pro: true,
    });
    for (const skill of w.skills || []) {
      const sid = `skill:${skill}`;
      addNode({ id: sid, label: skill, kind: "skill" });
      edges.push({
        source: `proj:${w.slug}`,
        target: sid,
        layer: "skills",
      });
    }
  }

  for (const b of visibleBlog) {
    addNode({
      id: `blog:${b.slug}`,
      label: b.title,
      kind: "post",
      href: `/blog/${b.slug}`,
    });
    for (const skill of b.skills || []) {
      const sid = `skill:${skill}`;
      addNode({ id: sid, label: skill, kind: "skill" });
      edges.push({
        source: `blog:${b.slug}`,
        target: sid,
        layer: "skills",
      });
    }
    // Writing bridges: shared skills with projects
    for (const w of visibleWork) {
      const shared = (b.skills || []).some((s) => (w.skills || []).includes(s));
      if (shared) {
        edges.push({
          source: `proj:${w.slug}`,
          target: `blog:${b.slug}`,
          layer: "writing",
          inferred: true,
        });
      }
    }
  }

  // Related: projects that share ≥1 skill
  for (let i = 0; i < visibleWork.length; i++) {
    for (let j = i + 1; j < visibleWork.length; j++) {
      const a = visibleWork[i];
      const b = visibleWork[j];
      const shared = (a.skills || []).some((s) => (b.skills || []).includes(s));
      if (shared) {
        edges.push({
          source: `proj:${a.slug}`,
          target: `proj:${b.slug}`,
          layer: "related",
          inferred: true,
        });
      }
    }
  }

  return { nodes, edges };
}
