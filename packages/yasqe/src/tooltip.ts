/**
 * Write our own tooltip, to avoid loading another library for just this functionality. For now, we only use tooltip for showing parse errors, so this is quite a tailored solution
 * Requirements:
 * 		position tooltip within codemirror frame as much as possible, to avoid z-index issues with external things on page
 * 		use html as content
 */
import Yasqe from "./";

export default function tooltip(_yasqe: Yasqe, parent: HTMLElement, html: string) {
  // Render the tooltip inside the yasqe root (so the scoped `.yasqe .yasqe_tooltip`
  // styles apply) but position it `fixed` relative to the icon. Fixed positioning
  // escapes the `overflow` clipping of the CodeMirror gutter/scroller, which would
  // otherwise hide the tooltip behind the editor.
  let tooltip: HTMLDivElement | undefined;
  parent.onmouseover = function (this: HTMLElement) {
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "yasqe_tooltip";
      _yasqe.rootEl.appendChild(tooltip);
    }
    tooltip.innerHTML = html;
    tooltip.style.display = "block";
    // `this` is the element the handler fires on. The gutter marker is rendered as a clone of
    // `parent`, so position relative to `this` rather than the (possibly detached) `parent`.
    const rect = this.getBoundingClientRect();
    tooltip.style.position = "fixed";
    tooltip.style.left = `${rect.right + 6}px`;
    tooltip.style.top = `${rect.top}px`;
    tooltip.style.zIndex = "10000";
  };
  parent.onmouseout = function () {
    if (tooltip) tooltip.style.display = "none";
  };
}
