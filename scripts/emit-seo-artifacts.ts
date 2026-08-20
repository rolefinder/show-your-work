#!/usr/bin/env bun
// Build-time SEO artifacts: sitemap.xml, robots.txt, llms.txt, and
// known-paths.json.
//
// known-paths.json is load-bearing, not cosmetic — functions/_middleware.js
// uses it to tell "unknown route" apart from "known route", and to decide
// 200 vs 404. Every artifact here is derived from scripts/lib/routes.ts, the
// same table the prerenderer walks, so they cannot drift apart.
//
// Usage: bun scripts/emit-seo-artifacts.ts

import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE_CONFIG, SITE_PROFILE } from "../src/generated/content";
import { linkLabel } from "../src/profile-links";
import { buildRoutes, knownPaths, visibleBlog, visibleExperience, visibleWork } from "./lib/routes";
import { SITE } from "./lib/site-meta";
import { bodyFullText, bodyText } from "../src/content/bodyText";
/* Cross-link tokens are markup for the renderer, not prose. Left in, an
   answer engine quotes "{{work:slug|Label}}" back at a reader verbatim. */
import { stripTokens } from "../src/search/richText";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * llms.txt — the AEO counterpart to robots.txt: a plain-text map of the site
 * for language models, so an assistant asked about this person can cite real
 * pages instead of guessing. https://llmstxt.org
 */
function llmsTxt(): string {
  const lines = [
    `# ${SITE_PROFILE.name}`,
    "",
    `> ${SITE_PROFILE.tagline}`,
    "",
    SITE_PROFILE.summary,
    "",
    `Location: ${SITE_PROFILE.location}`,
    `Contact: ${SITE_PROFILE.email}`,
  ];
  for (const [key, href] of Object.entries(SITE_PROFILE.links)) {
    lines.push(`${linkLabel(key)}: ${href}`);
  }
  lines.push("", "## Work", "");
  for (const w of visibleWork) {
    lines.push(`- [${w.title}](${SITE}/work/${w.slug}): ${stripTokens(w.summary).replace(/\s+/g, " ").trim()}`);
  }
  lines.push("", "## Writing", "");
  for (const b of visibleBlog) {
    lines.push(`- [${b.title}](${SITE}/blog/${b.slug}): ${stripTokens(b.summary).replace(/\s+/g, " ").trim()}`);
  }
  lines.push("", "## Skills", "", SITE_PROFILE.skills.join(", "), "");
  lines.push("## Tools", "");
  lines.push(
    `- [Fit](${SITE}/fit): paste a job description, get a brief where every aligned claim cites a page above.`,
    `- [Graph](${SITE}/graph): how the work connects.`,
    `- [Evidence pack](${SITE}/evidence.json): every page above as JSON — id, title, canonical URL, full text, skills.`,
  );
  /* Only advertise the MCP endpoint where it can actually run. GitHub Pages
     serves no Functions, so listing it there would send every agent that reads
     this file to a 404. evidence.json above is the static equivalent and works
     on both targets. */
  if (HAS_FUNCTIONS) {
    lines.push(
      `- [MCP](${SITE}/api/mcp): Model Context Protocol endpoint (streamable-http, read-only, ` +
        "protocol 2026-07-28 with legacy fallback) — tools: list_pages, get_page, fit_brief. " +
        "No model runs server-side.",
    );
  }
  lines.push("");
  return lines.join("\n");
}

/**
 * llms-full.txt — the whole corpus as one plain-text document.
 *
 * llms.txt is an index: titles, summaries and links. An answer engine that
 * wants to quote you accurately still has to fetch every page. This is the
 * expansion, so one request gets the full text — which is the difference
 * between being summarized from a one-line description and being quoted from
 * what you actually wrote.
 *
 * Built from the same body grammar the pages render (ADR 029), so it cannot
 * drift from what a reader sees.
 */
