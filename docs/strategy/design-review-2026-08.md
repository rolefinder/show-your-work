# Design review — expression gaps against the dogfood site

**Date:** 2026-08-15 · against `main` @ `7ebff09`

Every finding below was reproduced against the real codebase, with the
measurement or repro recorded. Nothing here is inferred from reading alone.
The comparison point is `harrison-site`, the private dogfood site this template
was extracted from.

Scope is the visual and editorial layer only — build, CSP, deploy and CI are
out of scope except where a gate is the fix.

---

## The shape of the problem

This repo's design **governance** is ahead of the site it came from. It has a
five-layer token manifest, a token-discipline gate (`check-style-tokens.mjs`),
and a measured-contrast/a11y gate (`check-ux.mjs`) that composites alpha over
the real background. `harrison-site` has none of that — its only rendered-output
gate is `check-responsive.mjs`, which tests horizontal overflow and nothing else.

The gap is **expression**: the vocabulary to say anything visually beyond a
column of text in cards. A template whose target user is an engineer publishing
their work cannot currently express a heading inside that work.

Two ADR 015 decisions are deliberate and are **not** treated as gaps here:
system fonts (no shipped webfont) and dark mode via `prefers-color-scheme` only.

**Status.** D1 and D3 were fixed in the change that added this document —
`--brand-deep` now has consumers, the four dead semantic tokens are gone, and
`check-style-tokens.mjs` grew the reverse pass that makes both regressions
impossible to reintroduce.

**D4 is fixed** in ADR 029: a body is now a list of blocks (headings, lists,
quotes, code, callouts), a plain string still means one paragraph, and code
blocks are deliberately excluded from the Fit corpus so a citation can never be
a fragment of shell. `image` and `figure` are designed for and wait on D6 and D5.

**D2 and D7 are fixed.** The social card now renders against the real
`dist/tokens/*.css` with `adopter.css` last, so it inherits the adopter's
palette instead of scraping a shipped default; its CSS moved to
`scripts/lib/og-card.css` and joined the token gate, and `seo:smoke` now asserts
every emitted `og:image` resolves to a file. The home page leads with Fit and a
line saying what it does, shows selected work, and gives its `h1` the display
step — which is what finally consumes `--text-display`.

Step 0 and step 1 are therefore complete. Steps 2–5 below are open; the figure
kit's scope is settled (measurement-free flow + stack, not a port — see D5).

---

## Part 1 — Already broken or inert

### D1. `--rm-brand-deep` is a no-op — FIXED

**Severity: high** (documented contract, silently does nothing)

One of the four advertised adopter variables is referenced by zero rules.

| Where it appears | Line |
|---|---|
| Declared, light | `tokens/colors.css:17` |
| Aliased to `--brand-deep` | `tokens/colors.css:40` |
| Redeclared, dark | `tokens/colors.css:126` |
| Plumbed from adopter config | `scripts/emit-html.ts:109` |
| Mapped in the emitter | `packages/content/emit_site.py:81` |
| Typed | `src/types.ts:35` |
| Documented as an adopter knob | `docs/guide/theming.md:10`, `README.md:155` |
| **Read by a `var()` in a rule** | **nowhere** |

```
$ grep -rn "var(--brand-deep)" styles.css tokens/ | wc -l
0
```

This is the exact bug ADR 015 was written to eliminate — its Context section
records that `--rm-brand` "was referenced nowhere, so changing it changed
nothing." It recurred because `check-style-tokens.mjs` only validates
`var(--x)` → a defined token. It has no reverse pass, so a token that nothing
reads is invisible to it.

**Recommendation.** Consume it in the pressed/heavier states it was specified
for, and add the reverse pass (D3) so this class of regression cannot return.

---

### D2. The social card ignores the adopter's accent, and is exempt from the token gate — FIXED

**Severity: high** (the most-viewed rendering of the site, and it is off-brand)

Social cards *are* generated — `scripts/prerender-routes.ts:182–192` screenshots
`cardHtml(route)` at 1200×630 into `dist/assets/og/<key>.png`, and
`PRERENDER_REQUIRED=1` refuses to publish a dist without them. The problem is
what gets rendered.

