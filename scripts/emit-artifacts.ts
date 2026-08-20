#!/usr/bin/env bun
/**
 * Runs both TypeScript emitters in ONE process.
 *
 * This began as a startup optimisation: under `tsx` each invocation cost ~1.6s,
 * and the build paid it twice for maybe 0.3s of actual work. Under bun that
 * argument is gone — two processes cost ~36ms more than one.
 *
 * What keeps this entry point is ORDER: emit-html writes dist/index.html, and
 * emit-seo reads the same route table to produce known-paths.json, which the
 * 404 middleware trusts. Both are still runnable standalone.
 */
import { emitHtml } from "./emit-html";
import { emitSeoArtifacts } from "./emit-seo-artifacts";

emitHtml();
emitSeoArtifacts();
