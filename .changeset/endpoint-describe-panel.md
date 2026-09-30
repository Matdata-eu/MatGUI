---
"@matdata/yasgui": minor
"@matdata/yasqe": minor
---

Add an "Endpoint overview" panel to get to know a SPARQL endpoint while writing queries (Describe endpoint button or `F8`).

The panel shows the endpoint's SPARQL Service Description and VoID description (when published) and offers bounded overview queries for named graphs, triple counts, namespaces, classes, properties, SKOS schemes, shapes, sample instances, hubs, languages, links and time/geo properties. Results are remembered per endpoint, also when other queries are executed or the page is reloaded. The panel docks next to the editor, can be pinned, collapsed and resized, and follows the endpoint of the active tab. Queries and categories can be extended through the new `endpointDescribe` configuration.

YASQE's `executeQuery` gets a `skipGraphArgs` option to leave out the tab's default/named graph arguments.
