# Third-party notices

recruit-me itself is MIT-licensed — see [LICENSE](./LICENSE). This file covers
the third-party code that is **committed into this repository and shipped to
the browser**, because that is redistribution and MIT requires the copyright
notice to travel with it.

Build-time tooling (esbuild, TypeScript, tsx, Playwright, the `@types/*`
packages) is *not* listed. It never reaches `dist/`, so it is not redistributed.

Every dependency below is MIT, the same license as this project. The full
license text appears once at the end.

## Vendored verbatim

| File | Package | Version | Copyright |
|---|---|---|---|
| `assets/vendor/react.production.min.js` | react | 18.3.1 | Copyright (c) Facebook, Inc. and its affiliates. |
| `assets/vendor/react-dom.production.min.js` | react-dom | 18.3.1 | Copyright (c) Facebook, Inc. and its affiliates. |

These are the unmodified production builds from the React distribution, and
each retains its own `@license` banner in the file. They are self-hosted rather
than loaded from a CDN so the site can run under a strict
Content-Security-Policy ([ADR 013](./docs/architecture/adr/013-csp-graph-opts-forces.md)).

## Bundled into `assets/graph-engine.js`

Built from `graph/*.mjs` by `scripts/build-graph-vendor.mjs`, which bundles:

| Package | Version | Copyright |
|---|---|---|
| [graphology](https://github.com/graphology/graphology) | 0.26.0 | Copyright (c) 2016-2021 Guillaume Plique (Yomguithereal) |
| [graphology-layout-forceatlas2](https://github.com/graphology/graphology) | 0.10.1 | Copyright (c) 2016-2021 Guillaume Plique (Yomguithereal) |
| [sigma](https://github.com/jacomyal/sigma.js) | 3.0.3 | Copyright (C) 2013-2025, Alexis Jacomy, Guillaume Plique, Benoît Simard https://www.sigmajs.org |

The bundle is minified and these packages publish no license banners of their
own, so their notices live here rather than inside the artifact. The build sets
esbuild's `legalComments: "eof"`, so if any of them starts shipping a banner it
survives into the file instead of being dropped.

Versions come from `package.json` / `package-lock.json`; when you bump one of
these, update the row.

## MIT License

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
