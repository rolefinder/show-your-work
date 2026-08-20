import type { BodyBlock } from "../types";

/**
 * The browser half of the body grammar. packages/content/body.py is the other
 * half, and the two must agree.
 *
 * Named bodyText.ts, not body.ts, because ./Body.tsx sits beside it: on a
 * case-insensitive filesystem — macOS, and the Windows the README's quick start
 * assumes — `../content/body` resolves to the renderer instead, and the build
 * fails with an import error that says nothing about case.
 *
 * Normalization happens at emit time, so by the time a body reaches here it is
 * already a `BodyBlock[]` — this file only has to read one. What it does own is
 * `bodyText`, which decides what the Fit corpus and the search index see.
 *
 * Code blocks are excluded, deliberately. Fit builds a citation by cutting a
 * 160-character window out of this text (`snippetAround` in ./fit/index.ts), so
 * whatever survives here can end up quoted to a recruiter as evidence, and half
 * a line of shell is not a claim about anyone's work. Every other block is
 * prose the author wrote about their own work and is fair to quote.
 */
/**
 * Every block as text, code included — for llms-full.txt, which advertises
 * itself as the page in full.
 *
 * Deliberately a separate function rather than a flag on `bodyText`: that one
 * has a byte-for-byte parity contract with packages/content/body.py, and an
 * option only one side implements is how those two drift. The exclusion there
 * is about what may be *quoted as a claim*; this is about representing the
 * page, where a code sample is legitimate content a reader can see.
 */
export function bodyFullText(
  blocks: BodyBlock[] | undefined,
  stripProseTokens: (s: string) => string = (s) => s,
): string {
  /* Token stripping happens per block, not over the joined result, because
     code is not prose. A shell or GitHub Actions sample legitimately contains
     `${{ … }}`, and a page documenting this project's own cross-link syntax
     legitimately contains `{{work:slug|Label}}` inside a fence. Rewriting
     either would make the "full text" disagree with the page it claims to
     reproduce — and a blanket check for `{{` would fail the build on a
     perfectly valid Actions snippet. */
  const parts: string[] = [];
  const prose = (s: string) => stripProseTokens(s);
  for (const block of blocks || []) {
    if (typeof block === "string") parts.push(prose(block));
    else if ("list" in block) parts.push(...block.list.map((i) => `- ${prose(i)}`));
    else if ("h2" in block) parts.push(prose(block.h2));
    else if ("h3" in block) parts.push(prose(block.h3));
    else if ("quote" in block) parts.push(prose(block.quote), ...(block.cite ? [`— ${prose(block.cite)}`] : []));
    else if ("note" in block) parts.push(prose(block.note));
    else if ("code" in block) parts.push(block.code); // verbatim, always
  }
  return parts.join("\n\n").trim();
}

export function bodyText(blocks: BodyBlock[] | undefined): string {
  const parts: string[] = [];
  for (const block of blocks || []) {
    if (typeof block === "string") {
      parts.push(block);
    } else if ("list" in block) {
      parts.push(...block.list);
    } else if ("h2" in block) {
      parts.push(block.h2);
    } else if ("h3" in block) {
      parts.push(block.h3);
    } else if ("quote" in block) {
      parts.push(block.quote);
      if (block.cite) parts.push(block.cite);
    } else if ("note" in block) {
      parts.push(block.note);
    }
    /* `code` falls through with nothing pushed. */
  }
  return parts
    .map((p) => p.split(/\s+/).filter(Boolean).join(" "))
    .filter(Boolean)
    .join(" ")
    .trim();
}
