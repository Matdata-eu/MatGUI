---
"@matdata/yasqe": minor
"@matdata/yasgui": patch
---

Format queries with [@matdata/sparql-formatter](https://github.com/Matdata-eu/sparql-formatter) instead of `sparql-formatter`. The new formatter supports SPARQL 1.2 (`VERSION`, triple terms `<<( ... )>>`, reified triples `<< ... ~ r >>`, reifiers and annotations `{| ... |}`, base direction and the new functions), so SPARQL 1.2 queries are now formatted instead of falling back to the legacy formatter. Comments keep their position when a query is formatted, including comments inside empty groups such as `GRAPH ?g { # comment }` ([sparqling/sparql-formatter#30](https://github.com/sparqling/sparql-formatter/issues/30)).

The formatter setting keeps its stored value (`sparql-formatter`), so saved settings are unchanged; the option is now labelled "SPARQL 1.2 Formatter".
