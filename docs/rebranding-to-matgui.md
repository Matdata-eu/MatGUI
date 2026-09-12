# MatGUI — Migration & Rebranding Guide

**Yasgui is now MatGUI — _A modern knowledge graph and SPARQL workbench._**

> **More than just Another SPARQL GUI.**

This document explains what changed, why, and what (if anything) you need to do.

**TL;DR — nothing breaks.** Only the user-facing project *branding* changed. All package names, APIs, class names, CSS classes, global variables and localStorage keys are unchanged. If you use `@matdata/yasgui`, `@matdata/yasqe` or `@matdata/yasr`, you do **not** need to change your code or dependencies.

---

## Why the rename?

This project began as a fork of the Yasgui ecosystem and has since evolved substantially — new features, a modernised codebase, and a broader scope as a knowledge-graph workbench rather than just a query GUI.

Because two other actively- or formerly-maintained projects also carry the *Yasgui* name — the [rdfjs](https://github.com/rdfjs) / [Zazuko](https://github.com/zazuko/Yasgui) Yasgui and the original [Triply](https://github.com/TriplyDB/Yasgui) Yasgui — continuing to use "Yasgui" for our project caused genuine confusion for users, packagers and search engines about which project they were looking at.

Renaming to **MatGUI** gives the project a clear, distinct identity while openly honouring its Yasgui heritage.

---

## What changed vs. what stayed the same

| Area | Status |
| --- | --- |
| Project name / branding | **Changed** → MatGUI |
| Titles, taglines, docs, website, UI copy | **Changed** → MatGUI |
| Github repository | **Changed** → Matdata-eu/MatGUI |
| npm package names (`@matdata/yasgui`, `@matdata/yasqe`, `@matdata/yasr`, `@matdata/yasgui-utils`) | **Unchanged** |
| Public API, class names, interfaces (`Yasgui`, `Yasqe`, `Yasr`) | **Unchanged** |
| Global variables (`window.Yasgui`, `Yasgui.Yasr`, …) | **Unchanged** |
| CSS class names (`.yasgui`, `.yasqe`, `.yasr`) and CSS custom properties (`--yasgui-*`) | **Unchanged** |
| localStorage / persistence keys | **Unchanged** |
| External plugin package names (`@matdata/yasgui-graph-plugin`, `@matdata/yasgui-table-plugin`, `@matdata/yasgui-geo-plugin`) | **Unchanged** |
| Docker image (`mathiasvda/yasgui`) | **Unchanged** |
| New Docker image (`mathiasvda/matgui`) | **New** |

We deliberately kept every technical identifier stable to guarantee **zero breaking changes**.

---

## Do I need to change my dependencies?

**No.** Keep installing and importing exactly as before:

```bash
npm install @matdata/yasgui
```

```javascript
import Yasgui from "@matdata/yasgui";
import "@matdata/yasgui/build/yasgui.min.css";

const yasgui = new Yasgui(document.getElementById("yasgui"), {
  requestConfig: { endpoint: "https://dbpedia.org/sparql" },
});
```

CDN usage is also unchanged:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@matdata/yasgui/build/yasgui.min.css" />
<script src="https://cdn.jsdelivr.net/npm/@matdata/yasgui/build/yasgui.min.js"></script>
```

---

## Will existing links continue to work?

Yes. The GitHub repository rename preserves history, stars, forks, issues, pull requests and releases, and GitHub automatically redirects the old repository URL to the new one. Existing clone URLs, issue links and release links keep working via redirect.

We've 
- **Live app:** https://yasgui.matdata.eu/ will propose to redirect to https://matgui.matdata.eu/
- **Docs:** https://yasgui-doc.matdata.eu/ will propose to redirect to https://matgui-doc.matdata.eu/
- **Docker:** https://hub.docker.com/r/mathiasvda/yasgui remains supported but we've added https://hub.docker.com/r/mathiasvda/matgui 

NPM links remains unchanged:
- **npm:** https://www.npmjs.com/package/@matdata/yasgui (unchanged)

LocalStorage saved on https://yasgui.matdata.eu/ can be ported to https://matgui.matdata.eu by [following the instructions provided in the user guide](https://matgui-doc.matdata.eu/docs/user-guide/#configuration-importexport). 

---

## What happens to the npm packages?

The npm packages **keep their current names** (`@matdata/yasgui`, `@matdata/yasqe`, `@matdata/yasr`, `@matdata/yasgui-utils`). Only the package **descriptions and READMEs** now refer to MatGUI. There is no new package to install and no deprecation — this avoids splitting the user base and preserves your existing lockfiles.

---

## Is this still related to Yasgui?

MatGUI is **derived from and inspired by** Yasgui and proudly acknowledges that heritage. However, MatGUI is an **independent project**, developed and maintained by [Matdata](https://matdata.eu). It is **not affiliated with, endorsed by, or an official continuation of** the rdfjs/Zazuko or Triply Yasgui projects. See [Attribution](#attribution) below.

---

## Attribution

MatGUI gratefully acknowledges the **Yasgui** project.

- It began as a fork of [Zazuko/Yasgui](https://github.com/zazuko/Yasgui), itself forked from the original [Triply/Yasgui](https://github.com/TriplyDB/Yasgui) created by **Laurens Rietveld** and the Triply team.
- The name *Yasgui* (Yet Another SPARQL GUI) and the original YASQE and YASR components were created and maintained by those teams and their many contributors. We thank each of them for their foundational contributions to open SPARQL tooling.
- MatGUI has since evolved independently, with new features, a modernised codebase and an expanded scope, and is maintained by [Matdata](https://matdata.eu).

MatGUI is **not affiliated with, endorsed by, or an official continuation of** the rdfjs-, Zazuko-, or Triply-maintained Yasgui projects.

---

## Branding reference

| Field | Value |
| --- | --- |
| Project title | **MatGUI** |
| Subtitle | A modern knowledge graph and SPARQL workbench |
| Tagline | More than just Another SPARQL GUI |
| GitHub description | MatGUI — a modern knowledge graph and SPARQL workbench (formerly Yasgui). |
| npm description | MatGUI: a modern SPARQL query editor and results viewer for knowledge graphs and linked data (formerly Yasgui). |
| Meta description | MatGUI — a modern knowledge graph and SPARQL workbench for querying, exploring and visualising RDF and linked data. Formerly Yasgui. |
