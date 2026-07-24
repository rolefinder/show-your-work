export type ProfileLink = {
  label: string;
  href: string;
};

export type SiteProfile = {
  name: string;
  tagline: string;
  location: string;
  email: string;
  summary: string;
  skills: string[];
  links: ProfileLink[];
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
};

export type WorkItem = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  skills: string[];
  visible: boolean;
  date?: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  skills: string[];
  visible: boolean;
  date?: string;
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
  kind: "about" | "work" | "blog";
  title: string;
  url: string;
  text: string;
  skills: string[];
};
