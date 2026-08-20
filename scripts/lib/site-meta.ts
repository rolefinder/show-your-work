/**
 * Shared head-tag and JSON-LD helpers for the two build steps that write
 * HTML: emit-html.ts (the base document) and prerender-routes.ts (per-route
 * documents). Both derive everything from content/config/ via the generated
 * module — no identity is written here.
 */
import { SITE_CONFIG, SITE_PROFILE } from "../../src/generated/content";

export const SITE = SITE_CONFIG.origin;

export function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Serialize for embedding inside `<script type="application/ld+json">`.
 *
 * JSON.stringify does not escape `<`, so a title containing the literal
 * `</script>` would close the block early and turn everything after it into
 * live markup on every prerendered route. `<` is valid JSON and parses
 * back to `<`, so consumers see identical data — this changes the encoding,
 * never the value. Every other value in this file goes through esc(); this is
 * the same rule for the one context where HTML entities would be wrong.
 */
export function ldJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

/** Trim to a meta-description length on a word boundary. */
export function clamp(s: string, n = 155): string {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const space = cut.lastIndexOf(" ");
  return (space > 0 ? cut.slice(0, space) : cut) + "…";
}

/** "2026-06" and "2026-06-04" both become schema.org-valid dates. */
export function schemaDate(date?: string): string | undefined {
  if (/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return date;
  if (/^\d{4}-\d{2}$/.test(date || "")) return `${date}-01`;
  return undefined;
}

export const PERSON_ID = `${SITE}/#person`;
export const WEBSITE_ID = `${SITE}/#website`;

/** The Person + WebSite pair every page's @graph refers back to by @id. */
export function identityGraph(): Record<string, unknown>[] {
  const person: Record<string, unknown> = {
    "@type": "Person",
    "@id": PERSON_ID,
    name: SITE_PROFILE.name,
    url: `${SITE}/`,
    description: SITE_PROFILE.tagline,
    knowsAbout: SITE_PROFILE.skills,
  };
  if (SITE_PROFILE.email) person.email = `mailto:${SITE_PROFILE.email}`;
  if (SITE_PROFILE.location) person.address = SITE_PROFILE.location;
  // sameAs is schema.org's property for "other URLs for this same entity" —
  // sourced from the links map, not authored as a list.
  const sameAs = Object.values(SITE_PROFILE.links).filter(Boolean);
  if (sameAs.length) person.sameAs = sameAs;

  return [
    person,
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      url: `${SITE}/`,
      name: SITE_PROFILE.name,
      description: SITE_CONFIG.description || SITE_PROFILE.summary,
      publisher: { "@id": PERSON_ID },
    },
  ];
}

export type RouteKind =
  | "home"
  | "profile"
  | "collection"
  | "webapp"
  | "work"
  | "post"
  | "notfound";

export type RouteMeta = {
  path: string;
  /** Filename stem for the OG card, and the prerendered doc key. */
  key: string;
  title: string;
  desc: string;
  /** Large text on the generated social card. */
  card: string;
  eyebrow: string;
  kind: RouteKind;
  date?: string;
  noindex?: boolean;
  items?: { name: string; url: string }[];
  waitFor?: string;
  allowGraphEngine?: boolean;
};

