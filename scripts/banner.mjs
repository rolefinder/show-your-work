/**
 * The recruit-me wordmark.
 *
 * Drawn from a self-contained 5-row block font rather than a figlet
 * dependency, so it renders identically everywhere and adds nothing to
 * install. Pure ASCII on purpose: the Windows console codec (cp1252) throws
 * UnicodeEncodeError on box-drawing characters, and a build tool that crashes
 * while printing its own logo is a bad first impression.
 *
 *   node scripts/banner.mjs          print it
 *   import { banner } from …         use it
 */

const FONT = {
  R: ["####  ", "#   # ", "####  ", "#  #  ", "#   # "],
  E: ["##### ", "#     ", "####  ", "#     ", "##### "],
  C: [" #### ", "#     ", "#     ", "#     ", " #### "],
  U: ["#   # ", "#   # ", "#   # ", "#   # ", " ###  "],
  I: ["##### ", "  #   ", "  #   ", "  #   ", "##### "],
  T: ["##### ", "  #   ", "  #   ", "  #   ", "  #   "],
  M: ["#   # ", "## ## ", "# # # ", "#   # ", "#   # "],
  "-": ["      ", "      ", " #### ", "      ", "      "],
  " ": ["   ", "   ", "   ", "   ", "   "],
};

/** Render text in the block font. Unknown characters are skipped. */
export function wordmark(text = "RECRUIT-ME") {
  const glyphs = [...text.toUpperCase()].map((c) => FONT[c]).filter(Boolean);
  return [0, 1, 2, 3, 4].map((row) => glyphs.map((g) => g[row]).join("")).join("\n");
}

export const TAGLINE = "paste a JD -> a brief where every claim cites a published page";

export function banner() {
  return `${wordmark()}\n\n  ${TAGLINE}\n`;
}

// Printed only when run directly, so importing it stays silent.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  console.log(banner());
}
