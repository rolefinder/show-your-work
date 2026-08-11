import type { WorkItem } from "./types";
import { linkLabel } from "./profile-links";
import { BLOG, EDUCATION, EXPERIENCE, SITE_CONFIG, SITE_ORIGIN, SITE_PROFILE, SKILL_CATEGORIES, WORK } from "./generated/content";
import { buildEvidencePack } from "./fit/evidence";
import { FitPage } from "./fit/FitPage";
import { buildKnowledgeGraph } from "./graph/buildKnowledgeGraph";
import { GraphPage, KnowledgeLens } from "./graph/GraphPage";
import { richText } from "./search/richText";
import { buildSearchGraph, runSearch } from "./search/searchGraph";
import { SearchPalette } from "./search/SearchPalette";
import {
  buildSkillBankGroups,
  collectSkillCounts,
  searchFromSkills,
  SkillBank,
  skillsFromSearch,
} from "./skills/SkillBank";

type View =
  | { name: "home" }
  | { name: "about" }
  | { name: "work" }
  | { name: "workDetail"; slug: string }
  | { name: "blog" }
  | { name: "blogDetail"; slug: string }
  | { name: "experience" }
  | { name: "fit" }
  | { name: "graph" }
  | { name: "notfound"; path: string };

function viewFor(path: string): View {
  const seg = path.split("/").filter(Boolean);
  if (!seg.length) return { name: "home" };
  if (seg[0] === "about") return { name: "about" };
  if (seg[0] === "experience") return { name: "experience" };
  if (seg[0] === "fit") return { name: "fit" };
  if (seg[0] === "graph") return { name: "graph" };
  if (seg[0] === "work" && seg[1]) return { name: "workDetail", slug: seg[1] };
  if (seg[0] === "work") return { name: "work" };
  if (seg[0] === "blog" && seg[1]) return { name: "blogDetail", slug: seg[1] };
  if (seg[0] === "blog") return { name: "blog" };
  return { name: "notfound", path };
}

function routeFor(view: View): string {
  if (view.name === "about") return "/about";
  if (view.name === "experience") return "/experience";
  if (view.name === "fit") return "/fit";
  if (view.name === "graph") return "/graph";
  if (view.name === "work") return "/work";
  if (view.name === "workDetail") return "/work/" + view.slug;
  if (view.name === "blog") return "/blog";
  if (view.name === "blogDetail") return "/blog/" + view.slug;
  if (view.name === "notfound") return view.path;
  return "/";
}

/**
 * Scroll to a fragment target, or to the top when there is none.
 *
 * Deferred a frame: the destination view renders in the same React commit this
 * runs after, so the element does not exist yet at call time. Falls back to the
 * top when the id is absent — a stale anchor should land somewhere sensible
 * rather than leave the reader wherever they happened to be.
 */
function scrollToHash(hash: string): void {
  if (!hash || hash === "#") {
    window.scrollTo(0, 0);
    return;
  }
  requestAnimationFrame(() => {
    const target = document.getElementById(decodeURIComponent(hash.slice(1)));
    if (target) target.scrollIntoView({ block: "start" });
    else window.scrollTo(0, 0);
  });
}

/** "<page> — <titleSuffix>", or just the page name if no suffix is configured. */
export function withSuffix(pageName: string): string {
  const suffix = SITE_CONFIG.titleSuffix.trim();
  return suffix ? `${pageName} — ${suffix}` : pageName;
}

function titleFor(view: View): string {
  if (view.name === "about") return withSuffix("About");
  if (view.name === "experience") return withSuffix("Experience");
  if (view.name === "work") return withSuffix("Work");
  if (view.name === "workDetail") {
    const w = WORK.find((x) => x.slug === view.slug);
    if (w) return withSuffix(w.title);
  }
  if (view.name === "blog") return withSuffix("Blog");
  if (view.name === "blogDetail") {
    const b = BLOG.find((x) => x.slug === view.slug);
    if (b) return withSuffix(b.title);
  }
  if (view.name === "fit") return withSuffix("Fit");
  if (view.name === "graph") return withSuffix("Graph");
  if (view.name === "notfound") return withSuffix("Page Not Found");
  // Home leads with the person and what they do, not a page label.
  return `${SITE_PROFILE.name} — ${SITE_PROFILE.tagline}`;
}

