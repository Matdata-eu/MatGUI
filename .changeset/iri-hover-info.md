---
"@matdata/yasgui": minor
"@matdata/yasqe": minor
---

Show the label, description and type of an IRI when hovering it in the query editor (#196).

After a short delay a tooltip shows the full IRI, its `rdfs:label` / `skos:prefLabel` (in the browser language when available), `rdfs:comment` / `skos:definition`, `rdf:type` and, for properties, `rdfs:domain` / `rdfs:range`. The information is fetched with a small background query on the tab's endpoint (with its authentication), cached per endpoint and IRI, and looked up in LOV when the endpoint doesn't describe the IRI. Users can switch it off in Settings → Editor; embedding pages can use the new Yasgui options `iriHover` and `iriHoverLovFallback`.

YASQE gets an `iriHover` option (tooltip content for a hovered IRI), `iriHoverDelay`, and a `getIriAt(pos)` method that returns the IRI or expanded prefixed name at a position.
