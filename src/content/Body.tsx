import type { BodyBlock } from "../types";
import { richText } from "../search/richText";

/**
 * Renders a body — the grammar in packages/content/body.py, as elements.
 *
 * Every text-bearing block runs through richText, so a {{work:slug|Label}}
 * cross-link works inside a heading, a bullet or a callout and not only in a
 * paragraph. `code` is the exception and is rendered verbatim: a token there is
 * part of the sample, not a link, and check-content.py agrees with this by
 * excluding code from the text it validates links in.
 *
 * No dangerouslySetInnerHTML anywhere. Blocks are authored data, not markup, so
 * there is nothing to sanitize and nothing for `style-src 'self'` to reject.
 */
export function Body({
  blocks,
  navigate,
}: {
  blocks: BodyBlock[] | undefined;
  navigate: (href: string) => void;
}) {
  const list = blocks || [];
  if (!list.length) return null;

  const children = list.map((block, i) => {
    const key = String(i);

    if (typeof block === "string") {
      return React.createElement("p", { key }, richText(block, navigate));
    }
    if ("h2" in block) {
      return React.createElement("h2", { key }, richText(block.h2, navigate));
    }
    if ("h3" in block) {
      return React.createElement("h3", { key }, richText(block.h3, navigate));
    }
    if ("list" in block) {
      return React.createElement(
        block.ordered ? "ol" : "ul",
        { key },
        block.list.map((item, j) =>
          React.createElement("li", { key: j }, richText(item, navigate)),
        ),
      );
    }
    if ("quote" in block) {
      return React.createElement(
        "blockquote",
        { key },
        React.createElement("p", null, richText(block.quote, navigate)),
        block.cite
          ? React.createElement("cite", null, richText(block.cite, navigate))
          : null,
      );
    }
    if ("code" in block) {
      return React.createElement(
        "pre",
        { key },
        // The language is a label for the reader, not a highlighter hint —
        // there is no highlighter, and adding one would mean shipping a
        // parser to render text that is already text.
        React.createElement(
          "code",
          block.lang ? { "data-lang": block.lang } : null,
          block.code,
        ),
      );
    }
    if ("note" in block) {
      return React.createElement(
        "aside",
        { key, className: "note" },
        richText(block.note, navigate),
      );
    }
    return null;
  });

  return React.createElement("div", { className: "prose" }, children);
}
