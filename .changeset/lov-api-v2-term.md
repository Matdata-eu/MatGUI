---
"@matdata/yasqe": minor
---

Class and property suggestions from Linked Open Vocabularies no longer call the LOV API, which is broken (HTTP 404 on the old path, a search backend error on the new one). Yasqe bundles the classes and properties of the most used LOV vocabularies (`packages/yasqe/src/lov-terms.json`, about 600 KB at most, refreshed with `npm run util:fetchLov` or the "Refresh LOV terms" workflow) and searches them in the browser. LOV suggestions are now inserted as prefixed names with their `PREFIX`. The new `lovTerms` option replaces the list, or leaves out LOV suggestions when set to `null`.
