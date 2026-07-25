/**
 * Display labels for profile-link keys.
 *
 * Shared by the contact row (browser) and llms.txt (build script), so it is a
 * plain module with no React import — a build script must not pull the app in.
 *
 * Only platforms whose casing isn't a capitalized key need an entry. Everything
 * else falls back, which is what keeps "add a platform" a content edit:
 * `mastodon: https://…` renders "Mastodon" with no code change.
 */
const LINK_LABELS: Record<string, string> = {
  github: "GitHub",
  gitlab: "GitLab",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  stackoverflow: "Stack Overflow",
  x: "X",
};

export function linkLabel(key: string): string {
  return LINK_LABELS[key.toLowerCase()] || key.charAt(0).toUpperCase() + key.slice(1);
}
