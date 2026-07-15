import { BLOG, SITE_ORIGIN, SITE_PROFILE, SKILL_CATEGORIES, WORK } from "./generated/content";
import { buildEvidencePack } from "./fit/evidence";
import { FitPage } from "./fit/FitPage";
import { buildKnowledgeGraph } from "./graph/buildKnowledgeGraph";
import { GraphPage } from "./graph/GraphPage";
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
  | { name: "fit" }
  | { name: "graph" }
  | { name: "notfound"; path: string };

function viewFor(path: string): View {
  const seg = path.split("/").filter(Boolean);
  if (!seg.length) return { name: "home" };
  if (seg[0] === "about") return { name: "about" };
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
  if (view.name === "fit") return "/fit";
  if (view.name === "graph") return "/graph";
  if (view.name === "work") return "/work";
  if (view.name === "workDetail") return "/work/" + view.slug;
  if (view.name === "blog") return "/blog";
  if (view.name === "blogDetail") return "/blog/" + view.slug;
  if (view.name === "notfound") return view.path;
  return "/";
}

function titleFor(view: View): string {
  if (view.name === "about") return `About — ${SITE_PROFILE.name}`;
  if (view.name === "work") return `Work — ${SITE_PROFILE.name}`;
  if (view.name === "workDetail") {
    const w = WORK.find((x) => x.slug === view.slug);
    if (w) return `${w.title} — ${SITE_PROFILE.name}`;
  }
  if (view.name === "blog") return `Blog — ${SITE_PROFILE.name}`;
  if (view.name === "blogDetail") {
    const b = BLOG.find((x) => x.slug === view.slug);
    if (b) return `${b.title} — ${SITE_PROFILE.name}`;
  }
  if (view.name === "fit") return `Fit — ${SITE_PROFILE.name}`;
  if (view.name === "graph") return `Graph — ${SITE_PROFILE.name}`;
  if (view.name === "notfound") return `Page Not Found — ${SITE_PROFILE.name}`;
  return `${SITE_PROFILE.name} — recruit-me demo`;
}

function App() {
  const [path, setPath] = React.useState(() => window.location.pathname || "/");
  const [search, setSearch] = React.useState(() => window.location.search || "");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const view = viewFor(path);
  const visibleWork = WORK.filter((w) => w.visible !== false);
  const visibleBlog = BLOG.filter((b) => b.visible !== false);
  const docs = React.useMemo(
    () => buildEvidencePack(SITE_PROFILE, WORK, BLOG),
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
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
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

  function navigate(next: string) {
    const url = new URL(next, window.location.origin);
    const full = url.pathname + url.search;
    if (window.location.pathname + window.location.search !== full) {
      window.history.pushState(null, "", full);
    }
    setPath(url.pathname);
    setSearch(url.search);
    window.scrollTo(0, 0);
  }

  function Link(props: { href: string; children?: React.ReactNode; className?: string }) {
    return React.createElement(
      "a",
      {
        href: props.href,
        className: props.className,
        onClick: (e: React.MouseEvent) => {
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
      React.createElement("p", { className: "eyebrow" }, "recruit-me demo"),
      React.createElement("h1", null, SITE_PROFILE.name),
      React.createElement("p", { className: "lede" }, SITE_PROFILE.tagline),
      React.createElement("p", null, SITE_PROFILE.summary),
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
      React.createElement("h1", null, "About"),
      React.createElement("p", null, SITE_PROFILE.summary),
      React.createElement("p", { className: "muted" }, SITE_PROFILE.location),
      React.createElement(
        "ul",
        { className: "tags" },
        SITE_PROFILE.skills.map((s) => React.createElement("li", { key: s }, s)),
      ),
    );
  } else if (view.name === "work") {
    body = React.createElement(
      "section",
      { className: "page" },
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
        { className: "card-list" },
        filteredWork.length
          ? filteredWork.map((w) =>
              React.createElement(
                "li",
                { key: w.slug },
                React.createElement(Link, { href: "/work/" + w.slug }, React.createElement("strong", null, w.title)),
                React.createElement("p", null, w.summary),
              ),
            )
          : React.createElement("li", null, React.createElement("p", { className: "muted" }, "No work matches these skills.")),
      ),
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
          React.createElement(Link, { href: "/work", className: "muted" }, "← Work"),
          React.createElement("h1", null, w.title),
          React.createElement("p", { className: "lede" }, w.summary),
          React.createElement("p", null, richText(w.body, navigate)),
          React.createElement(
            "ul",
            { className: "tags" },
            w.skills.map((s) =>
              React.createElement(
                "li",
                { key: s },
                React.createElement(Link, { href: "/work" + searchFromSkills([s]) }, s),
              ),
            ),
          ),
        )
      : React.createElement("section", { className: "page" }, React.createElement("h1", null, "Not found"));
  } else if (view.name === "blog") {
    body = React.createElement(
      "section",
      { className: "page" },
      React.createElement("h1", null, "Blog"),
      React.createElement(
        "ul",
        { className: "card-list" },
        visibleBlog.map((b) =>
          React.createElement(
            "li",
            { key: b.slug },
            React.createElement(Link, { href: "/blog/" + b.slug }, React.createElement("strong", null, b.title)),
            React.createElement("p", null, b.summary),
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
          React.createElement(Link, { href: "/blog", className: "muted" }, "← Blog"),
          React.createElement("h1", null, b.title),
          React.createElement("p", { className: "lede" }, b.summary),
          React.createElement("p", null, richText(b.body, navigate)),
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

  return React.createElement(
    "div",
    { className: "shell" },
    React.createElement(
      "header",
      { className: "topnav" },
      React.createElement(Link, { href: "/", className: "brand" }, SITE_PROFILE.name),
      React.createElement(
        "nav",
        null,
        React.createElement(Link, { href: "/about" }, "About"),
        React.createElement(Link, { href: "/work" }, "Work"),
        React.createElement(Link, { href: "/blog" }, "Blog"),
        React.createElement(Link, { href: "/graph" }, "Graph"),
        React.createElement(Link, { href: "/fit" }, "Fit"),
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
      ),
    ),
    React.createElement("main", null, body),
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
      { className: "site-footer" },
      React.createElement("span", null, "Demo corpus · Avery Quill (fictional) · Apache-2.0"),
      React.createElement("span", { className: "muted" }, " route " + routeFor(view)),
    ),
  );
}

const root = document.getElementById("root");
if (root) {
  ReactDOM.render(React.createElement(App), root);
}
