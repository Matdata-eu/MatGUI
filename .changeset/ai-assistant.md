---
"@matdata/yasgui": minor
"@matdata/yasr": minor
"@matdata/yasqe": minor
---

Add an AI assistant: write a query from a question in natural language, explain or fix the query in the editor, and explain the results.

The assistant lives in a new **AI** view of the side panel, opened with the **AI** button of the editor toolbar or **Ask AI…** in the Ctrl+K search. The error view of the results gets **Fix with AI** and **Copy for AI**; for a query without results the fix becomes **Why no results?**. Queries in an answer can be put in the editor, inserted, opened in a new tab or copied; nothing is run automatically.

It talks to any OpenAI-compatible chat completions API: services the user adds in Settings → AI (base URL picked from a list of popular providers such as OpenAI, Anthropic, Gemini, Mistral and Kimi, or any other URL, with API key and model), or proxies of the embedding site (`ai.proxy`, one or a list). The user picks a default service and can switch services at the top of the AI view. Without a service, the actions copy a ready-made prompt for any AI chat ("Copy for AI"). Before the first request to a service the user sees what is sent and where, and every answer shows the exact request. The API key is stored in the browser under its own key and is never exported or shared. "Ask" and "Fix" send the endpoint's most used classes and properties (from the same source as the autocomplete) as context, and the model may run up to five small read-only check queries (SELECT/ASK, at most 20 rows) on the endpoint, each shown in the answer. Embedding pages configure it with the new `ai` option, or remove it with `ai: { enabled: false }`.

YASR gets `hostApi.assistant`, `yasr.askAssistant({ title, prompt, context })` for plugins, and an `assistant` config hook. YASQE keeps the first syntax error of the query in `yasqe.syntaxError`.
