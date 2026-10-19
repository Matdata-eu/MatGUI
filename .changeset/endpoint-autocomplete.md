---
"@matdata/yasgui": minor
"@matdata/yasqe": minor
---

Suggest the classes and properties used in the current endpoint in autocompletion, most used first with their usage count, before the Linked Open Vocabularies suggestions (#195).

The terms come from the Endpoint overview: VoID class/property partitions, complete Classes/Properties results, or otherwise one limited background query (with the tab's authentication) whose result is cached per endpoint. Picking a suggestion inserts a prefixed name and declares the missing prefix. The suggestions can be switched off per endpoint in the Endpoint overview, or for all endpoints with `endpointDescribe.autocomplete: false`. YASQE gets an `endpointTerms` option to provide such terms, and hints can now carry a detail, a section and prefixes to declare.
