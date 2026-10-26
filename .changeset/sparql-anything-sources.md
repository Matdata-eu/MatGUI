---
"@matdata/yasgui": minor
"@matdata/yasqe": minor
---

Help with SPARQL Anything queries. A chip after the opening brace of each `SERVICE <x-sparql-anything:...> { }` block loads, on request, the structure of its source with one query to the endpoint of the tab (the SERVICE IRI and `fx:properties` options are sent unchanged, so files that only the endpoint can reach work too). Once loaded, the columns, keys and XML elements (`xyz:email`, `xyz:book`) are suggested first in autocompletion, and a new **Source** view of the side panel shows the structure (click to insert), a preview of the first 100 triples, and a query builder that writes the `fx:anySlot` patterns for the values you tick, with OPTIONAL for optional values. The Source view is only listed while the query has such a block, and nothing is sent for other queries. Loaded structures are remembered per endpoint and options for a day. Switch it off with `sparqlAnything: false`.

YASQE gets `getSparqlAnythingSources()`, `getSparqlAnythingSourceAt()`, `Yasqe.SparqlAnything.findSparqlAnythingSources()`, and the `contextTerms` and `sparqlAnythingChip` config options. The side panel gets `setViewVisible(view, visible)`. `dev/sparql-anything` has a Docker Compose test environment with a SPARQL Anything server and sample CSV, TSV, JSON and XML files.
