/**
 * `npm run ux:check` — automated UI/UX review of the BUILT site.
 *
 * Every assertion here is a check that was previously done by hand, once, and
 * would silently rot: contrast measured in both schemes, no horizontal
 * overflow on a phone, real touch targets, a visible keyboard focus ring, one
 * h1 per route, images that announce themselves. Design regressions are
 * invisible in a diff — a token nudged 0.04 alpha reads fine in review and
 * fails AA — so they need a machine.
 *
 * Runs against dist/ through the real preview server, in both light and dark,
 * at 375px and 1280px.
 *
 * Exit 0 = pass · 1 = UX failures · 2 = can't run (no Playwright / no dist).
 * Skipped gracefully when Playwright is absent, like prerender; CI installs
 * Chromium and so runs it for real.
 *
 * Usage: node scripts/check-ux.mjs [--help] [--verbose]
 */
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.UX_PORT || 4181);
const verbose = process.argv.includes("--verbose");

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*?/, ""));
  process.exit(0);
}

if (!existsSync(join(root, "dist", "index.html"))) {
  console.error("check-ux: dist/ not built - run `npm run build` first");
  process.exit(2);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.warn("check-ux: playwright not installed - skipping. Run: npx playwright install chromium");
  process.exit(0);
}

const paths = JSON.parse(readFileSync(join(root, "dist", "known-paths.json"), "utf8"));

/* ---------------------------------------------------------------- in-page --
   Runs inside the browser. Returns findings rather than throwing so one bad
   route doesn't hide the rest. */
