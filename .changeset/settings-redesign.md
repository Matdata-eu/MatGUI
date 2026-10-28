---
"@matdata/yasgui": minor
---

Redesign the settings, after the settings window of textfold. The pages are grouped in the navigation (Querying, Your data, Assistant, Help) with an icon each, and each setting is a row with one line about it and its control on the right (switches, segmented choices, selects). The header and footer stay in place while the page scrolls. Changes apply at once: the Save and Cancel buttons are gone, the footer says "Saved" after a change, and Done closes the settings.

The new **General** page holds the theme (Light, Dark or System), the editor themes, the request settings and what happens before a query runs. The request method, Accept headers and custom HTTP headers now apply to every tab, including tabs opened later (stored as `requestSettings` in the persisted config); the formatter, auto-format and the CONSTRUCT check now apply to every tab too, and are kept across reloads. `tab.openSettings("request")` still works and opens General.

Settings → AI: services stay cards, with the default one selected. Adding or editing a service now starts with a **Provider** list (searchable, grouped); the provider fills in the base URL, which can still be changed (marked "Changed", with a reset) and links to the page where users get an API key. **Fetch models** replaces Test connection and fills a searchable **Model** list, with the provider's recommended models first and any model id accepted. When a browser can't read a service's model list (CORS), MatGUI says so, offers the models it knows for that provider, and explains what to do (a proxy, OpenRouter, or the CORS setting of Ollama or LM Studio). Services remember their provider (`providerId`).