/**
 * The editorial contract every project page shares: problem, outcome,
 * evidence, decisions. Renders only the cells the YAML actually fills, so a
 * half-authored project degrades to a shorter brief rather than empty headings.
 */
function ProjectBrief({ item }: { item: WorkItem }) {
  const cells: { head: string; body: React.ReactNode; wide?: boolean }[] = [];
  if (item.problem) cells.push({ head: "Problem", body: React.createElement("p", null, item.problem) });
  if (item.outcome) cells.push({ head: "Outcome", body: React.createElement("p", null, item.outcome) });
  if (item.evidence?.length) {
    cells.push({
      head: "Evidence",
      body: React.createElement(
        "ul",
        null,
        item.evidence.map((e, i) => React.createElement("li", { key: i }, e)),
      ),
    });
  }
  if (item.decisions?.length) {
    cells.push({
      head: "Key decisions",
      body: React.createElement(
        "ul",
        null,
        item.decisions.map((d, i) => React.createElement("li", { key: i }, d)),
      ),
      wide: true,
    });
  }
  if (!cells.length) return null;

  return React.createElement(
    "section",
    { className: "project-brief", "aria-label": "Project brief" },
    React.createElement(
      "div",
      { className: "project-brief__grid" },
      cells.map((c) =>
        React.createElement(
          "div",
          {
            key: c.head,
            className: c.wide ? "project-brief__cell project-brief__cell--wide" : "project-brief__cell",
          },
          React.createElement("h3", null, c.head),
          c.body,
        ),
      ),
    ),
  );
}

/**
 * Skill chip with a native tooltip: the site-wide description, plus how the
 * skill applied on this page when the work item supplies a note. `title` keeps
 * it CSP-safe and keyboard/screen-reader reachable with no JS or portal.
 */
function SkillTags({
  item,
  Link,
}: {
  item: WorkItem;
  Link: (props: {
    href: string;
    className?: string;
    title?: string;
    children?: React.ReactNode;
  }) => React.ReactElement;
}) {
  const descriptions = SKILL_CATEGORIES.descriptions || {};
  return React.createElement(
    "ul",
    { className: "tags" },
    item.skills.map((s) => {
      const applied = item.skillNotes?.[s];
      const tip = [descriptions[s], applied].filter(Boolean).join(" — ");
      return React.createElement(
        "li",
        { key: s },
        React.createElement(
          Link,
          {
            href: "/work" + searchFromSkills([s]),
            className: tip ? "tag tag--described" : "tag",
            title: tip || undefined,
          },
          s,
        ),
      );
    }),
  );
}

/**
 * One outlined strip: email, then each configured profile URL in authoring
 * order. Outbound links get rel="noopener noreferrer" — they are
 * adopter-authored URLs.
 */
function ContactRow() {
  return React.createElement(
    "div",
    { className: "contact-row", role: "group", "aria-label": "Contact" },
    React.createElement(
      "a",
      {
        className: "contact-row__item",
        href: `mailto:${SITE_PROFILE.email}`,
      },
      SITE_PROFILE.email,
    ),
    Object.entries(SITE_PROFILE.links).map(([key, href]) =>
      React.createElement(
        "a",
        {
          key,
          className: "contact-row__item",
          href,
          target: "_blank",
          rel: "noopener noreferrer",
        },
        linkLabel(key),
      ),
    ),
  );
}

/** Top-level nav, shared by the header bar and the mobile drawer. */
const NAV_ITEMS: [label: string, view: View][] = [
  ["About", { name: "about" }],
  ["Experience", { name: "experience" }],
  ["Work", { name: "work" }],
  ["Blog", { name: "blog" }],
  ["Graph", { name: "graph" }],
  ["Fit", { name: "fit" }],
];

/** A nav item is current for its own view and for its detail routes. */
function navActive(item: View, view: View): boolean {
  if (item.name === "work") return view.name === "work" || view.name === "workDetail";
  if (item.name === "blog") return view.name === "blog" || view.name === "blogDetail";
  return item.name === view.name;
}

