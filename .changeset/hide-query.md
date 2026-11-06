---
"@matdata/yasgui": minor
"@matdata/yasqe": minor
---

Hide the query editor so the results take the whole card (#258): a "Hide query" button in the editor toolbar and a Ctrl+K command, remembered per tab. Share links can open with the query hidden (`hideQuery=true`, offered as "Show only the results" in the share popup), and the `hideQuery` config option opens new tabs that way. An update or invalid query from a link is always shown. The share popup is redesigned in the MatData look: the link with a Copy button, the option, the shortener and the cURL, PowerShell and wget commands, with inline "Copied" feedback instead of toasts. Yasqe's `createShareableLink` now receives `{ hideQuery }`, and the new `shareHideQueryOption` config shows the option.
