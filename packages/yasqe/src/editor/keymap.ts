/**
 * Keymap helpers for the CodeMirror 6 based editor.
 *
 * Yasqe historically exposed key bindings using CodeMirror 5 key names
 * (e.g. "Shift-Ctrl-K", "Cmd-Enter", "Esc"). To stay backwards compatible we
 * accept those names in the `extraKeys` config option and convert them to the
 * CodeMirror 6 keymap format.
 */
import { Extension, Prec } from "@codemirror/state";
import { EditorView, KeyBinding, keymap } from "@codemirror/view";
import { defaultKeymap, historyKeymap, indentWithTab, indentLess, indentMore, insertTab } from "@codemirror/commands";
import { searchKeymap } from "@codemirror/search";
import { foldKeymap } from "@codemirror/language";
import { closeBracketsKeymap } from "@codemirror/autocomplete";

/**
 * A key handler in the (CM5-compatible) `extraKeys` config. It receives the
 * Yasqe instance. Returning `false` lets the event propagate to the next
 * binding; anything else is considered "handled".
 */
export type ExtraKeyHandler<T = any> = (yasqe: T) => any;
export type ExtraKeys<T = any> = { [key: string]: ExtraKeyHandler<T> | string };

const MODIFIERS = new Set(["shift", "ctrl", "cmd", "alt", "mod", "meta"]);

const KEY_NAME_MAP: { [cm5: string]: string } = {
  esc: "Escape",
  space: "Space",
  enter: "Enter",
  tab: "Tab",
  backspace: "Backspace",
  delete: "Delete",
  del: "Delete",
  insert: "Insert",
  home: "Home",
  end: "End",
  pageup: "PageUp",
  pagedown: "PageDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  up: "ArrowUp",
  down: "ArrowDown",
};

/**
 * Convert a CodeMirror 5 style key name (e.g. "Shift-Ctrl-K") to a
 * CodeMirror 6 key name ("Shift-Ctrl-k").
 *
 * CM6 uses `event.key` values, so single characters must be lower case
 * (unless shift is pressed), and special keys use their DOM names.
 */
export function convertKeyName(cm5Name: string): string {
  const parts = cm5Name.split(/-(?!$)/);
  const modifiers: string[] = [];
  let key = parts[parts.length - 1];
  for (let i = 0; i < parts.length - 1; i++) {
    const mod = parts[i].toLowerCase();
    if (mod === "meta") modifiers.push("Cmd");
    else if (MODIFIERS.has(mod)) modifiers.push(parts[i][0].toUpperCase() + mod.slice(1));
  }
  const lowerKey = key.toLowerCase();
  if (KEY_NAME_MAP[lowerKey]) {
    key = KEY_NAME_MAP[lowerKey];
  } else if (/^f\d{1,2}$/i.test(key)) {
    key = key.toUpperCase();
  } else if (key.length === 1) {
    // Letters are lower case in CM6 (they match event.key). When shift is part of
    // the binding CM6 also accepts the lower case form and derives the shifted variant.
    key = key.toLowerCase();
  }
  return [...modifiers, key].join("-");
}

/**
 * Build a keymap extension from a CM5-style `extraKeys` object.
 *
 * @param extraKeys CM5-style key -> handler map
 * @param getYasqe  returns the Yasqe instance (passed to the handler)
 * @param commands  named commands that string handlers may refer to
 */
export function extraKeysExtension<T>(
  extraKeys: ExtraKeys<T> | undefined,
  getYasqe: () => T,
  commands: { [name: string]: (yasqe: T) => any } = {},
): Extension {
  if (!extraKeys) return [];
  const bindings: KeyBinding[] = [];
  for (const cm5Key of Object.keys(extraKeys)) {
    const handler = extraKeys[cm5Key];
    const fn: ExtraKeyHandler<T> | undefined = typeof handler === "string" ? commands[handler] : handler;
    if (!fn) continue;
    bindings.push({
      key: convertKeyName(cm5Key),
      run: () => {
        const result = fn(getYasqe());
        return result !== false;
      },
      preventDefault: true,
    });
  }
  // Highest precedence so user defined keys win over the built-in ones.
  return Prec.highest(keymap.of(bindings));
}

/**
 * Tab handling that mimics CM5's `tabMode: "indent"` behaviour: Tab indents,
 * Shift-Tab dedents. When `tabMode` is anything else, tab inserts a tab
 * character (or spaces when `indentWithTabs` is false).
 */
export function tabKeymap(tabMode: string | undefined): Extension {
  if (tabMode === "indent") {
    return keymap.of([
      {
        key: "Tab",
        run: (view: EditorView) => {
          // Indent selection when something is selected, otherwise behave like indentMore.
          return indentMore(view);
        },
        shift: indentLess,
      },
    ]);
  }
  if (tabMode === "default") return keymap.of([indentWithTab]);
  return keymap.of([{ key: "Tab", run: insertTab, shift: indentLess }]);
}

/**
 * The default set of key bindings: standard editing, history, search, folding,
 * bracket closing and autocompletion.
 */
export function defaultKeymaps(): Extension {
  return keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap]);
}
