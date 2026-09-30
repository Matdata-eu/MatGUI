---
"@matdata/yasqe": minor
---

Support SPARQL 1.2 syntax in the query editor, following the grammar of the [SPARQL 1.2 Query Language](https://www.w3.org/TR/sparql12-query/#sparqlGrammar) Working Draft of 21 September 2026. SPARQL 1.2 queries are now highlighted and syntax checked, including:

- the `VERSION` declaration
- triple terms `<<( :s :p :o )>>` in triple patterns, `VALUES` and expressions
- reified triples `<< :s :p :o ~ :reifier >>`, reifiers (`~`) and annotation blocks `{| ... |}`. Reifiers and annotations after a property path that is not a simple predicate are reported as errors, and so are reified triples and annotations without an explicit reifier in `DELETE`, `DELETE DATA` and `DELETE WHERE` (their implicit reifier is a blank node).
- language tags with a base direction, such as `"hello"@en--ltr`
- the new functions `LANGDIR`, `STRLANGDIR`, `hasLANG`, `hasLANGDIR`, `isTRIPLE`, `TRIPLE`, `SUBJECT`, `PREDICATE` and `OBJECT`
- `!` applied to any unary expression, and aggregates wherever a built-in call is allowed

Syntax checking is now tested against the W3C SPARQL 1.0, 1.1 and 1.2 test suites and the curated tests of Traqula, which uncovered and fixed these issues:

- A blank node property list followed by a property path (`[ :p ?o ] :a/:b ?c`) is no longer reported as a syntax error.
- Variables and prefixed names may contain characters outside the Basic Multilingual Plane (e.g. `?🎄`).
- A line ending in `"` or `""` inside a long (`"""`) literal is no longer reported as a syntax error.
- `INSERTDATA`, `DELETEDATA` and `DELETEWHERE` (without white space) are reported as syntax errors.
- Unicode escapes of surrogate code points (e.g. `"🂡"`) are reported as syntax errors, as are backslashes in IRIs that are not a unicode escape.

Known incompatibility: a `<` comparison written without a space before a full IRI, such as `FILTER(?o<<http://example.org/a>)`, is now reported as a syntax error. SPARQL 1.2 reads `<<` as a single token (the longest match wins), so a SPARQL 1.2 parser rejects this query as well. Add a space to fix it: `FILTER(?o < <http://example.org/a>)`.