/** Home → [Work|Blog] → leaf, so crawlers see the hierarchy. */
export function breadcrumbFor(route: RouteMeta): Record<string, unknown> {
  const items = [{ name: "Home", url: `${SITE}/` }];
  if (route.kind === "work") items.push({ name: "Work", url: `${SITE}/work` });
  if (route.kind === "post") items.push({ name: "Blog", url: `${SITE}/blog` });
  if (route.path !== "/") items.push({ name: route.card, url: SITE + route.path });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export function routeEntityGraph(route: RouteMeta): Record<string, unknown> {
  const pageId = `${SITE}${route.path}#webpage`;
  const pageType =
    route.kind === "profile"
      ? "ProfilePage"
      : route.kind === "collection"
        ? "CollectionPage"
        : "WebPage";
  const page: Record<string, unknown> = {
    "@type": route.kind === "home" ? "WebPage" : pageType,
    "@id": pageId,
    url: `${SITE}${route.path}`,
    name: route.title,
    description: route.desc,
    isPartOf: { "@id": WEBSITE_ID },
    about: { "@id": PERSON_ID },
  };
  const graph: Record<string, unknown>[] = [page, ...identityGraph()];

  if (route.kind === "home" || route.kind === "profile") {
    page.mainEntity = { "@id": PERSON_ID };
  } else if (route.kind === "collection") {
    const listId = `${SITE}${route.path}#items`;
    page.mainEntity = { "@id": listId };
    graph.push({
      "@type": "ItemList",
      "@id": listId,
      numberOfItems: route.items?.length || 0,
      itemListElement: (route.items || []).map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        url: item.url,
      })),
    });
  } else if (route.kind === "webapp") {
    const appId = `${SITE}${route.path}#app`;
    page.mainEntity = { "@id": appId };
    graph.push({
      "@type": "WebApplication",
      "@id": appId,
      name: "Fit",
      description: route.desc,
      url: `${SITE}${route.path}`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any",
      isAccessibleForFree: true,
      author: { "@id": PERSON_ID },
    });
  } else if (route.kind === "work") {
    const workId = `${SITE}${route.path}#project`;
    page.mainEntity = { "@id": workId };
    graph.push({
      "@type": "CreativeWork",
      "@id": workId,
      name: route.card,
      description: route.desc,
      url: `${SITE}${route.path}`,
      mainEntityOfPage: { "@id": pageId },
      author: { "@id": PERSON_ID },
    });
  } else if (route.kind === "post") {
    const articleId = `${SITE}${route.path}#article`;
    page.mainEntity = { "@id": articleId };
    graph.push({
      "@type": "BlogPosting",
      "@id": articleId,
      headline: route.card,
      description: route.desc,
      datePublished: schemaDate(route.date),
      dateModified: schemaDate(route.date),
      image: `${SITE}/assets/og/${route.key}.png`,
      url: `${SITE}${route.path}`,
      mainEntityOfPage: { "@id": pageId },
      author: { "@id": PERSON_ID },
      isPartOf: { "@id": WEBSITE_ID },
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

/** Replace a single head tag, failing loudly if the template drifted. */
export function swapTag(
  html: string,
  pattern: RegExp,
  replacement: string,
  label: string,
): string {
  if (!pattern.test(html)) {
    throw new Error(
      `no ${label} tag matched — index.html and the emitter have drifted apart`,
    );
  }
  return html.replace(pattern, replacement);
}

/** Rewrite every per-route head tag in a copy of the base document. */
export function applyRouteHead(html: string, route: RouteMeta): string {
  const img = `${SITE}/assets/og/${route.key}.png`;
  let doc = html;
  doc = swapTag(doc, /<title>[\s\S]*?<\/title>/, `<title>${esc(route.title)}</title>`, "<title>");
  doc = swapTag(doc, /<meta name="description"[^>]*>/, `<meta name="description" content="${esc(route.desc)}" />`, "description");
  doc = swapTag(doc, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${SITE}${route.path}" />`, "canonical");
  doc = swapTag(doc, /<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(route.title)}" />`, "og:title");
  doc = swapTag(doc, /<meta property="og:description"[^>]*>/, `<meta property="og:description" content="${esc(route.desc)}" />`, "og:description");
  doc = swapTag(doc, /<meta property="og:url"[^>]*>/, `<meta property="og:url" content="${SITE}${route.path}" />`, "og:url");
  doc = swapTag(doc, /<meta property="og:type"[^>]*>/, `<meta property="og:type" content="${route.kind === "post" ? "article" : "website"}" />`, "og:type");
  doc = swapTag(doc, /<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${img}" />`, "og:image");
  doc = swapTag(doc, /<meta property="og:image:alt"[^>]*>/, `<meta property="og:image:alt" content="${esc(route.card)} — ${esc(SITE_PROFILE.name)}" />`, "og:image:alt");
  doc = swapTag(doc, /<meta name="twitter:title"[^>]*>/, `<meta name="twitter:title" content="${esc(route.title)}" />`, "twitter:title");
  doc = swapTag(doc, /<meta name="twitter:description"[^>]*>/, `<meta name="twitter:description" content="${esc(route.desc)}" />`, "twitter:description");
  doc = swapTag(doc, /<meta name="twitter:image"[^>]*>/, `<meta name="twitter:image" content="${img}" />`, "twitter:image");
  if (route.noindex) {
    doc = swapTag(doc, /<meta name="robots"[^>]*>/, `<meta name="robots" content="noindex" />`, "robots");
  }

  const ld = `<script type="application/ld+json">${ldJson(routeEntityGraph(route))}</script>`;
  const crumb = route.noindex || route.path === "/"
    ? ""
    : `<script type="application/ld+json">${ldJson(breadcrumbFor(route))}</script>`;
  doc = swapTag(doc, /<script type="application\/ld\+json">[\s\S]*?<\/script>/, ld + crumb, "ld+json");
  return doc;
}
