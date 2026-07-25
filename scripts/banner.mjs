/**
 * The recruit-me wordmark.
 *
 * Self-contained fonts rather than a figlet dependency, so it renders
 * identically everywhere and adds nothing to install.
 *
 * DEFAULT: shadowed block forms — a solid face with a bevel down the right and
 * bottom edges. The bevel is authored into each glyph rather than computed
 * from the silhouette: a one-cell offset shadow either fills the counter of an
 * R and the mouth of an E (gaps here are one or two cells wide, so it turns to
 * mud), or, once those are excluded, speckles, because a block font's edges
 * are too short to carry a continuous shadow. Both were tried; drawing it is
 * what actually reads.
 *
 * Node writes UTF-8 to stdout and prints these fine. The cp1252
 * UnicodeEncodeError this repo has hit is a *Python* problem (see
 * check-fictional-corpus.py), not a Node one, and GitHub renders them
 * correctly inside a fence.
 *
 * --ascii: a different typeface entirely — outline forms built from _ | / \ —
 * for a console on a legacy codepage. Not the block font with the blocks
 * swapped for hashes; that read as a grid rather than as letters.
 *
 *   node scripts/banner.mjs             shadowed blocks
 *   node scripts/banner.mjs --ascii     outline typeface
 */

/* 6 rows: five of face, one of bevel. Rows are equal width within a glyph. */
const SHADOW = {
  R: ["██████╗ ", "██╔══██╗", "██████╔╝", "██╔══██╗", "██║  ██║", "╚═╝  ╚═╝"],
  E: ["███████╗", "██╔════╝", "█████╗  ", "██╔══╝  ", "███████╗", "╚══════╝"],
  C: [" ██████╗", "██╔════╝", "██║     ", "██║     ", "╚██████╗", " ╚═════╝"],
  U: ["██╗   ██╗", "██║   ██║", "██║   ██║", "██║   ██║", "╚██████╔╝", " ╚═════╝ "],
  I: ["██╗", "██║", "██║", "██║", "██║", "╚═╝"],
  T: ["████████╗", "╚══██╔══╝", "   ██║   ", "   ██║   ", "   ██║   ", "   ╚═╝   "],
  M: ["███╗   ███╗", "████╗ ████║", "██╔████╔██║", "██║╚██╔╝██║", "██║ ╚═╝ ██║", "╚═╝     ╚═╝"],
  "-": ["      ", "      ", "█████╗", "╚════╝", "      ", "      "],
  " ": ["   ", "   ", "   ", "   ", "   ", "   "],
};

/* 5 rows. Outline shapes, so it reads as a typeface without any block glyphs. */
const OUTLINE = {
  R: [" ____  ", "|  _ \\ ", "| |_) |", "|  _ < ", "|_| \\_\\"],
  E: [" _____ ", "| ____|", "|  _|  ", "| |___ ", "|_____|"],
  C: ["  ____ ", " / ___|", "| |    ", "| |___ ", " \\____|"],
  U: [" _   _ ", "| | | |", "| | | |", "| |_| |", " \\___/ "],
  I: [" ___ ", "|_ _|", " | | ", " | | ", "|___|"],
  T: [" _____ ", "|_   _|", "  | |  ", "  | |  ", "  |_|  "],
  M: [" __  __ ", "|  \\/  |", "| |\\/| |", "| |  | |", "|_|  |_|"],
  "-": ["      ", "      ", " ____ ", "      ", "      "],
  " ": ["   ", "   ", "   ", "   ", "   "],
};

/** Lay glyphs side by side. Unknown characters are skipped. */
function compose(text, font) {
  const glyphs = [...text.toUpperCase()].map((c) => font[c]).filter(Boolean);
  const rows = glyphs.length ? glyphs[0].length : 0;
  return Array.from({ length: rows }, (_, row) =>
    glyphs
      .map((g) => g[row])
      .join("")
      .replace(/\s+$/, ""),
  ).join("\n");
}

export function wordmark(text = "RECRUIT-ME", { ascii = false } = {}) {
  return compose(text, ascii ? OUTLINE : SHADOW);
}

export const TAGLINE = "paste a JD -> a brief where every claim cites a published page";

export function banner(opts = {}) {
  return `${wordmark("RECRUIT-ME", opts)}\n\n  ${TAGLINE}\n`;
}

// Printed only when run directly, so importing it stays silent.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/"))) {
  console.log(banner({ ascii: process.argv.includes("--ascii") }));
}
