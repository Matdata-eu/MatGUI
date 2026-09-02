/**
 * CodeMirror 6 autocompletion bridge.
 *
 * YASQE's autocompleters (see ../autocompleters) were written against the CodeMirror 5
 * `show-hint` addon: a "hint function" returns a list of `Hint`s together with the range
 * that should be replaced. This module adapts that model onto `@codemirror/autocomplete`:
 *
 * - A single `CompletionSource` is registered. Whenever it is queried it asks the host
 *   (the `Yasqe` facade) for the currently active hint function and converts its result
 *   into a `CompletionResult`.
 * - `Hint.from` / `Hint.to` are honoured per completion by using a custom `apply`.
 * - Open/close transitions are observed through `completionStatus` and reported to the host
 *   so that the legacy `autocompletionShown` / `autocompletionClose` events keep working.
 */
import { EditorState, Extension, Text } from "@codemirror/state";
import { EditorView, ViewUpdate } from "@codemirror/view";
import {
  autocompletion,
  Completion,
  CompletionContext,
  CompletionResult,
  completionStatus,
  completionKeymap,
  startCompletion,
  closeCompletion,
} from "@codemirror/autocomplete";
import { keymap } from "@codemirror/view";
import { Prec } from "@codemirror/state";
import type { Position } from "./tokenizerRunner";
import { posToOffset, offsetToPos } from "./doc";

export interface Hint {
  text: string;
  displayText?: string;
  className?: string;
  /** Kept for API compatibility; custom rendering is not supported by the CM6 bridge. */
  render?: (el: HTMLElement, self: Hint, data: any) => void;
  from?: Position;
  to?: Position;
}
export interface HintList {
  list: Hint[];
  from: Position;
  to: Position;
}
export type HintFn = { async?: boolean } & (() => Promise<HintList | undefined> | HintList | undefined);

export interface AutocompletionHost {
  /** Returns the hint function that should be used for the current completion session (if any) */
  getHintFn: () => HintFn | undefined;
  onShown?: (tooltipDom: HTMLElement | null) => void;
  onClose?: () => void;
}

export { posToOffset, offsetToPos };

function hintToCompletion(hint: Hint): Completion {
  return {
    label: hint.displayText || hint.text,
    type: hint.className,
    apply: (view: EditorView, _completion: Completion, from: number, to: number) => {
      const doc = view.state.doc;
      const replaceFrom = hint.from ? posToOffset(doc, hint.from) : from;
      const replaceTo = hint.to ? posToOffset(doc, hint.to) : to;
      const start = Math.min(replaceFrom, replaceTo);
      const end = Math.max(replaceFrom, replaceTo);
      view.dispatch({
        changes: { from: start, to: end, insert: hint.text },
        selection: { anchor: start + hint.text.length },
        userEvent: "input.complete",
      });
    },
  };
}

export function hintListToCompletionResult(hintList: HintList, doc: Text): CompletionResult | null {
  if (!hintList || !hintList.list || hintList.list.length === 0) return null;
  const from = posToOffset(doc, hintList.from);
  const to = posToOffset(doc, hintList.to);
  return {
    from: Math.min(from, to),
    to: Math.max(from, to),
    options: hintList.list.map(hintToCompletion),
    // Completers already filtered and ordered their suggestions
    filter: false,
  };
}

function createCompletionSource(host: AutocompletionHost) {
  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    const hintFn = host.getHintFn();
    if (!hintFn) return null;
    const result = await hintFn();
    if (!result || context.aborted) return null;
    return hintListToCompletionResult(result, context.state.doc);
  };
}

/**
 * Autocompletion extension. `host.getHintFn()` is consulted every time CodeMirror queries for completions.
 */
export function sparqlAutocompletion(host: AutocompletionHost): Extension {
  const statusListener = EditorView.updateListener.of((update: ViewUpdate) => {
    const before = completionStatus(update.startState);
    const after = completionStatus(update.state);
    if (before === null && after !== null) {
      host.onShown?.(update.view.dom.querySelector<HTMLElement>(".cm-tooltip-autocomplete"));
    } else if (before !== null && after === null) {
      host.onClose?.();
    }
  });
  return [
    autocompletion({
      override: [createCompletionSource(host)],
      // YASQE decides itself when to open the popup (see Yasqe.autocomplete)
      activateOnTyping: false,
      closeOnBlur: true,
      // We register the navigation keys ourselves (below) so that `Ctrl-Space` is exclusively handled by
      // YASQE's `extraKeys` (which builds the hint function before opening the popup).
      defaultKeymap: false,
      icons: false,
      // CM5 rendered the complete hint list; CM6 pages by 100 items by default. Render everything so that
      // consumers that inspect the popup (and the existing tests) see the full list.
      maxRenderedOptions: 100000,
      // CM5 accepted a completion immediately after the popup opened; CM6 ignores Enter/arrows during the first
      // 75ms (and lets the key fall through, inserting a newline). Keep the CM5 behaviour.
      interactionDelay: 0,
      // Keep the CM5 class names around so existing styling / tests keep working
      tooltipClass: () => "CodeMirror-hints",
      optionClass: (completion) => (completion.type ? completion.type : ""),
    }),
    Prec.highest(keymap.of(completionKeymap.filter((binding) => binding.key !== "Ctrl-Space"))),
    statusListener,
  ];
}

export function isCompletionActive(state: EditorState): boolean {
  return completionStatus(state) !== null;
}

export function openCompletion(view: EditorView): boolean {
  return startCompletion(view);
}

export function hideCompletion(view: EditorView): boolean {
  return closeCompletion(view);
}
