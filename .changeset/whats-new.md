---
"@matdata/yasgui": minor
---

**What's new**: the help button of the top bar now opens a menu with **What's new** and the **Documentation**. What's new lists the changes of each version since 5.0.0 as New, Improved or Fixed, with a filter per kind and a link to the full release notes. After an update a dot on the help button points to it until it is opened; first-time users get no dot. Also in the Ctrl+K search. Embedders can switch it off with `showWhatsNew: false` and add their own entries with `yasgui.helpMenu.addItem()`. `helpUrl: false` now only leaves out the documentation entry.