function App() {
  const [path, setPath] = React.useState(() => window.location.pathname || "/");
  const [search, setSearch] = React.useState(() => window.location.search || "");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [mobile, setMobile] = React.useState(false);
  const [navOpen, setNavOpen] = React.useState(false);
  const view = viewFor(path);
  const visibleWork = WORK.filter((w) => w.visible !== false);
  const visibleBlog = BLOG.filter((b) => b.visible !== false);
  const docs = React.useMemo(
    () => buildEvidencePack(SITE_PROFILE, WORK, BLOG, EXPERIENCE),
    [],
  );
  const kg = React.useMemo(
    () => buildKnowledgeGraph(WORK, BLOG),
    [],
  );
  const searchGraph = React.useMemo(
    () => buildSearchGraph(WORK, BLOG),
    [],
  );
  const searchResult = React.useMemo(
    () => runSearch(searchQuery, searchGraph),
    [searchQuery, searchGraph],
  );
  const activeSkills = React.useMemo(() => skillsFromSearch(search), [search]);

  React.useEffect(() => {
    const onPop = () => {
      setPath(window.location.pathname || "/");
      setSearch(window.location.search || "");
      // The fragment matters on the way back too. Without this, going back to
      // a Fit citation restores /experience#<slug> in the address bar and
      // leaves the reader at the top of the page — the same miss navigate()
      // fixes on the way forward.
      scrollToHash(window.location.hash || "");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /*
   * Third path to the same target, and the one an outside agent uses: a cold
   * load of /experience#<slug>, which is what /api/mcp hands back as a
   * citation URL. The browser does scroll to the prerendered anchor while
   * parsing — and then ReactDOM.render replaces #root, rebuilding that element
   * and losing the position. Re-aims once after the first render.
   *
   * Only when a fragment is present: with no hash this must not run, or it
   * would fight the browser's own scroll restoration on a refresh.
   */
  React.useEffect(() => {
    if (window.location.hash) scrollToHash(window.location.hash);
  }, []);

  // Below --bp-md the nav collapses behind a menu button; widening the
  // viewport must also close an open drawer or it hangs under the bar.
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setMobile(mq.matches);
      if (!mq.matches) setNavOpen(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  React.useEffect(() => {
    document.title = titleFor(view);
    let desc: string | null = null;
    if (view.name === "workDetail") {
      const w = WORK.find((x) => x.slug === view.slug);
      if (w) desc = w.summary;
    } else if (view.name === "blogDetail") {
      const b = BLOG.find((x) => x.slug === view.slug);
      if (b) desc = b.summary;
    } else if (view.name === "notfound") {
      desc = "The page you're looking for doesn't exist.";
    }
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", desc || SITE_PROFILE.summary);
    const robots = document.querySelector('meta[name="robots"]');
    if (robots) robots.setAttribute("content", view.name === "notfound" ? "noindex" : "index, follow");
    const ogUrl = document.querySelector('meta[property="og:url"]');
    const canonicalUrl = SITE_ORIGIN + routeFor(view);
    if (ogUrl) ogUrl.setAttribute("content", canonicalUrl);
    else {
      const tag = document.createElement("meta");
      tag.setAttribute("property", "og:url");
      tag.setAttribute("content", canonicalUrl);
      document.head.appendChild(tag);
    }
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute("href", canonicalUrl);
  }, [view]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = (t && t.tagName) || "";
      const typing =
        tag === "INPUT" || tag === "TEXTAREA" || (t && t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
        return;
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !typing) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /*
   * Carries the fragment. A Fit citation to a role is `/experience#<slug>`, and
   * dropping the hash here sent every one of them to the top of the page — a
   * citation that does not land on the thing it cites, which is the one promise
   * this project makes.
   */
  function navigate(next: string) {
    const url = new URL(next, window.location.origin);
    const full = url.pathname + url.search + url.hash;
    const here = window.location.pathname + window.location.search + window.location.hash;
    if (here !== full) {
      window.history.pushState(null, "", full);
    }
    setPath(url.pathname);
    setSearch(url.search);
    setNavOpen(false);
    scrollToHash(url.hash);
  }

  function Link(props: {
    href: string;
    children?: React.ReactNode;
    className?: string;
    title?: string;
    "aria-current"?: "page";
  }) {
    return React.createElement(
      "a",
      {
        href: props.href,
        className: props.className,
        title: props.title,
        "aria-current": props["aria-current"],
        onClick: (e: React.MouseEvent) => {
          // Let the browser own modified clicks (new tab, download, …).
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          navigate(props.href);
        },
      },
      props.children,
    );
  }

  function setWorkSkills(next: string[]) {
    navigate("/work" + searchFromSkills(next));
  }

  function toggleWorkSkill(label: string) {
    const set = new Set(activeSkills);
    if (set.has(label)) set.delete(label);
    else set.add(label);
    setWorkSkills([...set].sort());
  }

  const { allSkills, counts } = collectSkillCounts([...visibleWork, ...visibleBlog]);
  const homeSkillGroups = buildSkillBankGroups(
    allSkills,
    counts,
    [],
    (label) => navigate("/work" + searchFromSkills([label])),
    SKILL_CATEGORIES,
  );
  const workSkillGroups = buildSkillBankGroups(
    allSkills,
    counts,
    activeSkills,
    toggleWorkSkill,
    SKILL_CATEGORIES,
  );

  const filteredWork =
    activeSkills.length === 0
      ? visibleWork
      : visibleWork.filter((w) =>
          activeSkills.every((s) => (w.skills || []).includes(s)),
        );

  let body: React.ReactNode = null;
  if (view.name === "home") {
    body = React.createElement(
      "section",
      { className: "page" },
      SITE_CONFIG.demo
        ? React.createElement("p", { className: "eyebrow" }, "show-your-work demo")
        : null,
      React.createElement("h1", null, SITE_PROFILE.name),
      React.createElement("p", { className: "lede" }, SITE_PROFILE.tagline),
      React.createElement("p", { className: "prose" }, SITE_PROFILE.summary),
      React.createElement(ContactRow, null),
      React.createElement(
        "div",
        { className: "cta-row" },
        React.createElement(Link, { href: "/work", className: "btn" }, "Work"),
        React.createElement(Link, { href: "/graph", className: "btn secondary" }, "Graph"),
        React.createElement(Link, { href: "/fit", className: "btn secondary" }, "Try Fit"),
      ),
      React.createElement(SkillBank, {
        groups: homeSkillGroups,
        intro: "Every skill across work and blog, grouped by tenant config. Click one to open Work filtered to that skill.",
      }),
    );
  } else if (view.name === "about") {
    body = React.createElement(
      "section",
      { className: "page" },
      React.createElement("p", { className: "eyebrow" }, "Profile"),
      React.createElement("h1", null, "About"),
      React.createElement("p", { className: "prose" }, SITE_PROFILE.summary),
      React.createElement("p", { className: "muted" }, SITE_PROFILE.location),
      React.createElement(ContactRow, null),
      React.createElement(
        "ul",
        { className: "tags" },
        SITE_PROFILE.skills.map((s) =>
          React.createElement(
            "li",
            { key: s },
            React.createElement("span", { className: "tag" }, s),
          ),
        ),
      ),
    );
  } else if (view.name === "experience") {
    const roles = EXPERIENCE.filter((e) => e.visible !== false);
    const credentials = EDUCATION.filter((e) => e.visible !== false);
    body = React.createElement(
      "section",
      { className: "page" },
      React.createElement("p", { className: "eyebrow" }, "Career"),
      React.createElement("h1", null, "Experience"),
      roles.length
        ? React.createElement(
            "ol",
            { className: "card-list" },
            roles.map((e) =>
              React.createElement(
                "li",
                // id, not just key: /experience#<slug> is the citation target in the
                  // evidence pack and in the ItemList JSON-LD. React's key is a
                  // reconciliation hint and never reaches the DOM.
                  { key: e.slug, id: e.slug, className: "card" },
                React.createElement("h2", null, e.role),
                React.createElement(
                  "p",
                  { className: "muted" },
                  // "Present" is derived from an absent end date rather than
                  // authored, so a role cannot be left saying it ended when it
                  // did not, or vice versa.
                  [e.organization, `${e.start} – ${e.end || "Present"}`, e.location]
                    .filter(Boolean)
                    .join(" · "),
                ),
                React.createElement("p", { className: "prose" }, richText(e.summary, navigate)),
                e.highlights.length
                  ? React.createElement(
                      "ul",
                      { className: "prose" },
                      e.highlights.map((h, i) =>
                        React.createElement("li", { key: i }, richText(h, navigate)),
                      ),
                    )
                  : null,
                // Curated, not date-inferred (ADR 026). Only links to work that
                // is actually published, so an unpublished draft cannot leak a
                // dangling link onto the career page.
                (() => {
                  const linked = e.projects
                    .map((slug) => WORK.find((w) => w.slug === slug && w.visible !== false))
                    .filter(Boolean) as WorkItem[];
                  return linked.length
                    ? React.createElement(
                        "p",
                        { className: "muted" },
                        "Built here: ",
                        linked.map((w, i) =>
                          React.createElement(
                            React.Fragment,
                            { key: w.slug },
                            i ? ", " : null,
                            React.createElement(Link, { href: "/work/" + w.slug }, w.title),
                          ),
                        ),
                      )
                    : null;
                })(),
                e.skills.length
                  ? React.createElement(
                      "ul",
                      { className: "tags" },
                      e.skills.map((s) =>
                        React.createElement(
                          "li",
                          { key: s },
                          React.createElement("span", { className: "tag" }, s),
                        ),
                      ),
                    )
                  : null,
              ),
            ),
          )
        : React.createElement("p", { className: "muted" }, "No roles published yet."),
      credentials.length
        ? React.createElement(
            React.Fragment,
            null,
            React.createElement("h2", null, "Education"),
            React.createElement(
              "ul",
              { className: "card-list" },
              credentials.map((e) =>
                React.createElement(
                  "li",
                  { key: e.slug, id: e.slug, className: "card" },
                  React.createElement("h3", null, e.credential),
                  React.createElement(
                    "p",
                    { className: "muted" },
                    [e.institution, e.date, e.honors].filter(Boolean).join(" · "),
                  ),
                  e.achievements.length
                    ? React.createElement(
                        "ul",
                        { className: "prose" },
                        e.achievements.map((a, i) =>
                          React.createElement("li", { key: i }, richText(a, navigate)),
                        ),
                      )
                    : null,
                ),
              ),
            ),
          )
        : null,
    );
  } else if (view.name === "work") {
    body = React.createElement(
      "section",
      { className: "page" },
      React.createElement("p", { className: "eyebrow" }, "Selected work"),
      React.createElement("h1", null, "Work"),
      activeSkills.length
        ? React.createElement(
            "p",
            { className: "muted" },
            "Filtered by: ",
            activeSkills.join(", "),
            " · ",
            React.createElement(
              "button",
              {
                type: "button",
                className: "linkish",
                onClick: () => setWorkSkills([]),
              },
              "Clear",
            ),
          )
        : null,
      React.createElement(
        "ul",
        { className: "card-list card-list--split" },
        filteredWork.length
          ? filteredWork.map((w) =>
              React.createElement(
                "li",
                { key: w.slug },
                React.createElement(
                  Link,
                  { href: "/work/" + w.slug, className: "card-link u-card-link" },
                  React.createElement("span", { className: "card-link__title" }, w.title),
                  React.createElement("span", { className: "card-link__summary" }, w.summary),
                ),
              ),
            )
          : React.createElement(
              "li",
              { className: "card-empty" },
              "No work matches these skills.",
            ),
      ),
      React.createElement(KnowledgeLens, {
        nodes: kg.nodes,
        edges: kg.edges,
        onNavigate: navigate,
      }),
      React.createElement(SkillBank, {
        groups: workSkillGroups,
        intro: "Click a skill to toggle the ?skill= filter on this list.",
      }),
    );
  } else if (view.name === "workDetail") {
    const w = visibleWork.find((x) => x.slug === view.slug);
    body = w
      ? React.createElement(
          "section",
          { className: "page" },
          React.createElement(Link, { href: "/work", className: "page-back" }, "← Work"),
          React.createElement("h1", null, w.title),
          React.createElement("p", { className: "lede" }, w.summary),
          React.createElement(ProjectBrief, { item: w }),
          React.createElement("p", { className: "prose" }, richText(w.body, navigate)),
          React.createElement(SkillTags, { item: w, Link }),
        )
      : React.createElement("section", { className: "page" }, React.createElement("h1", null, "Not found"));
  } else if (view.name === "blog") {
    body = React.createElement(
      "section",
      { className: "page" },
      React.createElement("p", { className: "eyebrow" }, "Writing"),
      React.createElement("h1", null, "Blog"),
      React.createElement(
        "ul",
        { className: "card-list" },
        visibleBlog.map((b) =>
          React.createElement(
            "li",
            { key: b.slug },
            React.createElement(
              Link,
              { href: "/blog/" + b.slug, className: "card-link u-card-link" },
              React.createElement("span", { className: "card-link__title" }, b.title),
              React.createElement("span", { className: "card-link__summary" }, b.summary),
            ),
          ),
        ),
      ),
    );
  } else if (view.name === "blogDetail") {
    const b = visibleBlog.find((x) => x.slug === view.slug);
    body = b
      ? React.createElement(
          "section",
          { className: "page" },
          React.createElement(Link, { href: "/blog", className: "page-back" }, "← Blog"),
          React.createElement("h1", null, b.title),
          React.createElement("p", { className: "lede" }, b.summary),
          React.createElement("p", { className: "prose" }, richText(b.body, navigate)),
        )
      : React.createElement("section", { className: "page" }, React.createElement("h1", null, "Not found"));
  } else if (view.name === "fit") {
    body = React.createElement(FitPage, { docs, onNavigate: navigate });
  } else if (view.name === "graph") {
    body = React.createElement(GraphPage, {
      nodes: kg.nodes,
      edges: kg.edges,
      onNavigate: navigate,
    });
  } else if (view.name === "notfound") {
    body = React.createElement(
      "section",
      { className: "page" },
      React.createElement("p", { className: "eyebrow" }, "404"),
      React.createElement("h1", null, "Page not found"),
      React.createElement(
        "p",
        { className: "lede" },
        "The page you're looking for doesn't exist. It may have moved or never existed at this address.",
      ),
      React.createElement(
        "div",
        { className: "cta-row" },
        React.createElement(Link, { href: "/", className: "btn" }, "Home"),
        React.createElement(Link, { href: "/work", className: "btn secondary" }, "Work"),
      ),
    );
  }

  const navLinks = (className: string) =>
    React.createElement(
      "nav",
      { className, id: className.includes("mobile") ? "site-nav-mobile" : undefined, "aria-label": "Main" },
      NAV_ITEMS.map(([label, target]) =>
        React.createElement(
          Link,
          {
            key: target.name,
            href: routeFor(target),
            "aria-current": navActive(target, view) ? "page" : undefined,
          },
          label,
        ),
      ),
    );

  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "header",
      { className: "site-header" },
      React.createElement(
        "a",
        { href: "#main", className: "visually-hidden skip-link" },
        "Skip to content",
      ),
      React.createElement(
        "div",
        { className: "container site-header__bar" },
        React.createElement(Link, { href: "/", className: "site-brand" }, SITE_PROFILE.name),
        React.createElement(
          "div",
          { className: "site-header__actions" },
          React.createElement(
            "button",
            {
              type: "button",
              className: "search-trigger",
              onClick: () => setSearchOpen(true),
              "aria-label": "Open search",
            },
            "Search",
            React.createElement("kbd", null, "⌘K"),
          ),
          mobile
            ? React.createElement(
                "button",
                {
                  type: "button",
                  className: "nav-toggle",
                  onClick: () => setNavOpen((o) => !o),
                  "aria-label": navOpen ? "Close menu" : "Menu",
                  "aria-expanded": navOpen,
                  "aria-controls": "site-nav-mobile",
                },
                navOpen ? "✕" : "☰",
              )
            : navLinks("site-nav"),
        ),
      ),
      mobile && navOpen ? navLinks("container site-nav site-nav--mobile") : null,
    ),
    React.createElement("main", { id: "main", className: "container" }, body),
    React.createElement(SearchPalette, {
      open: searchOpen,
      onClose: () => setSearchOpen(false),
      onNavigate: navigate,
      result: searchResult,
      query: searchQuery,
      onQueryChange: setSearchQuery,
    }),
    React.createElement(
      "footer",
      { className: "container site-footer" },
      React.createElement(
        "nav",
        { "aria-label": "Site" },
        NAV_ITEMS.map(([label, target], i) =>
          React.createElement(
            React.Fragment,
            { key: target.name },
            i === 0
              ? null
              : React.createElement(
                  "span",
                  { className: "site-footer__sep", "aria-hidden": true },
                  "·",
                ),
            React.createElement(Link, { href: routeFor(target) }, label),
          ),
        ),
      ),
      SITE_CONFIG.demo
        ? React.createElement(
            "span",
            null,
            "Demo corpus — replace content/ with your own YAML",
          )
        : null,
      React.createElement("span", null, `© ${SITE_PROFILE.name}`),
      React.createElement("span", { className: "site-footer__route" }, routeFor(view)),
    ),
  );
}

const root = document.getElementById("root");
if (root) {
  ReactDOM.render(React.createElement(App), root);
}
