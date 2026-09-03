/**
 * Marker gutters replacing the CodeMirror 5 `setGutterMarker` / `clearGutter` API.
 *
 * Two logical marker types are supported: `gutterErrorBar` (syntax errors) and
 * `gutterConstructWarning` (undefined variables in CONSTRUCT templates). Both are rendered
 * in one physical gutter lane to keep gutter width minimal.
 */
import { EditorState, StateEffect, StateField, RangeSet, Extension } from "@codemirror/state";
import { EditorView, gutter, GutterMarker } from "@codemirror/view";

export type GutterName = "gutterErrorBar" | "gutterConstructWarning";
export const GUTTER_NAMES: GutterName[] = ["gutterErrorBar", "gutterConstructWarning"];
const RENDER_GUTTER_NAME: GutterName = "gutterErrorBar";

class ElementMarker extends GutterMarker {
  constructor(readonly element: HTMLElement) {
    super();
  }
  eq(other: ElementMarker) {
    return other.element === this.element;
  }
  toDOM() {
    // Return a fresh clone on every render. CodeMirror 6 owns (and may move/recreate) the node
    // it gets from `toDOM`; handing out the same shared element across gutter re-renders detaches
    // it from a previous gutter element, which later crashes with `nextSibling` of null.
    const clone = this.element.cloneNode(true) as HTMLElement;
    clone.onmouseover = this.element.onmouseover;
    clone.onmouseout = this.element.onmouseout;
    return clone;
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

function createMarkerField(name: GutterName): StateField<RangeSet<ElementMarker>> {
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
  return field;
}

function spacerElement() {
  const el = document.createElement("span");
  el.className = "cm-gutter-spacer";
  el.textContent = "\u00a0";
  return el;
}

function mergeMarkersWithErrorPriority(
  errorMarkers: RangeSet<ElementMarker>,
  warningMarkers: RangeSet<ElementMarker>,
): RangeSet<ElementMarker> {
  const byPos = new Map<number, ElementMarker>();

  const warningIter = warningMarkers.iter();
  while (warningIter.value) {
    byPos.set(warningIter.from, warningIter.value);
    warningIter.next();
  }

  // Errors overwrite warnings on the same line.
  const errorIter = errorMarkers.iter();
  while (errorIter.value) {
    byPos.set(errorIter.from, errorIter.value);
    errorIter.next();
  }

  const ranges: ReturnType<ElementMarker["range"]>[] = [];
  const sortedPos = Array.from(byPos.keys()).sort((a, b) => a - b);
  for (const pos of sortedPos) {
    const marker = byPos.get(pos);
    if (marker) ranges.push(marker.range(pos));
  }
  return RangeSet.of(ranges, true);
}

// Fields are defined once so that they are shared between all editor instances.
const gutterFields = new Map<GutterName, StateField<RangeSet<ElementMarker>>>();
for (const name of GUTTER_NAMES) {
  gutterFields.set(name, createMarkerField(name));
}

const gutterExtensions: Extension[] = [
  gutterFields.get("gutterErrorBar")!,
  gutterFields.get("gutterConstructWarning")!,
  gutter({
    class: `cm-gutter-${RENDER_GUTTER_NAME} CodeMirror-${RENDER_GUTTER_NAME}`,
    markers: (view) =>
      mergeMarkersWithErrorPriority(
        view.state.field(gutterFields.get("gutterErrorBar")!),
        view.state.field(gutterFields.get("gutterConstructWarning")!),
      ),
    initialSpacer: () => new ElementMarker(spacerElement()),
  }),
];

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
