---
"@matdata/yasgui": minor
---

Add read-only workspaces. A workspace with `readOnly: true` (or the **Read-only** checkbox in the workspace settings) can still be browsed and its queries opened, but it is never offered as a save target, and its queries cannot be updated, renamed, moved or deleted. Saving a query opened from a read-only workspace opens "Save as" so a copy can be stored in another workspace.