**(a) The accent is scraped from the shipped defaults, not from the adopter.**

```
scripts/prerender-routes.ts:35–39
function brandAccent(): string {
  const css = readFileSync(join(root, "tokens", "colors.css"), "utf8");
  const m = css.match(/--rm-brand:\s*(#[0-9a-f]{3,8})/i);
  return m ? m[1] : SITE_CONFIG.themeColorDark;
}
```

It regex-matches `tokens/colors.css` — the file `docs/guide/theming.md` tells
adopters **"You do not edit that file."** Adopter overrides land in
`dist/tokens/adopter.css`, which this never reads.

Reproduced by setting `theme.accent: "#7a3ea1"` in the demo `site.yaml` and
rebuilding:

```
$ cat dist/tokens/adopter.css        # the theme took effect
:root {
  --rm-brand: #7a3ea1;
}

$ md5sum dist/assets/og/home.png     # before and after the theme change
1cbde890111007ef80b6407ec110d52f  dist/assets/og/home.png
1cbde890111007ef80b6407ec110d52f  dist/assets/og/home.png
```

The card is **byte-identical**. The site turns purple; every social card keeps
the template's shipped teal. The one surface a recruiter sees before they see
the site is the one surface still wearing someone else's colors. The fallback
is worse: `themeColorDark` is a browser-chrome color, not an accent.

**(b) The card is a second, ungoverned design system.** `cardHtml`
(`prerender-routes.ts:65–87`) hardcodes its own font stack (`system-ui …`,
ignoring `--font-sans`), its own ink (`#f4f1ea` plus an
`rgba(244,241,234,…)` ramp), its own weights and sizes — and its own eyebrow
tracking at `0.14em`, against the token's `0.12em`, which
`tokens/typography.css:51` calls "THE eyebrow signature". It has already
drifted.

**(c) Nothing gates it.** `check-style-tokens.mjs` sets
`COMPONENT_LAYER = ["styles.css"]`. A raw hex in the component layer fails the
build; a raw hex in the social card is unchecked. `seo-smoke.mjs` asserts no
`og:image` property at all.

**Recommendation.** Read the accent from the resolved adopter theme
(`SITE_CONFIG.theme.accent`, falling back to the token) rather than scraping the
shipped file, and drive the card's type and ink from the same tokens the site
uses. Add the card to the token gate's scanned set, and assert in `seo:smoke`
that every emitted `og:image` resolves to a file on disk.

> Corrected during review: an earlier draft claimed no generator existed. It
> does; the initial search excluded the word `screenshot` and hid it.

---

### D3. Dead tokens, and one dead rule — FIXED

**Severity: medium** (one of them is why the site reads flat)

Zero `var()` references anywhere in the repo:

```
--bp-sm  --bp-md  --bp-lg  --container-wide  --container-narrow
--dur-med  --surface-sunk  --z-base  --z-overlay  --tracking-normal
--line-snug  --text-display
```

`.card` in `tokens/base.css` was dead CSS — commented "the dominant container"
while nothing applied it, and while `.card-link`, `.project-brief` and
`.fit-req` each redeclared the same five properties beside it:

```
$ grep -rc 'className: "card"' src/
0
```

It is removed; the duplication among those three is left as its own cleanup,
since a class-level dead-code gate needs to know which classes the JSX emits
and is a larger piece of work than this one.

**Not all twelve are the same kind of thing**, and the fix turns on the
difference. A **ramp** — a type, spacing or z scale — is published complete, and
legitimately carries a step ahead of its first use; deleting the unused step is
what makes a scale incoherent. A **semantic alias** is a promise that something
consumes it, and an unconsumed one is D1 wearing a different name.

So the reverse pass exempts ramp prefixes and holds everything else to account.
Applied, it reported four semantic tokens — including `--fg-on-brand`, which
this hand scan had missed:

