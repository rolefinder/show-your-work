/**
 * CSP-safe rich text: turn {{work:slug|Label}} / {{blog:slug|Label}}
 * (and {{post:…}} as a blog alias) into in-app links. No HTML injection.
 */

const TOKEN_RE = /^\{\{(work|blog|post):([a-z0-9-]+)\|([^}]+)\}\}$/;

export function stripTokens(text: string): string {
  return String(text || "").replace(/\{\{(work|blog|post):[a-z0-9-]+\|([^}]+)\}\}/g, "$2");
}

export function linkTokens(text: string): string[] {
  const out: string[] = [];
  const re = /\{\{(work|blog|post):([a-z0-9-]+)\|[^}]+\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const kind = m[1] === "work" ? "work" : "blog";
    out.push(kind + ":" + m[2]);
  }
  return out;
}

export function richText(
  text: string,
  navigate: (href: string) => void,
): React.ReactNode[] {
  return String(text || "")
    .split(/(\{\{[^}]+\}\})/g)
    .map((part, i) => {
      const m = part.match(TOKEN_RE);
      if (!m) return part;
      const kind = m[1] === "work" ? "work" : "blog";
      const href = "/" + kind + "/" + m[2];
      return React.createElement(
        "a",
        {
          key: i,
          href,
          className: "prose-link",
          onClick: (e: React.MouseEvent) => {
            e.preventDefault();
            navigate(href);
          },
        },
        m[3],
      );
    });
}
