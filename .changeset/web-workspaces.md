---
"@matdata/yasgui": minor
---

Add read-only **Web** workspaces (#256): queries published as plain `.rq` files on any web server (GitHub Pages, a static host), listed in a `workspace.json` with optional folder labels, endpoint aliases and per-query name, description and endpoint. Query files may start with grlc-style `#+ name:`, `#+ description:` and `#+ endpoint:` lines, which are removed from the query text. Opening a query switches the tab to its endpoint.

Add one in Settings → Workspaces with the type **Web (read-only)**, or share a link with `?workspace=<URL of workspace.json>`: whoever opens it is asked whether to add the workspace, and then sees it in the query browser. Embedding pages can call `yasgui.addWebWorkspace(url)`, or add `{ type: "http", manifestUrl }` through `persistentConfig.addOrUpdateWorkspace`.