```
tokens/: --container-narrow is defined but no var() reads it
tokens/: --container-wide   is defined but no var() reads it
tokens/: --fg-on-brand      is defined but no var() reads it
tokens/: --surface-sunk     is defined but no var() reads it
```

All four are removed. `--container-narrow` was a second, fixed-pixel spelling of
`--measure-reading`; `--fg-on-brand` promised ink for text on a solid accent
fill that no component sets; `--surface-sunk` aliased the page background and
nothing sank. `--container-wide` returns in step 4, with the wide layout that
consumes it — a token should not precede its consumer, which is the rule the
gate now enforces.

The ramp steps stay, `--text-display` among them. It is still unused, and that
still matters: it is the top of the fluid type scale (36→56px), so the largest
type on any page is a 28→40px `h1`. The scale has a display register and the
site never enters it — the mechanical reason the home page reads flat. D7 is
where it gets a consumer.

Writing this section also surfaced a latent bug in the gate itself: token
*definitions* were collected without stripping comments, so naming a token in
prose (`/* no --container-narrow: use --measure-reading */`) registered a
phantom definition that the reverse pass then reported as dead. Definitions are
now stripped the same way the literal scan already was.

---

## Part 2 — The expression ceiling

### D4. A body is one string, rendered as one `<p>` — FIXED

**Severity: high** (this is the product ceiling)

```
src/types.ts             body: string
emit_site.py:168,195     body: <one squashed string>
src/app.tsx:509,545      React.createElement("p", {className:"prose"}, richText(body, …))
```

`richText` (`src/search/richText.tsx`, 48 lines) converts
`{{work:slug|Label}}` cross-links and nothing else.

There is therefore **no way to author a heading, a list, a pull quote, a code
block, a callout, an image, or a diagram** in any project page or blog post.
Every `/work/<slug>` and `/blog/<slug>` is: an `h1`, a lede, one undivided
paragraph, the brief grid, tags.

`harrison-site` hit this exact wall and solved it in its ADR 008: `body[]`
entries may be a plain string, `{h2: …}`, or `{figure: …}`. This template has
no equivalent, which means the artifact its target user most wants to publish —
a long-form engineering write-up — is the one thing it cannot express.

**Recommendation.** Adopt that shape, widened: `{h2}`, `{list}`, `{quote}`,
`{code}`, `{note}`, `{image}`, `{figure}`. Keep a plain string working so no
adopter content breaks. Handle the Fit consequence deliberately —
`buildEvidencePack` (`src/fit/evidence.ts`) reads `body` as text, so structured
entries must flatten to text for the corpus, and `{code}` must be excluded from
quotable claims: a citation has to stay a readable sentence.

---

### D5. No figure or diagram kit

**Severity: high**

`harrison-site` ships `FlowFigure`, `HubFigure`, `StackFigure`, `RailSvg`,
`StationMark`, `StationText` and `ArchitectureSection`
(`design-system/src/architecture-kit.tsx`) over 612 lines of
`tokens/diagrams.css`. This repo has none of it.

This is already a known debt, not a new discovery:
`docs/history/SITE_OSS_GAP_LIST.md` lists "Architecture-kit figures" under
**"Absorb next (OSS product)"**, with the note "Single **core** package (do not
ship a hand-fork design-system)". It never landed.

An engineering portfolio with no way to draw a system is the most conspicuous
single omission in the template.

**Recommendation.** Port it as one core module in `src/figures/`, consumed by
`{figure}` from D4 and by an optional `architecture:` block on a project. All
geometry computed and emitted as real SVG elements — no `style` attributes, so
`style-src 'self'` holds. That constraint is not hypothetical: it is what forced
the eight `.skill-dot.cat-N` rules in `styles.css` after inline styles were
silently stripped.

---

### D6. Zero imagery, anywhere in the schema

**Severity: high**

No `image`, `avatar`, `hero`, `cover` or `screenshot` field exists on
`SiteProfile`, `WorkItem` or `BlogPost` (`src/types.ts`), and:

```
$ grep -rn "<img\|\"img\"\|picture" src/ | grep -v 'role: "img"'
(no matches)
```

