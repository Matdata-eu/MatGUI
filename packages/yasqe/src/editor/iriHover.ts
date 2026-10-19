/**
 * Hover tooltip for IRIs and prefixed names in the editor. Yasqe only finds the IRI under the mouse and
 * positions the tooltip; the content comes from the `iriHover` config function (Yasgui fetches a label,
 * description and type from the endpoint of the tab).
 */
import { hoverTooltip } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import type Yasqe from "../";

/** An IRI in the query: a full `<IRI>` or a prefixed name, with its location in the document. */
export interface IriAtPosition {
  /** The full IRI. For a prefixed name whose prefix is not declared, this is the prefixed name itself. */
  iri: string;
  /** The IRI as written in the query, e.g. `<http://...>` or `rdfs:label` */
  text: string;
  /** False for a prefixed name whose prefix is not declared in the query */
  expanded: boolean;
  line: number;
  start: number;
  end: number;
}

/**
 * Returns the tooltip content for the IRI, or nothing to show no tooltip. The content may change later (e.g. when
 * fetched information arrives): the editor repositions the tooltip when its size changes.
 */
export type IriHoverFn = (yasqe: Yasqe, iri: IriAtPosition) => HTMLElement | null | undefined;

export function iriHover(yasqe: Yasqe, hoverTime: number): Extension {
  return hoverTooltip(
    (view, pos, side) => {
      const content = yasqe.config.iriHover;
      if (!content) return null;
      const line = view.state.doc.lineAt(pos);
      // `getTokenAt` returns the token that ends at or after `ch`, i.e. the one holding the character before it
      const ch = pos - line.from + (side > 0 ? 1 : 0);
      if (ch <= 0 || ch > line.length) return null;
      const iri = yasqe.getIriAt({ line: line.number - 1, ch });
      if (!iri) return null;
      const body = content(yasqe, iri);
      if (!body) return null;
      return {
        pos: line.from + iri.start,
        end: line.from + iri.end,
        above: false,
        create: () => {
          const dom = document.createElement("div");
          dom.className = "yasqe_iriHover";
          dom.appendChild(body);
          return { dom };
        },
      };
    },
    { hoverTime },
  );
}
