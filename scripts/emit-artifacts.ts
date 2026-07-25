#!/usr/bin/env -S npx tsx
/**
 * Runs every tsx-hosted emitter in ONE process.
 *
 * `tsx` costs ~1.6s of startup per invocation. The build used to pay that
 * twice — once for emit-html, once for emit-seo-artifacts — for maybe 0.3s of
 * actual work. Both are still runnable standalone; this is just the entry the
 * build uses.
 *
 * Order matters: emit-html writes dist/index.html, and emit-seo reads the same
 * route table to produce known-paths.json, which the 404 middleware trusts.
 */
import { emitHtml } from "./emit-html";
import { emitSeoArtifacts } from "./emit-seo-artifacts";

emitHtml();
emitSeoArtifacts();