No portrait, no project screenshot, no diagram raster — and no source image
from which an OG card (D2) could ever be built. `harrison-site` ships
responsive AVIF/WebP/JPEG hero sets at four widths behind `HeroPicture`,
`HeroSplit`, `HeroOverlay`, `ResponsiveHero` and `HeroCaption`.

**Recommendation.** Optional `image` on profile and work item, plus `{image}`
body entries, behind one `<picture>` component with intrinsic width/height set
so nothing shifts on load, and a required `alt`. Note the gate already exists
before the feature does — `check-ux.mjs:184` fails on an `img` without `alt`.

---

### D7. The home page has no composition, and buries the product — FIXED

**Severity: high** (positioning, not just aesthetics)

`src/app.tsx:398–422` in full: optional demo eyebrow, `h1`, `.lede`, `.prose`,
contact row, three pill buttons, skill bank. No hero, no featured work, no
proof above the fold.

The three buttons are `Work` (primary), `Graph` (secondary), `Try Fit`
(secondary). **Fit — the one thing that makes this not just another portfolio
template — is the third of three, in the de-emphasized variant, with no
explanation of what it does.** The README leads with it; the home page treats
it as an afterthought.

**Recommendation.** Compose a hero, promote Fit to the primary call to action
with a one-line description, and put two or three featured projects above the
skill bank. Use `--text-display` (D3) for the hero so the type scale reaches
its top step.

---

### D8. Missing component vocabulary

**Severity: medium**

Present in `harrison-site`, absent here: `SectionHead` (eyebrow + title + intro
as one unit — only the bare `.eyebrow` exists), `Breadcrumb`, `PageByline`,
`ProjectPager`, `ProjectTile`, `ContentSortToggle`, `FooterIcon`, `Kbd` (`<kbd>`
is styled ad-hoc inside `.search-trigger`), and a real `Card` component.

Related and concrete: `date` is authored on both `WorkItem` and `BlogPost` and
**rendered by nothing**.

```
$ grep -rn "\.date\|<time\|\"time\"" src/
(no matches)
```

A blog with no visible dates, and project pages that never say when the work
happened — for a recruiter-facing site, recency is one of the few signals that
matters, and it is authored and then discarded.

**Recommendation.** `SectionHead`, `Breadcrumb`, `PageByline` (which renders
`date` in a `<time>`) and `ProjectPager` carry the most weight per line added.

---

## Part 3 — System reach

### D9. The graph is themed independently of the adopter

**Severity: medium**

`tokens/graph.css:12–24` pins node hues to fixed `oklch()` values and the canvas
to `#050505`. None derive from `--rm-brand`. A fork with a purple accent still
gets blue / amber / teal / red nodes, and in light mode gets a near-black
rectangle dropped into a cream page — there is no light-mode graph palette.
`harrison-site` has one (`tokens/graph.css:29`,
`:root[data-theme="light"] .pg-page`).

The same applies to `--cat-1`…`--cat-8` in `tokens/colors.css`: eight saturated
hues, outside the adopter theme, and the most-repeated colored element on the
home page (every skill-chip dot). A fork's dots never match its palette.

---

### D10. The graph is a black box for a11y and control

**Severity: medium**

The whole surface is `role="img"` with a single `aria-label`
(`src/graph/GraphPage.tsx:92–96`). No keyboard path to any node, no text
alternative describing what is in it.

```
$ grep -rn "prefers-reduced-motion\|reducedMotion" graph/ src/
(no matches)
```

ForceAtlas2 animates on load regardless of the user's OS setting, while
`tokens/base.css:41` carefully honors that setting everywhere else in the
system. There is also no non-WebGL fallback (`harrison-site` has
`PortfolioGraphFallback`), no legend, and no layer toggles — despite the data
model already carrying three edge layers
(`KgEdgeLayer = "related" | "skills" | "writing"`,
`src/graph/buildKnowledgeGraph.ts:14`). The toolbar exposes a gravity slider
and nothing else.

---