const AUDIT = () => {
  const out = [];
  const add = (rule, detail) => out.push({ rule, detail });

  const chan = (c) => c.match(/[\d.]+/g).map(Number);
  const lum = (rgb) => {
    const f = (v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : Math.pow((v / 255 + 0.055) / 1.055, 2.4));
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  };
  /* Text colour is frequently SEMI-TRANSPARENT here - the whole palette is
     built from alpha ramps over ink. Measuring the raw rgb triple ignores the
     alpha and reports the contrast of fully-opaque ink, which is how a
     --fg-muted dropped to 0.40 alpha sailed through an earlier version of this
     check. Composite the foreground over its background first. */
  const composite = (fg, bg) => {
    const f = chan(fg), b = chan(bg);
    const a = f.length > 3 ? f[3] : 1;
    return [0, 1, 2].map((i) => f[i] * a + b[i] * (1 - a));
  };
  const alpha = (c) => {
    const p = c.match(/[\d.]+/g).map(Number);
    return p.length > 3 ? p[3] : 1;
  };
  /** Walk up for the first opaque background, the way a human eye would. */
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && alpha(c) > 0.95) return c;
      n = n.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor;
  };
  const ratio = (fg, bg) => {
    const a = lum(composite(fg, bg)), b = lum(chan(bg));
    const [hi, lo] = a > b ? [a, b] : [b, a];
    return (hi + 0.05) / (lo + 0.05);
  };

  // --- structure
  if (!document.documentElement.lang) add("lang", "<html> has no lang attribute");
  const h1s = document.querySelectorAll("main h1");
  if (h1s.length !== 1) add("h1", `expected exactly 1 <h1> in main, found ${h1s.length}`);
  if (!document.title.trim()) add("title", "empty <title>");

  // --- horizontal overflow
  const over = document.documentElement.scrollWidth - window.innerWidth;
  if (over > 1) add("overflow", `page scrolls ${over}px horizontally at ${window.innerWidth}px`);

  // --- contrast on real rendered text
  const seen = new Set();
  for (const el of document.querySelectorAll("main *, header *, footer *")) {
    if (!el.childNodes.length) continue;
    const text = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).length;
    if (!text) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) < 0.1) continue;
    /* aria-hidden content is not exposed to assistive tech and is decorative
       by declaration - the footer's separator dots use --fg-faint, which
       colors.css documents as "decorative only, fails AA for text". Holding
       purely ornamental glyphs to a text contrast ratio would either produce
       permanent noise or push the palette to make dividers as loud as
       content. */
    if (el.closest('[aria-hidden="true"]')) continue;
    const size = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight) || 400;
    // WCAG "large text": >=24px, or >=18.66px bold.
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3.0 : 4.5;
    const key = `${cs.color}|${bgOf(el)}|${need}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const r = ratio(cs.color, bgOf(el));
    if (r < need) {
      add("contrast", `${r.toFixed(2)}:1 (needs ${need}) at ${size}px - "${(el.textContent || "").trim().slice(0, 40)}"`);
    }
  }

  /* --- touch targets, on TOUCH viewports only ---
     WCAG 2.5.8 (AA) wants 24x24 CSS px OR adequate spacing: "if a 24px
     diameter circle is centered on the bounding box of each undersized
     target, the circles do not intersect another target."

     Implementing the real spacing rule rather than guessing from computed
     `display`. An earlier version exempted `display: inline` links, which
     looked right and was wrong: flex CHILDREN are blockified, so every footer
     nav link reported `block` and got flagged. Computed display doesn't carry
     author intent; distance between targets does. */
  if (window.innerWidth <= 480) {
    const targets = [...document.querySelectorAll("a[href], button, input, [role=button]")]
      .filter((el) => {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") return false;
        if (cs.clipPath && cs.clipPath !== "none") return false; // skip-link
        const r = el.getBoundingClientRect();
        return r.width > 1 && r.height > 1;
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { el, r, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
      });

    /* 2.5.8 has TWO exceptions and both apply here. Spacing is handled below;
       "Inline" covers a target sitting in a sentence, whose size is
       constrained by the line-height of the surrounding text. A wrapped prose
       cross-link reports a union box spanning two lines, which lands its
       centre near the next link's - a false positive that describes prose,
       not a control. */
    const inSentence = (el) => {
      const p = el.closest("p, li");
      if (!p) return false;
      return [...p.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    };

    for (const t of targets) {
      if (t.r.height >= 24 && t.r.width >= 24) continue;
      if (inSentence(t.el)) continue;
      const crowded = targets.some(
        (o) => o !== t && Math.hypot(o.cx - t.cx, o.cy - t.cy) < 24,
      );
      if (crowded) {
        add(
          "touch-target",
          `${t.el.tagName.toLowerCase()} is ${Math.round(t.r.width)}x${Math.round(t.r.height)}px and within 24px of another target - "${(t.el.textContent || "").trim().slice(0, 30)}"`,
        );
      }
    }
  }

  // --- images announce themselves
  for (const img of document.querySelectorAll("img")) {
    if (!img.hasAttribute("alt") && img.getAttribute("aria-hidden") !== "true") {
      add("img-alt", `<img src="${img.getAttribute("src")}"> has no alt`);
    }
  }

  return out;
};

/* --------------------------------------------------------------- keyboard --
   A focus ring that only exists in CSS nobody applies is worse than none. */
const FOCUS_PROBE = () => {
  /* :focus-visible is a pseudo-CLASS. getComputedStyle's second argument takes
     a pseudo-ELEMENT, so asking it for ":focus-visible" returns the unfocused
     style and always looks like "no ring". The only honest way to test this is
     to actually move focus the way a keyboard user does (the caller presses
     Tab) and read the element that really has it. */
  const el = document.activeElement;
  if (!el || el === document.body) return { ok: false, detail: "Tab did not move focus to anything" };
  const cs = getComputedStyle(el);
  const outline = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0;
  const shadow = cs.boxShadow && cs.boxShadow !== "none";
  return {
    ok: Boolean(outline || shadow),
    detail: `focused <${el.tagName.toLowerCase()}> outline=${cs.outlineStyle} ${cs.outlineWidth}`,
  };
};

/* ------------------------------------------------------------------- main --*/
const server = spawn(process.execPath, [join(root, "scripts", "preview.mjs"), "--port", String(PORT)], {
  cwd: root,
  stdio: ["ignore", "pipe", "ignore"],
});
/* Handle this rejection explicitly. Left bare it escapes as an unhandled
   rejection - the process dies with the wrong exit code AND leaves the spawned
   preview server running, which then blocks the port on the next run. */
try {
  await new Promise((ready, fail) => {
    const t = setTimeout(() => fail(new Error("preview did not start within 10s")), 10000);
    server.stdout.on("data", (d) => {
      if (String(d).includes("serving")) { clearTimeout(t); ready(); }
    });
    server.on("exit", (c) => fail(new Error(`preview exited early (code ${c})`)));
  });
} catch (err) {
  console.error("check-ux: could not start the preview server -", err.message);
  server.kill();
  process.exit(2);
}

const findings = [];
let checked = 0;
let browser;
try {
  browser = await chromium.launch();
  for (const scheme of ["light", "dark"]) {
    for (const width of [375, 1280]) {
      const ctx = await browser.newContext({
        colorScheme: scheme,
        viewport: { width, height: 900 },
        reducedMotion: "reduce",
        /* This checker is instrumentation, not a visitor: it injects a
           transition-killing stylesheet so it can measure settled colors. On
           the github-pages target the CSP now ships as a <meta> tag inside the
           document, which the local preview honours, and `style-src 'self'`
           correctly blocks that injection. Bypass it for the probe only.
           Whether the CSP breaks the real page is a different question, and
           `csp:smoke` is what answers it. */
        bypassCSP: true,
      });
      const page = await ctx.newPage();
      for (const path of paths) {
        await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: "networkidle" });
        // The light<->dark body transition reports mid-flight computed colors
        // in a non-compositing context; kill transitions before measuring.
        await page.addStyleTag({ content: "*,*::before,*::after{transition:none !important;animation:none !important}" });
        const found = await page.evaluate(AUDIT);
        checked++;
        for (const f of found) findings.push({ ...f, path, scheme, width });
        if (verbose) console.log(`  ${scheme} ${width}px ${path} - ${found.length} finding(s)`);
      }
      /* Once per scheme AND width, not just light/1280: the focus ring is
         drawn with --focus-ring, which is re-declared in the dark block, so a
         dark-only regression would otherwise ship. */
      await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle" });
      await page.keyboard.press("Tab"); // real keyboard focus, so :focus-visible applies
      const focus = await page.evaluate(FOCUS_PROBE);
      if (!focus.ok) {
        findings.push({ rule: "focus-ring", detail: `keyboard focus has no visible ring - ${focus.detail}`, path: "/", scheme, width });
      }
      await ctx.close();
    }
  }
} catch (err) {
  console.error("check-ux: failed to run -", err.message);
  server.kill();
  process.exit(2);
} finally {
  if (browser) await browser.close();
  server.kill();
}

const byRule = new Map();
for (const f of findings) byRule.set(f.rule, [...(byRule.get(f.rule) || []), f]);

if (findings.length) {
  console.error(`check-ux: FAILED - ${findings.length} finding(s) across ${checked} page renders`);
  for (const [rule, items] of byRule) {
    console.error(`\n  [${rule}] ${items.length}`);
    for (const i of items.slice(0, 6)) {
      console.error(`    ${i.scheme} ${i.width}px ${i.path}\n      ${i.detail}`);
    }
    if (items.length > 6) console.error(`    ... and ${items.length - 6} more`);
  }
  process.exit(1);
}

console.log(`check-ux: ok (${checked} page renders: ${paths.length} routes x light/dark x 375/1280px)`);