function llmsFullTxt(): string {
  const lines = [
    `# ${SITE_PROFILE.name} — full text`,
    "",
    `> ${SITE_PROFILE.tagline}`,
    "",
    "Every published page on this site, in full. The index is at " + `${SITE}/llms.txt`,
    "",
    "## About",
    "",
    SITE_PROFILE.summary,
    "",
    `Location: ${SITE_PROFILE.location}`,
    `Contact: ${SITE_PROFILE.email}`,
    "",
  ];

  for (const [heading, items, prefix] of [
    ["Work", visibleWork, "work"],
    ["Writing", visibleBlog, "blog"],
  ] as const) {
    if (!items.length) continue;
    lines.push(`## ${heading}`, "");
    for (const item of items) {
      lines.push(`### ${item.title}`, "", `URL: ${SITE}/${prefix}/${item.slug}`);
      if (item.date) lines.push(`Date: ${item.date}`);
      if (item.skills?.length) lines.push(`Skills: ${item.skills.join(", ")}`);
      lines.push("", stripTokens(item.summary).replace(/\s+/g, " ").trim(), "");

      /* The editorial contract, which the page renders above the body and Fit
         *prefers* to quote — outcome and evidence are whole authored claims.
         Omitting them made a file advertised as "the page in full" miss the
         most citable copy on it. */
      const contract: [string, string | string[] | undefined][] = [
        ["Problem", (item as { problem?: string }).problem],
        ["Outcome", (item as { outcome?: string }).outcome],
        ["Evidence", (item as { evidence?: string[] }).evidence],
        ["Key decisions", (item as { decisions?: string[] }).decisions],
      ];
      for (const [label, value] of contract) {
        if (!value || (Array.isArray(value) && !value.length)) continue;
        lines.push(`${label}:`);
        for (const entry of Array.isArray(value) ? value : [value]) {
          lines.push(`- ${stripTokens(String(entry)).replace(/\s+/g, " ").trim()}`);
        }
        lines.push("");
      }

      const body = bodyFullText(item.body, stripTokens);
      if (body) lines.push(body, "");
    }
  }

  /* Experience is one page with an anchor per role, not a page per item, so it
     cannot go through the loop above. It is included because the file claims
     to be every published page in full — and because highlights are whole
     authored claims, which is exactly the copy Fit prefers to quote. */
  if (visibleExperience.length) {
    lines.push("## Experience", "");
    for (const e of visibleExperience) {
      lines.push(
        `### ${e.role} — ${e.organization}`,
        "",
        `URL: ${SITE}/experience#${e.slug}`,
        `Dates: ${e.start} – ${e.end || "Present"}`,
      );
      if (e.location) lines.push(`Location: ${e.location}`);
      if (e.skills?.length) lines.push(`Skills: ${e.skills.join(", ")}`);
      lines.push("", stripTokens(e.summary).replace(/\s+/g, " ").trim(), "");
      if (e.highlights?.length) {
        lines.push("Highlights:");
        for (const h of e.highlights) {
          lines.push(`- ${stripTokens(String(h)).replace(/\s+/g, " ").trim()}`);
        }
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

/*
 * Pages Functions exist on Cloudflare Pages and nowhere else. On the
 * GitHub Pages target /api/* is simply absent, so advertising an MCP endpoint
 * there would publish a discovery document pointing at a 404 — worse than
 * publishing nothing, because an agent would treat it as broken rather than
 * missing.
 *
 * Written as "not github-pages" rather than "is cloudflare-pages" so that a
 * third target that does run Functions is covered without editing this line.
 */
const HAS_FUNCTIONS = SITE_CONFIG.deployTarget !== "github-pages";

/**
 * AI crawlers, grouped by the job they actually do.
 *
 * `User-agent: *` cannot express intent here, because these bots are not one
 * audience. Blocking the wrong group is the most common way a site disappears
 * from AI answers while its owner believes it is fully indexed.
 *
 * Tokens and behaviours are from each vendor's own bot documentation, not
 * inferred: OpenAI publishes GPTBot/OAI-SearchBot/ChatGPT-User with their
 * purposes, and Anthropic splits ClaudeBot (training), Claude-SearchBot
 * (search index) and Claude-User (user-initiated).
 */
const AI_CRAWLERS = {
  /* Index your pages so an assistant can cite them. For a portfolio this IS
     the distribution channel — block these and ChatGPT Search, Claude and
     Perplexity stop surfacing you. */
  search: ["OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"],
  /* Fetch one page because a user asked about it right now. Closest thing to a
     real reader, and the likeliest to be a recruiter mid-conversation.
     Grouped with search because blocking them serves no one. */
  userInitiated: ["ChatGPT-User", "Claude-User", "Perplexity-User"],
  /* Collect content into model training corpora. The genuine judgement call:
     no per-visit referral, but it is what lets a model answer about you at all
     without a live fetch. */
  training: [
    "GPTBot",
    "ClaudeBot",
    "Google-Extended",
    "Applebot-Extended",
    "CCBot",
    "Meta-ExternalAgent",
    "Bytespider",
  ],
};

function robotsGroup(comment: string, agents: string[], allow: boolean): string {
  return [
    `# ${comment}`,
    ...agents.map((a) => `User-agent: ${a}`),
    allow ? "Allow: /" : "Disallow: /",
    "",
  ].join("\n");
}

/**
 * robots.txt — the AEO surface, not just the SEO one.
 *
 * Ordinary search engines keep the blanket allow. The AI groups are stated
 * explicitly so the file records a decision rather than a default, and so an
 * adopter reading it can see which switch controls what.
 */
function robotsTxt(): string {
  const { search, training } = SITE_CONFIG.aiCrawlers;
  const out = [
    "# Web search engines.",
    "User-agent: *",
    "Allow: /",
    "",
    robotsGroup(
      "AI answer engines — indexing for citation. This is how an assistant asked\n# about this person cites a real page instead of guessing.",
      AI_CRAWLERS.search,
      search,
    ),
    robotsGroup(
      "User-initiated fetches — someone asked an assistant about this page right\n# now. Note ChatGPT-User and Perplexity-User may not apply robots.txt at all,\n# since the request came from a person; Claude-User honours it.",
      AI_CRAWLERS.userInitiated,
      search,
    ),
    robotsGroup(
      training
        ? "Model training corpora — allowed."
        : "Model training corpora — opted out. Note Google-Extended governs Gemini\n# only and has no effect on Google Search ranking.",
      AI_CRAWLERS.training,
      training,
    ),
    `Sitemap: ${SITE}/sitemap.xml`,
    "",
  ];
  return out.join("\n");
}

/**
 * .well-known/mcp.json — registry-style discovery, so an agent handed only the
 * domain can find the endpoint rather than being told about it out of band.
 */
function mcpManifest(): string {
  return (
    JSON.stringify(
      {
        name: `${SITE_PROFILE.name} — portfolio`,
        description:
          "Read-only portfolio corpus: enumerate published pages, read one, or score a job description against published evidence.",
        remotes: [{ type: "streamable-http", url: `${SITE}/api/mcp` }],
      },
      null,
      2,
    ) + "\n"
  );
}

export function emitSeoArtifacts(): void {
  const routes = buildRoutes();
  const paths = knownPaths();

  if (SITE_CONFIG.origin.includes("example.com")) {
    console.warn(
      "emit-seo-artifacts: content/config/site.yaml still has the placeholder " +
        `origin (${SITE_CONFIG.origin}) - sitemap.xml/robots.txt/llms.txt will ship with it. ` +
        "Set your real domain before deploying somewhere that will actually be crawled.",
    );
  }

  /* <lastmod> where the content carries a date. AI citation has a strong
     recency bias, and a sitemap with no freshness signal makes a page that was
     updated last week look identical to one from two years ago. Authored dates
     may be "YYYY-MM"; sitemaps want a full date, so a month widens to its
     first day rather than being dropped. */
  const lastmod = (date?: string) =>
    date ? `\n    <lastmod>${escapeXml(/^\d{4}-\d{2}$/.test(date) ? `${date}-01` : date)}</lastmod>` : "";

  const sitemap =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    routes
      .filter((r) => !r.noindex)
      .map((r) => `  <url>\n    <loc>${escapeXml(SITE + r.path)}</loc>${lastmod(r.date)}\n  </url>`)
      .join("\n") +
    "\n</urlset>\n";

  const robots = robotsTxt();

  mkdirSync(dist, { recursive: true });
  writeFileSync(join(dist, "sitemap.xml"), sitemap, "utf8");
  writeFileSync(join(dist, "robots.txt"), robots, "utf8");
  writeFileSync(join(dist, "llms.txt"), llmsTxt(), "utf8");
  writeFileSync(join(dist, "llms-full.txt"), llmsFullTxt(), "utf8");
  writeFileSync(join(dist, "known-paths.json"), JSON.stringify(paths), "utf8");

  if (HAS_FUNCTIONS) {
    mkdirSync(join(dist, ".well-known"), { recursive: true });
    writeFileSync(join(dist, ".well-known", "mcp.json"), mcpManifest(), "utf8");
  }

  console.log(
    `emit-seo-artifacts: ok - ${paths.length} sitemap URLs, ${paths.length} known paths, ` +
      `llms.txt + llms-full.txt (origin=${SITE})` +
      (HAS_FUNCTIONS ? ", .well-known/mcp.json" : " - no MCP manifest (deploy target has no Functions)"),
  );
}

// Still runnable on its own; scripts/emit-artifacts.ts imports it instead
// so the pair runs in one process, in the order known-paths.json needs.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  emitSeoArtifacts();
}