### D11. Responsive design stops at one breakpoint

**Severity: medium**

`styles.css` contains exactly two media queries, both `min-width: 768px`
(lines 450 and 906). `--bp-sm` and `--bp-lg` are declared and unused (D3), and
`--container-wide` (1280px) is used by nothing — not even `/graph`.

On a 1440px display the site is a 960px column with a 2-up card grid: pixel-
identical to an iPad. There is no wide-screen composition at all.

`check-ux.mjs:238` samples 375 and 1280. The 768 boundary — where both media
queries in the entire stylesheet fire — is never rendered, and neither is 1440.

---

### D12. No print stylesheet

**Severity: medium**

```
$ grep -rn "@media print" --include=*.css . --exclude-dir=node_modules | wc -l
0
```

The Fit brief is precisely the artifact a recruiter saves as PDF or forwards to
a hiring manager. `styles.css:396` even reasons about the status ramp surviving
"a grayscale print" — but nothing implements a print layout, so the sticky
header, nav, search trigger, skill bank and a black WebGL canvas all land in
the PDF.

---

### D13. Feedback and state design is a single fade

**Severity: low**

One color transition and one 2px lift (`tokens/base.css:198–220`). Fit's
matching pass has no loading state beyond `.btn:disabled { cursor: wait }`;
results appear with no transition; the error state is
`.error { color: var(--danger) }` and nothing more; the only empty state is
`.card-empty`. For the one page a recruiter actually interacts with, this is
the thinnest layer in the system.

---

## Part 4 — Governance

### D14. No visual reference surface

**Severity: medium**

`docs/guide/theming.md` describes the system in prose. There is no
`/styleguide` route and no rendered token gallery, so an adopter who changes
`accent` must build the entire site to see three components react.

A styleguide route would also serve as a fixture `check-ux.mjs` can sweep,
which means one route covers every component — including the ones no content
page happens to use, which are exactly the ones that rot.

### D15. `check-style-tokens.mjs` is one-directional

**Severity: medium** — see D1 and D3, both of which are live because of it.

### D16. No visual-regression baseline

**Severity: low**

`check-ux.mjs` catches contrast, overflow, touch targets, `h1` count and
missing `alt` — genuinely good, and ahead of the dogfood site. Nothing catches
layout drift, so a broken grid is invisible to CI while a 0.04 alpha nudge is
not.

---

## Part 5 — What should flow back to `harrison-site`

| Finding | Detail |
|---|---|
| **No contrast or a11y gate at all** | `scripts/org/` has `check-responsive.mjs` (horizontal overflow only) and `check-copy-lint.py`. Nothing measures contrast, focus rings, touch targets, `h1` count or `img` alt. `check-ux.mjs` — which correctly composites alpha over the real background — should be ported upstream. |
| **`design-system/` is a hand-maintained copy** | Per its `CLAUDE.md`, "a copy of, not an import from" `app.jsx`. Drift is guaranteed, and no gate compares them, though `check-doc-drift` and `check-fit-engine-drift` exist for other pairs. |
| **The same un-tokenized social card** | `scripts/prerender-routes.mjs:382` generates cards the same way, from a template outside the token system. D2(b) and D2(c) apply there too; D2(a) does not, since that site is its own adopter. |

---

## Sequencing

Ordered so each step is independently shippable and ends green on `npm test`.

| Step | Findings | Why here |
|---|---|---|
| 0 | ~~D1, D2, D3~~ | **Done.** Small and mechanical; D3's gate is what stops D1 recurring |
| 1 | ~~D4~~ | **Done.** Unblocks everything editorial |
| 2 | D5 | Depends on D4's `{figure}` entry. Scope settled: a measurement-free flow + stack kit, **not** a port — see D5 |
| 3 | D6, ~~D7~~, D8 | Imagery, and the rest of the front door. D7 landed early: it needed composition and copy, not an asset pipeline |
| 4 | D9–D13 | Breadth: graph, print, wide screens, feedback |
| 5 | D14, D16, Part 5 | Governance, and the reverse port |
