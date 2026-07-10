import * as esbuild from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outdir = join(root, "functions", "_lib");
mkdirSync(outdir, { recursive: true });

await esbuild.build({
  entryPoints: [join(root, "src", "fit", "match.ts")],
  bundle: true,
  format: "esm",
  outfile: join(outdir, "fit-engine.js"),
  platform: "neutral",
  target: ["es2022"],
  logLevel: "info",
});

console.log("built functions/_lib/fit-engine.js");
