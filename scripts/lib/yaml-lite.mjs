/**
 * The one minimal YAML reader for Node-side gates.
 *
 * The gates read a handful of scalars out of site.yaml and profile.yaml before
 * the emitter has run, so they cannot use the generated module and pulling a
 * YAML dependency in for six keys is not worth it. What is NOT acceptable is
 * each gate writing its own regex, which is what happened:
 *
 *   check-ready.mjs    `m[1].trim().replace(/^["']|["']$/g, "")`
 *   check-pages-target `s.trim().replace(/\s+#.*$/, "").trim().replace(...)`
 *
 * One stripped inline comments and one did not, so the same line read two ways:
 *
 *   origin: "https://octocat.dev"  # my domain
 *     -> check-ready:   https://octocat.dev"  # my domain
 *     -> pages-target:  https://octocat.dev
 *
 * Both gates check `origin`. They were checking different strings — and since
 * check-ready tests `origin.includes("example.com")`, a comment mentioning
 * example.com would have blocked a perfectly good config.
 *
 * That is the fourth time in this repo that one fact acquired two readers and
 * they drifted (the deploy workflow's demo grep vs this file's scalar; a
 * `\bfake\b` test vs corpus:check's substring; the browser and Worker evidence
 * packs). The rule now: one reader, or a parity test. See CONTRIBUTING.
 *
 * Deliberately NOT a YAML parser. It reads top-level scalars and one level of
 * nesting, which is all any gate needs. Anything more structured belongs in
 * Python, where PyYAML already is.
 */

/**
 * A YAML scalar, minus quotes and minus a trailing comment.
 *
 * The two cases have to be distinguished rather than handled with one regex:
 * inside quotes `#` is a literal character, so stripping comments first would
 * turn `title_suffix: "Foo # Bar"` into `Foo`. Outside quotes, `#` only starts
 * a comment when whitespace precedes it, so a URL fragment survives.
 *
 * Escaped quotes inside a double-quoted scalar are not handled; no value this
 * reads (origins, names, hostnames, enum keys) can contain one.
 */
export function unquote(raw) {
  const s = String(raw ?? "").trim();
  const q = s[0];
  if (q === '"' || q === "'") {
    const end = s.indexOf(q, 1);
    if (end > 0) return s.slice(1, end);
  }
  return s.replace(/\s+#.*$/, "").trim();
}

/** A top-level `key: value`. Empty string when absent. */
export function scalar(text, key) {
  const m = String(text).match(new RegExp(`^${key}:[ \\t]*(.*)$`, "m"));
  return m ? unquote(m[1]) : "";
}

/**
 * A `key: value` nested one level under `parent:`.
 *
 * The block is "every following line that is indented or blank", consumed
 * explicitly. An earlier version matched lazily up to `(?=^\S|$)` — but under
 * the `m` flag `$` matches at the end of every line, so the lookahead succeeded
 * immediately, the block was always empty, and every nested key silently read
 * as "". It looked correct.
 */
export function nested(text, parent, key) {
  const block = String(text).match(
    new RegExp(`^${parent}:[ \\t]*\\r?\\n((?:[ \\t]+.*\\r?\\n|[ \\t]*\\r?\\n)*)`, "m"),
  );
  if (!block) return "";
  const m = block[1].match(new RegExp(`^[ \\t]+${key}:[ \\t]*(.*)$`, "m"));
  return m ? unquote(m[1]) : "";
}

/** YAML says yes in more ways than one. */
export function truthy(value) {
  return /^(true|yes|on)$/i.test(String(value).trim());
}
