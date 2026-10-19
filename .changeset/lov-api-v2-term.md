---
"@matdata/yasqe": patch
---

Fix class and property suggestions from Linked Open Vocabularies, which failed with HTTP 404: LOV moved its API to `/dataset/api/v2/term/autocomplete` (for IRIs and prefixed names) and `/dataset/api/v2/term/search` (used for plain words).
