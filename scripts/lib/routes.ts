/**
 * The single route table. sitemap.xml, known-paths.json, the prerendered
 * documents, and the social cards are all derived from this list, so they
 * cannot drift apart — and it is built from the same generated content module
 * that drives the client router in src/app.tsx.
 */
import { BLOG, EDUCATION, EXPERIENCE, SITE_CONFIG, SITE_PROFILE, WORK } from "../../src/generated/content";
import { clamp, SITE, type RouteMeta } from "./site-meta";

const suffix = SITE_CONFIG.titleSuffix.trim();
const withSuffix = (name: string) => (suffix ? `${name} — ${suffix}` : name);

export const visibleWork = WORK.filter((w) => w.visible !== false);
export const visibleBlog = BLOG.filter((b) => b.visible !== false);
export const visibleExperience = EXPERIENCE.filter((e) => e.visible !== false);
export const visibleEducation = EDUCATION.filter((e) => e.visible !== false);

export function buildRoutes(): RouteMeta[] {
  const workItems = visibleWork.map((w) => ({ name: w.title, url: `${SITE}/work/${w.slug}` }));
  const blogItems = visibleBlog.map((b) => ({ name: b.title, url: `${SITE}/blog/${b.slug}` }));
  const eyebrow = SITE_PROFILE.name;

  return [
    {
      path: "/",
      key: "home",
      title: `${SITE_PROFILE.name} — ${SITE_PROFILE.tagline}`,
      desc: clamp(SITE_CONFIG.description || SITE_PROFILE.summary),
      card: SITE_PROFILE.name,
      eyebrow: SITE_CONFIG.origin.replace(/^https?:\/\//, ""),
      kind: "home",
    },
    {
      path: "/about",
      key: "about",
      title: withSuffix("About"),
      desc: clamp(SITE_PROFILE.summary),
      card: "About",
      eyebrow,
      kind: "profile",
    },
    {
      path: "/experience",
      key: "experience",
      title: withSuffix("Experience"),
      desc: clamp(
        visibleExperience.length
          ? `Roles held by ${SITE_PROFILE.name}: ${visibleExperience.map((e) => `${e.role} at ${e.organization}`).join(", ")}.`
          : `Career history for ${SITE_PROFILE.name}.`,
      ),
      card: "Experience",
      eyebrow,
      kind: "collection",
      items: visibleExperience.map((e) => ({
        name: `${e.role} — ${e.organization}`,
        url: `${SITE}/experience#${e.slug}`,
      })),
    },
    {
      path: "/work",
      key: "work",
      title: withSuffix("Work"),
      desc: clamp(`Projects by ${SITE_PROFILE.name}: ${visibleWork.map((w) => w.title).join(", ")}.`),
      card: "Work",
      eyebrow,
      kind: "collection",
      items: workItems,
    },
    {
      path: "/blog",
      key: "blog",
      title: withSuffix("Blog"),
      desc: clamp(`Writing by ${SITE_PROFILE.name}: ${visibleBlog.map((b) => b.title).join(", ")}.`),
      card: "Blog",
      eyebrow,
      kind: "collection",
      items: blogItems,
    },
    {
      path: "/graph",
      key: "graph",
      title: withSuffix("Graph"),
      desc: clamp("An interactive knowledge graph of every project, post, and skill on the site — how the work connects."),
      card: "Knowledge graph",
      eyebrow,
      kind: "collection",
      items: [...workItems, ...blogItems],
      // The engine IS the page here, so let it load and wait for its canvas.
      waitFor: "main .pg-host canvas, main .pg-host",
      allowGraphEngine: true,
    },
    {
      path: "/fit",
      key: "fit",
      title: withSuffix("Fit"),
      desc: clamp("Paste a job description and get a deterministic evidence brief — every aligned claim cites a published project or post."),
      card: "Fit",
      eyebrow,
      kind: "webapp",
    },
    ...visibleWork.map<RouteMeta>((w) => ({
      path: `/work/${w.slug}`,
      key: `work-${w.slug}`,
      title: withSuffix(w.title),
      desc: clamp(w.summary),
      card: w.title,
      eyebrow: "Project",
      kind: "work",
      date: w.date,
    })),
    ...visibleBlog.map<RouteMeta>((b) => ({
      path: `/blog/${b.slug}`,
      key: `blog-${b.slug}`,
      title: withSuffix(b.title),
      desc: clamp(b.summary),
      card: b.title,
      eyebrow: "Writing",
      kind: "post",
      date: b.date,
    })),
  ];
}

/** Indexable paths — what sitemap.xml lists and the 404 middleware trusts. */
export function knownPaths(): string[] {
  return buildRoutes()
    .filter((r) => !r.noindex)
    .map((r) => r.path);
}

/** The 404 document is prerendered too, but never indexed or listed. */
export function notFoundRoute(): RouteMeta {
  return {
    path: "/404",
    key: "notfound",
    title: withSuffix("Page Not Found"),
    desc: "The page you're looking for doesn't exist.",
    card: "Page Not Found",
    eyebrow: SITE_PROFILE.name,
    kind: "notfound",
    noindex: true,
  };
}
