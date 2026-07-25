/**
 * The Node half of the content resolver. Mirrors packages/content/paths.py —
 * see that file for why the rules are what they are.
 *
 * Kept as a second small implementation rather than shelling out to Python,
 * because the Node-side callers (check-ready, skills, init) must work before
 * and independently of the emitter. The rules are three lines each; the
 * comment explaining them lives in one place.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// RM_ROOT exists so scripts/check-parity.mjs can point both resolvers at a
// fixture tree and assert they agree. Nothing in the build sets it.
export const ROOT = process.env.RM_ROOT || join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CONTENT = join(ROOT, "content");
export const DEMO = join(CONTENT, "demo");

/** The adopter's copy of a config file if present, else the demo's. */
export function resolve(...parts) {
  const own = join(CONTENT, ...parts);
  return existsSync(own) && statSync(own).isFile() ? own : join(DEMO, ...parts);
}

/** True when the adopter supplied this file themselves. */
export function isOwn(...parts) {
  const own = join(CONTENT, ...parts);
  return existsSync(own) && statSync(own).isFile();
}

const yamlIn = (dir) =>
  existsSync(dir) && statSync(dir).isDirectory()
    ? readdirSync(dir).filter((f) => f.endsWith(".yaml"))
    : [];

/** `content/<kind>/` once it holds any YAML, otherwise `content/demo/<kind>/`. */
export function corpusDir(kind) {
  const own = join(CONTENT, kind);
  return yamlIn(own).length ? own : join(DEMO, kind);
}

export function corpusFiles(kind) {
  return yamlIn(corpusDir(kind));
}

/**
 * Still the template rather than somebody's site? Keyed on the profile alone:
 * it carries the name, tagline and email on every page and in every JSON-LD
 * Person block. Derived, so there is no flag to forget to flip.
 */
export function isDemo() {
  return !isOwn("about", "profile.yaml");
}

/** Repo-relative, forward-slashed — for messages that name a file. */
export function rel(abs) {
  return abs.slice(ROOT.length + 1).split("\\").join("/");
}
