import type { BlogPost, EvidenceDoc, SiteProfile, WorkItem } from "../types";

/** Build a flat evidence pack from site content (visible only). */
export function buildEvidencePack(
  profile: SiteProfile,
  work: WorkItem[],
  blog: BlogPost[],
): EvidenceDoc[] {
  const docs: EvidenceDoc[] = [
    {
      id: "about",
      kind: "about",
      title: `${profile.name} — About`,
      url: "/about",
      text: [profile.summary, profile.tagline, profile.skills.join(" ")].join(" "),
      skills: profile.skills.slice(),
    },
  ];

  for (const w of work) {
    if (w.visible === false) continue;
    docs.push({
      id: `work:${w.slug}`,
      kind: "work",
      title: w.title,
      url: `/work/${w.slug}`,
      text: [w.title, w.summary, w.body, w.skills.join(" ")].join(" "),
      skills: w.skills.slice(),
    });
  }

  for (const b of blog) {
    if (b.visible === false) continue;
    docs.push({
      id: `blog:${b.slug}`,
      kind: "blog",
      title: b.title,
      url: `/blog/${b.slug}`,
      text: [b.title, b.summary, b.body, b.skills.join(" ")].join(" "),
      skills: b.skills.slice(),
    });
  }

  return docs;
}

export function packToJson(docs: EvidenceDoc[]): string {
  return JSON.stringify({ version: 1, docs }, null, 2);
}
