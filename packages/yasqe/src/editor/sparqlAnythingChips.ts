/**
 * Chips after the opening brace of each closed `SERVICE <x-sparql-anything:...> {` block. Yasqe only finds the
 * blocks and places the chips; their content comes from the `sparqlAnythingChip` config function (Yasgui shows
 * the state of the source and its actions: load the structure, inspect it, retry).
 */
import { Extension, RangeSetBuilder, StateEffect } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import type Yasqe from "../";
import type { SparqlAnythingSource } from "../sparqlAnything";

/** Returns the chip for a source, or nothing to show no chip */
export type SparqlAnythingChipFn = (yasqe: Yasqe, source: SparqlAnythingSource) => HTMLElement | null | undefined;

/** Redraws the chips, e.g. when the state of a source changed */
export const refreshSparqlAnythingChips = StateEffect.define<null>();

class ChipWidget extends WidgetType {
  constructor(
    readonly yasqe: Yasqe,
    readonly source: SparqlAnythingSource,
    readonly revision: number,
  ) {
    super();
  }
  eq(other: ChipWidget) {
    return other.source.key === this.source.key && other.revision === this.revision;
  }
  toDOM() {
    const wrapper = document.createElement("span");
    wrapper.className = "yasqe_sparqlAnythingChip";
    const content = this.yasqe.config.sparqlAnythingChip?.(this.yasqe, this.source);
    if (content) wrapper.appendChild(content);
    return wrapper;
  }
  // Clicks go to the chip's buttons, not to the editor
  ignoreEvent() {
    return true;
  }
}

export function sparqlAnythingChips(yasqe: Yasqe): Extension {
  let revision = 0;
  const build = (): DecorationSet => {
    if (!yasqe.config.sparqlAnythingChip) return Decoration.none;
    const builder = new RangeSetBuilder<Decoration>();
    for (const source of yasqe.getSparqlAnythingSources()) {
      if (!source.closed) continue;
      const widget = new ChipWidget(yasqe, source, revision);
      builder.add(source.openBrace + 1, source.openBrace + 1, Decoration.widget({ widget, side: 1 }));
    }
    return builder.finish();
  };
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(_view: EditorView) {
        this.decorations = build();
      }
      update(update: ViewUpdate) {
        const refresh = update.transactions.some((tr) => tr.effects.some((e) => e.is(refreshSparqlAnythingChips)));
        if (refresh) revision++;
        if (refresh || update.docChanged) this.decorations = build();
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
}
