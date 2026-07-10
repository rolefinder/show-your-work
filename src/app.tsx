import type { BlogPost, SiteProfile, WorkItem } from "./types";
import { buildEvidencePack } from "./fit/evidence";
import { FitPage } from "./fit/FitPage";
import { buildKnowledgeGraph } from "./graph/buildKnowledgeGraph";
import { GraphPage } from "./graph/GraphPage";
import {
  buildSkillBankGroups,
  collectSkillCounts,
  searchFromSkills,
  SkillBank,
  skillsFromSearch,
  type SkillCategoryConfig,
} from "./skills/SkillBank";

/* BEGIN SITE_PROFILE */
const SITE_PROFILE: SiteProfile = {
  name: "Avery Quill",
  tagline: "Platform engineer who ships evidence-backed portfolios",
  location: "Portland, OR (fictional demo)",
  email: "avery.quill@example.com",
  summary: "Avery Quill is a fictional demo persona for the recruit-me template. They focus on CI/CD, Cloudflare Pages, and turning published work into recruiter-ready evidence — never inventing employers or years.",
  skills: ["CI/CD", "GitHub Actions", "Cloudflare Pages", "TypeScript", "Python", "YAML content pipelines"],
};
/* END SITE_PROFILE */

/* BEGIN WORK */
const WORK: WorkItem[] = [
  {
    slug: "harbor-gate",
    title: "Harbor Gate",
    summary: "A CI/CD gate that blocks merges until smoke checks and content emit pass on Cloudflare Pages.",
    body: "Harbor Gate wires GitHub Actions to a Pages preview deploy, runs fit-smoke and build gates, and publishes a deterministic evidence pack. It demonstrates continuous integration, continuous delivery, and pipeline design without claiming Kubernetes or multi-cloud ops.",
    skills: ["CI/CD", "GitHub Actions", "Cloudflare Pages", "pipelines", "TypeScript"],
    visible: true,
    date: "2026-06",
  },
  {
    slug: "quill-emit",
    title: "Quill Emit",
    summary: "YAML-to-SPA content emitter that keeps portfolio copy out of hand-edited bundles.",
    body: "Quill Emit reads content/about, content/work, and content/blog YAML, validates slugs, and splices typed SITE_PROFILE / WORK / BLOG blocks into the TypeScript app. Humans edit YAML; the build owns the emitted markers.",
    skills: ["Python", "YAML", "content pipelines", "TypeScript"],
    visible: true,
    date: "2026-05",
  }
];
/* END WORK */

/* BEGIN BLOG */
const BLOG: BlogPost[] = [
  {
    slug: "cite-or-missing",
    title: "Cite or missing: recruiter Fit without hallucination",
    summary: "Why a JD fit brief should refuse aligned claims without citations.",
    body: "Recruiters need requirement-to-evidence mapping, not a chatty bio bot. The cite-or-missing contract marks gaps honestly and links only to published /work and /blog pages. Deterministic matchers are a safe v1; RAG can swap in later behind the same JSON shape.",
    skills: ["Fit", "evidence", "CI/CD"],
    visible: true,
    date: "2026-07",
  }
];
/* END BLOG */

/* BEGIN SKILL_CATEGORIES */
const SKILL_CATEGORIES: SkillCategoryConfig = {
  fallback: "Other",
  order: ["Platform & delivery", "Languages & content", "Fit & evidence", "Other"],
  map: {
    "CI/CD": "Platform & delivery",
    "GitHub Actions": "Platform & delivery",
    "Cloudflare Pages": "Platform & delivery",
    "pipelines": "Platform & delivery",
    "TypeScript": "Languages & content",
    "Python": "Languages & content",
    "YAML": "Languages & content",
    "content pipelines": "Languages & content",
    "YAML content pipelines": "Languages & content",
    "Fit": "Fit & evidence",
    "evidence": "Fit & evidence"
  },
};
/* END SKILL_CATEGORIES */

type View =
  | { name: "home" }
  | { name: "about" }
  | { name: "work" }
  | { name: "workDetail"; slug: string }
  | { name: "blog" }
  | { name: "blogDetail"; slug: string }
  | { name: "fit" }
  | { name: "graph" };

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
  return { name: "home" };
}

function routeFor(view: View): string {
  if (view.name === "about") return "/about";
  if (view.name === "fit") return "/fit";
  if (view.name === "graph") return "/graph";
  if (view.name === "work") return "/work";
  if (view.name === "workDetail") return "/work/" + view.slug;
  if (view.name === "blog") return "/blog";
  if (view.name === "blogDetail") return "/blog/" + view.slug;
  return "/";
}

function App() {
  const [path, setPath] = React.useState(() => window.location.pathname || "/");
  const [search, setSearch] = React.useState(() => window.location.search || "");
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
  const activeSkills = React.useMemo(() => skillsFromSearch(search), [search]);

  React.useEffect(() => {
    const onPop = () => {
      setPath(window.location.pathname || "/");
      setSearch(window.location.search || "");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
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
          React.createElement("p", null, w.body),
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
          React.createElement("p", null, b.body),
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
      ),
    ),
    React.createElement("main", null, body),
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
