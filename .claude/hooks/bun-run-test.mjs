#!/usr/bin/env node
/**
 * PreToolUse(Bash) — `bun test` is not `bun run test`.
 *
 * Bare `bun test` invokes bun's own test runner, which matches no `*.test.ts`
 * in this repo, prints `0 test files matching`, and EXITS 0. Every gate here
 * is a package.json script, so the runner never sees one. The failure mode is
 * a green that ran nothing, which is the worst kind (ADR 023, AGENTS.md).
 *
 * AGENTS.md says this. This makes saying it unnecessary.
 *
 * Exit 0 always: the decision travels as JSON on stdout, so a bug in here
 * degrades to "allowed" rather than to "no Bash tool".
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Command separators. Splitting inside a quoted string only ever produces
    MORE segments, and a segment must *start* with the invocation to match, so
    over-splitting costs nothing except in the pathological case of a quoted
    string that contains both a separator and a literal `bun test`. */
const SEPARATORS = /\||;|&&|\|\||\n/;

/** `FOO=bar BAZ=qux cmd` — env assignments are not the command. */
const LEADING_ENV = /^(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S*)\s+)*/;

export function isBareBunTest(command) {
  return String(command || "")
    .split(SEPARATORS)
    .some((segment) => {
      const bare = segment.trim().replace(LEADING_ENV, "");
      // `bun run test` does not match: the token after `bun` is `run`.
      // The optional path prefix catches `/usr/local/bin/bun test` and
      // `./node_modules/.bin/bun test`, which are the same mistake.
      return /^(?:\S*\/)?bun\s+test(?:\s|$)/.test(bare);
    });
}

function main() {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return; // Unparseable stdin is not the user's problem. Allow.
  }

  if (!isBareBunTest(payload?.tool_input?.command)) return;

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          "`bun test` runs bun's test runner, which matches no files here and exits 0 " +
          "without running a single gate. Use `bun run test` (or `bun run <gate>` for one).",
      },
    }),
  );
}

/* pathToFileURL, not string concatenation: Node percent-encodes
   import.meta.url (a space becomes %20) and Windows file URLs take a
   different shape, so the naive comparison silently disagrees and main()
   never runs — a guard that FAILS OPEN. Found by Bugbot on PR #50. */
// argv[1] is undefined when this module is imported rather than run
// (a test harness, `node -e`), and pathToFileURL throws on undefined.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) main();
