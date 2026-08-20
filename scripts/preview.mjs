import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..", "dist");
const args = process.argv.slice(2);
const portFlag = args.indexOf("--port");
const port = Number(portFlag >= 0 ? args[portFlag + 1] : process.env.PORT || 4173);
/*
 * --spa forces every non-asset path to the index.html shell, ignoring any
 * prerendered <route>.html already in dist/. scripts/prerender-routes.ts runs
 * the server this way so it snapshots freshly client-rendered pages instead of
 * re-snapshotting its own previous output on a rebuild.
 */
const spaOnly = args.includes("--spa");

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

const isFile = (p) => existsSync(p) && statSync(p).isFile();

/** Mirrors how Cloudflare Pages resolves a request against dist/. */
function resolveFile(pathname) {
  const rel = decodeURIComponent(pathname);
  const hasExt = /\.[a-z0-9]+$/i.test(rel);

  // Real assets always win, in both modes.
  if (isFile(join(root, rel))) return join(root, rel);

  if (!spaOnly && !hasExt) {
    // Pages serves dist/work/foo.html extensionlessly at /work/foo.
    const asHtml = join(root, rel.replace(/\/$/, "")) + ".html";
    if (isFile(asHtml)) return asHtml;
    const asIndex = join(root, rel, "index.html");
    if (isFile(asIndex)) return asIndex;
  }

  return join(root, "index.html");
}

/**
 * Serving dist/ says nothing about whether dist/ matches content/. Editing a
 * YAML file and forgetting to rebuild shows stale content with no signal at
 * all, which is a genuinely confusing five minutes. Compare mtimes once at
 * startup and say so. `bun run dev` makes this moot by rebuilding for you.
 */
function warnIfStale() {
  const built = join(root, "index.html");
  if (!isFile(built)) {
    console.warn("preview: dist/ has no index.html — run `bun run build` first");
    return;
  }
  const builtAt = statSync(built).mtimeMs;
  let newest = 0;
  let newestFile = "";
  const scan = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, entry.name);
      if (entry.isDirectory()) scan(abs);
      else {
        const m = statSync(abs).mtimeMs;
        if (m > newest) [newest, newestFile] = [m, abs];
      }
    }
  };
  scan(join(root, "..", "content"));
  if (newest > builtAt) {
    const rel = newestFile.split(/[\\/]/).slice(-3).join("/");
    console.warn(
      `preview: STALE — ${rel} is newer than dist/index.html.\n` +
        "         You are looking at an older build. Run `bun run build`, or `bun run dev` to rebuild on save.",
    );
  }
}
warnIfStale();

createServer((req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  const file = resolveFile(url.pathname);
  try {
    const body = readFileSync(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(port, () => {
  console.log(`preview serving http://localhost:${port} (${root}${spaOnly ? ", spa-only" : ""})`);
});
