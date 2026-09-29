---
"@matdata/yasqe": minor
---

Support SPARQL 1.2 syntax in the query editor, following the grammar of the [SPARQL 1.2 Query Language](https://www.w3.org/TR/sparql12-query/#sparqlGrammar) Working Draft of 21 September 2026. SPARQL 1.2 queries are now highlighted and syntax checked, including:

- the `VERSION` declaration
- triple terms `<<( :s :p :o )>>` in triple patterns, `VALUES` and expressions
- reified triples `<< :s :p :o ~ :reifier >>`, reifiers (`~`) and annotation blocks `{| ... |}`. Reifiers and annotations after a property path that is not a simple predicate are reported as errors.
- language tags with a base direction, such as `"hello"@en--ltr`
- the new functions `LANGDIR`, `STRLANGDIR`, `hasLANG`, `hasLANGDIR`, `isTRIPLE`, `TRIPLE`, `SUBJECT`, `PREDICATE` and `OBJECT`
- `!` applied to any unary expression, and aggregates wherever a built-in call is allowed

A blank node property list followed by a property path (`[ :p ?o ] :a/:b ?c`) is no longer reported as a syntax error.
