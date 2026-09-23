---
"@matdata/yasgui-utils": minor
"@matdata/yasqe": minor
"@matdata/yasr": minor
"@matdata/yasgui": minor
---

Ship ES module and CommonJS builds so the packages can be imported by bundlers (Vite/webpack/esbuild) and Node.

Each package now builds three bundles: an ES module (`*.mjs`), a CommonJS module (`*.cjs`) and the existing browser global IIFE (`*.min.js`). The `package.json` of every package exposes them through `main` (CommonJS), `module` (ESM), `unpkg`/`jsdelivr` (browser global) and a conditional `exports` map with `import`, `require`, `types` and `default` entries. This makes the documented `import Yasgui from "@matdata/yasgui"` usage work in module bundlers, while `<script src=".../build/yasgui.min.js">` keeps exposing the global.
