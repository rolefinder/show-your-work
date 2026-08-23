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

/**
 * One course you passed. `content/courses/<slug>.yaml`.
 *
 * The authority already wrote the skill list. A syllabus's learning-outcomes
 * section — "upon successful completion of this course, students will be able
 * to…" — is written by the faculty who teach it, reviewed through curriculum
 * approval, and published before the semester starts. Nobody has to invent a
 * taxonomy; it has to be read.
 *
 * But a syllabus establishes what a course TAUGHT, not what a student DID.
 * Passing a database course is not evidence of having modelled a schema. So
 * `taught` is candidate vocabulary and never publishes on its own: `skills`
 * below is DERIVED at emit time as the subset of `taught` that a linked
 * project already claims. The remainder never reaches this type at all — see
 * `bun run skills:gap`, which reads the YAML instead.
 */
export type CourseItem = {
  slug: string;
  institution: string;
  /** Catalogue code, e.g. "MIS 315". Rendered; deliberately not matchable. */
  code: string;
  /** Course title as the institution publishes it. */
  name: string;
  /** Free text, e.g. "2022-05" or "Spring 2022". Rendered verbatim. */
  completed: string;
  /** Learning outcomes, quoted from the syllabus rather than paraphrased. */
  outcomes: string[];
  /** The gated subset of `taught` — every label here is claimed by a linked
      project. Emitted, not authored: `taught:` is what the YAML carries. */
  skills: string[];
  /** Work slugs produced in this course. A visible course needs at least one:
      a transcript line is not a portfolio entry. */
  projects: string[];
  visible: boolean;
};

/**
 * One professional certification. `content/certifications/<slug>.yaml`.
 *
 * The same kind of source as a course with its evidential shape inverted. A
 * syllabus publishes a checkable curriculum and an unverifiable pass; a
 * certification publishes a **verifiable pass** — a credential ID anyone can
 * check with the issuer, the only fact on the site that does not rest on the
 * candidate's word — and an unverifiable capability. Issuers say so plainly:
 * AWS frames a year of hands-on experience as something its exam assumes
 * rather than something it verifies.
 *
 * So `skills` is gated exactly as a course's is, and the credential itself is
 * an accolade rather than evidence.
 */
export type CertificationItem = {
  slug: string;
  /** Awarding body, e.g. "Amazon Web Services". */
  issuer: string;
  /** Certification name as the issuer publishes it. */
  name: string;
  /** YYYY-MM or YYYY-MM-DD. */
  earned: string;
  /** YYYY-MM or YYYY-MM-DD. The one machine-readable decay date in the whole
      corpus — every other content type makes you infer staleness from a date.
      `bun run ready` warns when it has passed. */
  expires?: string;
  /** Public verification number printed on the certificate. Not a secret: it
      exists to be handed to someone who wants to check it with the issuer. */
  credentialId?: string;
  /** Where the issuer verifies it. https only. */
  verifyUrl?: string;
  /** Gated subset of `taught` — same rule as a course. */
  skills: string[];
  projects: string[];
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
  kind: "about" | "work" | "blog" | "experience" | "education";
  title: string;
  url: string;
  /** The matchable half of `title`, when the two differ.
   *
   *  `title` is what a citation is labelled with, and it normally scores too.
   *  A credential name cannot: "BS, Information Systems" is a bag of generic
   *  tokens that would hit half the postings in the industry, which is the
   *  collision ADR 027 refused education over. Education therefore names its
   *  own citation and matches on nothing but its achievements — `titleText: ""`.
   *  Absent means the title is matchable, which is every other kind. */
  titleText?: string;
  text: string;
  skills: string[];
  /** Self-contained statements (outcome + evidence bullets) preferred as quotes. */
  claims?: string[];
  /** skill label → how it applied here; quoted instead of a bare skill tag. */
  skillNotes?: Record<string, string>;
};
