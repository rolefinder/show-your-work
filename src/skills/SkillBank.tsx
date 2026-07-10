export type SkillCategoryConfig = {
  /** Display order of category names. Unlisted skills fall into fallback. */
  order: string[];
  /** skill label → category name */
  map: Record<string, string>;
  /** Category for unmapped skills (default "Other") */
  fallback?: string;
};

export type SkillBankItem = {
  label: string;
  count: number;
  color: string;
  pressed: boolean;
  onClick: () => void;
};

export type SkillBankGroup = {
  name: string;
  items: SkillBankItem[];
};

const SKILL_PALETTE = [
  "#0f5c4c",
  "#2a6f97",
  "#bc6c25",
  "#6a4c93",
  "#3d5a80",
  "#9b2226",
  "#52796f",
  "#b56576",
];

export function skillColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return SKILL_PALETTE[Math.abs(h) % SKILL_PALETTE.length];
}

export function skillCategory(
  skill: string,
  config: SkillCategoryConfig,
): string {
  return config.map[skill] || config.fallback || "Other";
}

export function collectSkillCounts(
  items: { skills?: string[] }[],
): { allSkills: string[]; counts: Record<string, number> } {
  const counts: Record<string, number> = {};
  for (const item of items) {
    for (const s of item.skills || []) {
      counts[s] = (counts[s] || 0) + 1;
    }
  }
  const allSkills = Object.keys(counts).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" }),
  );
  return { allSkills, counts };
}

export function buildSkillBankGroups(
  allSkills: string[],
  counts: Record<string, number>,
  activeSet: Set<string> | string[],
  onToggle: (label: string) => void,
  config: SkillCategoryConfig,
): SkillBankGroup[] {
  const active =
    activeSet instanceof Set
      ? activeSet
      : new Set(activeSet || []);
  const catMap: Record<string, SkillBankItem[]> = {};
  const fallback = config.fallback || "Other";
  const order = config.order.includes(fallback)
    ? config.order
    : [...config.order, fallback];

  for (const label of allSkills) {
    const cat = skillCategory(label, config);
    const item: SkillBankItem = {
      label,
      count: counts[label] || 0,
      color: skillColor(label),
      pressed: active.has(label),
      onClick: () => onToggle(label),
    };
    (catMap[cat] || (catMap[cat] = [])).push(item);
  }

  return order
    .filter((c) => catMap[c] && catMap[c].length)
    .map((c) => ({ name: c, items: catMap[c] }));
}

type SkillBankProps = {
  groups: SkillBankGroup[];
  intro: string;
};

export function SkillBank(props: SkillBankProps) {
  return React.createElement(
    "section",
    { className: "skill-bank" },
    React.createElement("h2", { className: "skill-bank-title" }, "Skills"),
    React.createElement("p", { className: "muted" }, props.intro),
    React.createElement(
      "div",
      { className: "skill-bank-groups" },
      props.groups.map((grp) =>
        React.createElement(
          "div",
          { key: grp.name, className: "skill-bank-group" },
          React.createElement("div", { className: "skill-bank-cat" }, grp.name),
          React.createElement(
            "div",
            { className: "skill-bank-chips" },
            grp.items.map((sk) =>
              React.createElement(
                "button",
                {
                  key: sk.label,
                  type: "button",
                  className: sk.pressed ? "skill-chip pressed" : "skill-chip",
                  "aria-pressed": sk.pressed,
                  onClick: sk.onClick,
                },
                React.createElement("span", {
                  className: "skill-dot",
                  style: { background: sk.color },
                }),
                sk.label,
                React.createElement(
                  "span",
                  { className: "skill-count" },
                  String(sk.count),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

/** Parse `?skill=` (comma-separated) from a search string. */
export function skillsFromSearch(search: string): string[] {
  const q = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const raw = q.get("skill") || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function searchFromSkills(skills: string[]): string {
  if (!skills.length) return "";
  return "?skill=" + skills.map(encodeURIComponent).join(",");
}
