/**
 * Marker gutters replacing the CodeMirror 5 `setGutterMarker` / `clearGutter` API.
 *
 * Two named gutters are supported: `gutterErrorBar` (syntax errors) and `gutterConstructWarning`
 * (undefined variables in CONSTRUCT templates). Markers are arbitrary DOM elements, exactly like
 * in CodeMirror 5, so the existing tooltip logic keeps working.
 */
import { EditorState, StateEffect, StateField, RangeSet, Extension } from "@codemirror/state";
import { EditorView, gutter, GutterMarker } from "@codemirror/view";

export type GutterName = "gutterErrorBar" | "gutterConstructWarning";
export const GUTTER_NAMES: GutterName[] = ["gutterErrorBar", "gutterConstructWarning"];

class ElementMarker extends GutterMarker {
  constructor(readonly element: HTMLElement) {
    super();
  }
  eq(other: ElementMarker) {
    return other.element === this.element;
  }
  toDOM() {
    return this.element;
  }
}

interface SetMarkerSpec {
  gutter: GutterName;
  /** 0-based line number */
  line: number;
  element: HTMLElement | null;
}

const setMarkerEffect = StateEffect.define<SetMarkerSpec>();
const clearGutterEffect = StateEffect.define<GutterName>();

function createGutter(name: GutterName): { field: StateField<RangeSet<ElementMarker>>; extension: Extension } {
  const field = StateField.define<RangeSet<ElementMarker>>({
    create() {
      return RangeSet.empty;
    },
    update(markers, tr) {
      markers = markers.map(tr.changes);
      for (const effect of tr.effects) {
        if (effect.is(clearGutterEffect) && effect.value === name) {
          markers = RangeSet.empty;
        } else if (effect.is(setMarkerEffect) && effect.value.gutter === name) {
          const { line, element } = effect.value;
          if (line < 0 || line >= tr.state.doc.lines) continue;
          const pos = tr.state.doc.line(line + 1).from;
          markers = markers.update({ filter: (from) => from !== pos });
          if (element) {
            markers = markers.update({ add: [new ElementMarker(element).range(pos)] });
          }
        }
      }
      return markers;
    },
  });
  const extension = [
    field,
    gutter({
      class: `cm-gutter-${name} CodeMirror-${name}`,
      markers: (view) => view.state.field(field),
      initialSpacer: () => new ElementMarker(spacerElement()),
    }),
  ];
  return { field, extension };
}

function spacerElement() {
  const el = document.createElement("span");
  el.className = "cm-gutter-spacer";
  el.textContent = "\u00a0";
  return el;
}

// Fields are defined once so that they are shared between all editor instances
const gutterFields = new Map<GutterName, StateField<RangeSet<ElementMarker>>>();
const gutterExtensions: Extension[] = [];
for (const name of GUTTER_NAMES) {
  const { field, extension } = createGutter(name);
  gutterFields.set(name, field);
  gutterExtensions.push(extension);
}

/** Extension enabling the yasqe marker gutters */
export function markerGutters(): Extension {
  return gutterExtensions;
}

/** Set (or remove when `element` is null) the marker of `line` (0-based) in the given gutter */
export function setGutterMarker(view: EditorView, line: number, name: GutterName, element: HTMLElement | null) {
  view.dispatch({ effects: setMarkerEffect.of({ gutter: name, line, element }) });
}

/** Remove all markers from the given gutter */
export function clearGutter(view: EditorView, name: GutterName) {
  view.dispatch({ effects: clearGutterEffect.of(name) });
}

/** Returns the marker elements of the gutter, keyed by 0-based line number */
export function getGutterMarkers(state: EditorState, name: GutterName): Map<number, HTMLElement> {
  const result = new Map<number, HTMLElement>();
  const field = gutterFields.get(name);
  if (!field) return result;
  const set = state.field(field, false);
  if (!set) return result;
  const iter = set.iter();
  while (iter.value) {
    result.set(state.doc.lineAt(iter.from).number - 1, iter.value.element);
    iter.next();
  }
  return result;
}
