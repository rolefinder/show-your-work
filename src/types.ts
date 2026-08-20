export type SiteProfile = {
  name: string;
  tagline: string;
  location: string;
  email: string;
  summary: string;
  skills: string[];
  /* Profile URLs, keyed by platform: { github: "https://…", youtube: "…" }.
     A map rather than fixed fields so adding a platform is a content edit, not
     a code change — the display label is derived from the key. Full URLs, not
     handles: the site never guesses how a platform builds a profile address.
     Authoring order is preserved and drives render order. */
  links: Record<string, string>;
};

/** Deployment identity, from content/config/site.yaml. Never hardcode these. */
export type SiteConfig = {
  origin: string;
  titleSuffix: string;
  description: string;
  shortName: string;
  themeColor: string;
  themeColorDark: string;
  demo: boolean;
  /* Where this deploys. GitHub Pages cannot set response headers at all, so
     `_headers` is inert there and the CSP has to ship as a <meta http-equiv>
     instead — a weaker policy, and the build says so rather than implying
     parity. See docs/guide/deploy.md and ADR 021. */
  deployTarget: "github-pages" | "cloudflare-pages";
  /** Optional custom domain. On GitHub Pages this is emitted as dist/CNAME. */
  customDomain: string;
  /* Adopter palette overrides from site.yaml `theme:`. Empty means "use the
     shipped palette". Written into dist/tokens/adopter.css at build time so
     theming never means editing a file under tokens/. */
  theme: Partial<Record<"accent" | "accentDeep" | "bg" | "fg", string>>;
  /* Which classes of AI crawler robots.txt invites. A single `User-agent: *`
     cannot express this: the bots do three different jobs, and for a portfolio
     the search-index ones are the whole point — they are how an assistant asked
     about you cites a real page instead of guessing. See ADR 031. */
  aiCrawlers: { search: boolean; training: boolean };
};

/**
 * One entry in a `body`. A plain string is a paragraph — the shape every body
 * had before this existed, and still the common case. The grammar and its
 * authoring form are documented in packages/content/body.py, which normalizes
 * an authored `body:` into this array at emit time; nothing downstream ever
 * sees the bare-string form.
 *
 * `image` and `figure` belong in this union too, and are not here yet: each
 * needs a subsystem that does not exist (an asset pipeline, a diagram kit).
 * Adding a variant is additive, which is why they can wait.
 */
export type BodyBlock =
  | string
  | { h2: string }
  | { h3: string }
  | { list: string[]; ordered?: boolean }
  | { quote: string; cite?: string }
  | { code: string; lang?: string }
  | { note: string };

export type WorkItem = {
  slug: string;
  title: string;
  summary: string;
  body: BodyBlock[];
  skills: string[];
  visible: boolean;
  date?: string;
  /* ---- Editorial contract (all optional; the brief renders what exists) ----
     These are the fields a recruiter actually reads, and the ones Fit quotes:
     outcome and evidence become self-contained `claims` in the evidence pack,
     so a citation is a whole statement instead of a 160-char window cut out of
     the middle of a paragraph. */
  problem?: string;
  outcome?: string;
  evidence?: string[];
  decisions?: string[];
  /** skill label → how it applied on THIS project (contextual tooltip half). */
  skillNotes?: Record<string, string>;
};

export type BlogPost = {
  slug: string;
  title: string;
  summary: string;
  body: BodyBlock[];
  skills: string[];
  visible: boolean;
  date?: string;
};

/** One role. `content/experience/<slug>.yaml`. */
export type ExperienceItem = {
  slug: string;
  /** Employer or client. Shown as the heading; also the JSON-LD organization. */
  organization: string;
  /** Your title in the role. */
  role: string;
  /** Free text, e.g. "2023-04" or "2023". Rendered verbatim — the template
      never parses or reformats a date it did not generate. */
  start: string;
  /** Absent means current, which renders as "Present". */
  end?: string;
  location?: string;
  summary: string;
  /** What you did, one statement per entry. Quoted by Fit as whole claims. */
  highlights: string[];
  skills: string[];
  /** Curated work slugs built during this role. Explicit, never date-inferred:
      a personal project can run alongside a job and a project can straddle a
      role change, so a date range gets both cases wrong. */
  projects: string[];
  visible: boolean;
};

/** One credential. `content/education/<slug>.yaml`. */
export type EducationItem = {
  slug: string;
  institution: string;
  credential: string;
  date: string;
  honors?: string;
  achievements: string[];
  visible: boolean;
};

export type FitStatus =
  | "aligned"
  | "partial"
  | "missing"
  | "not_evidenced_on_site";

export type FitPriority = "must" | "nice" | "soft";

export type FitEvidence = {
  title: string;
  url: string;
  quote_or_skill: string;
};

export type FitRequirement = {
  text: string;
  priority: FitPriority;
  status: FitStatus;
  why: string;
  evidence: FitEvidence[];
};

export type FitBrief = {
  role_read: string;
  requirements: FitRequirement[];
  strongest_matches: FitEvidence[];
  gaps: string[];
  caveats: string[];
};

export type EvidenceDoc = {
  id: string;
  kind: "about" | "work" | "blog" | "experience";
  title: string;
  url: string;
  text: string;
  skills: string[];
  /** Self-contained statements (outcome + evidence bullets) preferred as quotes. */
  claims?: string[];
  /** skill label → how it applied here; quoted instead of a bare skill tag. */
  skillNotes?: Record<string, string>;
};
