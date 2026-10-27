---
"@matdata/yasgui": patch
"@matdata/yasr": patch
"@matdata/yasgui-utils": patch
---

Require DOMPurify 3.4.17 or later, so installs never resolve a version with the published DOMPurify advisories. Packages now depend on the matching version of each other (`@matdata/yasqe`, `@matdata/yasr`, `@matdata/yasgui-utils`) instead of the 4.x line.
