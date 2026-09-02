---
"@matdata/yasqe": major
"@matdata/yasr": major
"@matdata/yasgui": major
---

Migrate the editor stack from CodeMirror 5 to CodeMirror 6.

**@matdata/yasqe**

- The query editor now runs on CodeMirror 6 (`@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/autocomplete`, `@codemirror/search`, `@codemirror/commands`).
- `Yasqe` no longer extends the CodeMirror class. It wraps an `EditorView` and exposes a CodeMirror 5–compatible facade (`getValue`, `setValue`, `getCursor`, `setCursor`, `getTokenAt`, `getDoc`, `markText`, `on('change' | 'cursorActivity' | ...)`, `addKeyMap`, ...). Code relying on CodeMirror 5 internals (`yasqe.display`, `CodeMirror.defineMode`, addons, `codemirror/theme/*.css`) must be updated.
- The underlying `EditorView` is available for advanced integrations that want to use CodeMirror 6 extensions directly.
- Syntax highlighting, error/warning gutter markers, PREFIX/brace folding, autocompletion popups (`.CodeMirror-hints`), formatting, comment toggling and all keyboard shortcuts keep their previous behaviour. Token CSS classes keep the CodeMirror 5 names (`cm-keyword`, `cm-variable-3`, ...), and the editor root still carries the `CodeMirror cm-s-<theme>` classes so existing theme stylesheets continue to apply.

**@matdata/yasr**

- The Response plugin renders raw responses with a read-only CodeMirror 6 view (`@codemirror/lang-json`, `@codemirror/lang-xml`, legacy Turtle mode) instead of CodeMirror 5.

**@matdata/yasgui**

- Adapted to the new editor API (Ctrl/Cmd-click IRI navigation, theme handling).
- The editor theme picker now offers the bundled `default` and `github-dark` themes; the CodeMirror 5 theme catalogue (`material-palenight`, `dracula`, ...) is no longer shipped. Custom themes can be added by styling the `cm-s-<name>` class.
