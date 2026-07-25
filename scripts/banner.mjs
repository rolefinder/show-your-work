/**
 * The recruit-me wordmark.
 *
 * Drawn from a self-contained block font rather than a figlet dependency, so
 * it renders identically everywhere and adds nothing to install.
 *
 * Two fonts. The default uses U+2588 FULL BLOCK with two-cell strokes, which
 * is what makes it legible at a glance instead of a grid of hashes. Node
 * writes UTF-8 to stdout and prints these fine — the cp1252 UnicodeEncodeError
 * this repo has hit before is a *Python* problem (see check-fictional-corpus),
 * not a Node one, and GitHub renders the blocks perfectly inside a fence.
 *
 * `--ascii` swaps in a hash font for a console with a legacy codepage that
 * would mangle the blocks. Deliberately a flag, not auto-detection: guessing
 * wrong would silently downgrade the good path for everyone.
 *
 *   node scripts/banner.mjs            solid blocks
 *   node scripts/banner.mjs --ascii    hash fallback
 */

/* Two-cell strokes; each glyph's rows are equal width, widths vary per glyph. */
const BLOCK = {
  R: ["██████ ", "██  ██ ", "██████ ", "██ ██  ", "██  ██ "],
  E: ["██████ ", "██     ", "█████  ", "██     ", "██████ "],
  C: [" █████ ", "██     ", "██     ", "██     ", " █████ "],
  U: ["██  ██ ", "██  ██ ", "██  ██ ", "██  ██ ", " ████  "],
  I: ["██████ ", "  ██   ", "  ██   ", "  ██   ", "██████ "],
  T: ["██████ ", "  ██   ", "  ██   ", "  ██   ", "  ██   "],
  M: ["██    ██ ", "███  ███ ", "██ ██ ██ ", "██    ██ ", "██    ██ "],
  "-": ["      ", "      ", " ████ ", "      ", "      "],
  " ": ["    ", "    ", "    ", "    ", "    "],
};

const ASCII = {
  R: ["#####  ", "##  ## ", "#####  ", "## ##  ", "##  ## "],
  E: ["###### ", "##     ", "#####  ", "##     ", "###### "],
  C: [" ##### ", "##     ", "##     ", "##     ", " ##### "],
  U: ["##  ## ", "##  ## ", "##  ## ", "##  ## ", " ####  "],
  I: ["###### ", "  ##   ", "  ##   ", "  ##   ", "###### "],
  T: ["###### ", "  ##   ", "  ##   ", "  ##   ", "  ##   "],
  M: ["##    ## ", "###  ### ", "## ## ## ", "##    ## ", "##    ## "],
  "-": ["      ", "      ", " #### ", "      ", "      "],
  " ": ["    ", "    ", "    ", "    ", "    "],
};

const ROWS = 5;

/** Render text in the block font. Unknown characters are skipped. */
export function wordmark(text = "RECRUIT-ME", { ascii = false } = {}) {
  const font = ascii ? ASCII : BLOCK;
  const glyphs = [...text.toUpperCase()].map((c) => font[c]).filter(Boolean);
  return Array.from({ length: ROWS }, (_, row) =>
    glyphs.map((g) => g[row]).join("").replace(/\s+$/, ""),
  ).join("\n");
}

export const TAGLINE = "paste a JD -> a brief where every claim cites a published page";

export function banner(opts = {}) {
  return `${wordmark("RECRUIT-ME", opts)}\n\n  ${TAGLINE}\n`;
}

// Printed only when run directly, so importing it stays silent.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  console.log(banner({ ascii: process.argv.includes("--ascii") }));
}
