#!/usr/bin/env node
/**
 * PreToolUse(Edit|Write) — generated files are written by their generator.
 *
 * Hand-editing one is silent waste: the next `bun run emit` or `bun run
 * build:graph` overwrites it, and the edit is gone with no error anywhere.
 *
 * ONE FACT, ONE READER. The list of generated artifacts already has a home —
 * the table under "Things that are generated" in CONTRIBUTING.md — so this
 * reads that table rather than carrying a second copy that would drift from
 * it. Adding a row there protects the new artifact here, automatically. The
 * remedy shown to the caller is the table's own "From" cell.
 *
 * Rows whose first cell is not exactly one backticked path are skipped on
 * purpose: `public/*` **in `dist/`** describes the COPIES inside dist/ (which
 * `dist/**` already covers), not the templates in public/, which are source
 * and must stay editable.
 *
 * A table that cannot be parsed exits 1 — a non-blocking error, so the edit
 * proceeds and the breakage is visible, rather than this silently guarding
 * nothing.
 */
import { readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

const HEADING = "## Things that are generated";
/** `| `path` | remedy |` — first cell exactly one backticked token. */
const ROW = /^\|\s*`([^`]+)`\s*\|\s*(.+?)\s*\|\s*$/;

export function parseGenerated(markdown) {
  const start = markdown.indexOf(HEADING);
  if (start === -1) return [];
  const section = markdown.slice(start + HEADING.length).split(/^## /m)[0];
  const rows = [];
  for (const line of section.split("\n")) {
    const m = line.match(ROW);
    // No markdown-stripping here: `**` is a glob in these cells, not bold.
    if (m) rows.push({ pattern: m[1], from: m[2] });
  }
  return rows;
}

/** `**` spans separators, `*` does not. Anchored both ends. */
export function globToRegExp(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        out += ".*";
        i++;
        if (glob[i + 1] === "/") i++; // `dist/**` and `dist/**/x` both work
      } else out += "[^/]*";
    } else if (c === "?") out += "[^/]";
    else out += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}

export function findMatch(relPath, rows) {
  return rows.find(
    (r) => globToRegExp(r.pattern).test(relPath) || relPath.startsWith(r.pattern.replace(/\*+$/, "")),
  );
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return;
  }

  const filePath = payload?.tool_input?.file_path;
  if (!filePath) return;

  let rows;
  try {
    rows = parseGenerated(readFileSync(join(root, "CONTRIBUTING.md"), "utf8"));
  } catch (err) {
    console.error(`no-edit-generated: cannot read CONTRIBUTING.md (${err.message}) - guarding nothing`);
    process.exit(1);
  }
  if (!rows.length) {
    console.error(
      `no-edit-generated: found no rows under "${HEADING}" in CONTRIBUTING.md - ` +
        "the table moved or changed shape, so this hook is guarding nothing. Fix the parser.",
    );
    process.exit(1);
  }

  const abs = isAbsolute(filePath) ? filePath : resolve(root, filePath);
  const rel = relative(root, abs).split(sep).join("/");
  if (rel.startsWith("..")) return; // Outside the repo; not ours to judge.

  const hit = findMatch(rel, rows);
  if (!hit) return;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          `${rel} is generated from ${hit.from}. Editing it is silent waste — the next build ` +
          "overwrites it. Edit the source and rebuild. (CONTRIBUTING.md#things-that-are-generated)",
      },
    }),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) main();
