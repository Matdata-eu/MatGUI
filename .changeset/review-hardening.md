---
"@matdata/yasgui": minor
"@matdata/yasqe": patch
"@matdata/yasr": patch
"@matdata/yasgui-utils": patch
---

Safer share links, storage and dialogs:

- A query opened from a share link no longer runs on its own when it is an update, has syntax errors, or would send saved credentials or cookies; a message asks first. New `autoRunSharedQueries` option ("safe" by default, "always", "never").
- A malformed `headers` or `outputSettings` parameter in a link is ignored instead of breaking the page.
- When the browser storage is full, MatGUI saves the configuration without query results, and otherwise keeps working and says so. It no longer deletes every tab, endpoint and credential.
- In-app dialogs and toasts replace every `alert`, `confirm` and `prompt`, so they follow the theme and work in sandboxed iframes; available to plugins and embedders as `Yasgui.dialogs`.
- Configuration import reads the Turtle file with a real parser, so tabs without an endpoint or with quotes in their name import correctly.
- Saving a Git query after a stale version tag no longer reports a conflict when the automatic retry succeeded.
- The OAuth 2.0 popup only accepts its result from the origin of the redirect URI.
- Yasqe `requestSendsCredentials()`.
