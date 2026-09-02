/**
 * A small CodeMirror 5 `Doc`-compatible facade on top of a CodeMirror 6 `EditorView`.
 * Positions are `{line, ch}` and 0-based, like in CodeMirror 5.
 */
import { EditorSelection, Text } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { Position } from "./tokenizerRunner";

/**
 * Mirrors CodeMirror 5's `clipPos`: a line before the document clips to the document start, a line past the
 * end of the document clips to the end of the last line, and `ch` is clamped to the line length.
 */
export function posToOffset(doc: Text, pos: Position): number {
  if (pos.line < 0) return 0;
  if (pos.line >= doc.lines) return doc.length;
  const line = doc.line(pos.line + 1);
  return line.from + Math.max(0, Math.min(pos.ch, line.length));
}

export function offsetToPos(doc: Text, offset: number): Position {
  const clamped = Math.max(0, Math.min(offset, doc.length));
  const line = doc.lineAt(clamped);
  return { line: line.number - 1, ch: clamped - line.from };
}

export interface Selection {
  anchor: Position;
  head: Position;
}

export class DocFacade {
  constructor(private view: EditorView) {}

  private get doc(): Text {
    return this.view.state.doc;
  }

  public getValue(separator = "\n"): string {
    return separator === "\n" ? this.doc.toString() : this.doc.toJSON().join(separator);
  }

  public setValue(value: string) {
    this.view.dispatch({
      changes: { from: 0, to: this.doc.length, insert: value },
    });
  }

  public getLine(n: number): string {
    if (n < 0 || n >= this.doc.lines) return "";
    return this.doc.line(n + 1).text;
  }

  public lineCount(): number {
    return this.doc.lines;
  }

  public firstLine(): number {
    return 0;
  }

  public lastLine(): number {
    return this.doc.lines - 1;
  }

  public indexFromPos(pos: Position): number {
    return posToOffset(this.doc, pos);
  }

  public posFromIndex(index: number): Position {
    return offsetToPos(this.doc, index);
  }

  public getCursor(start?: "from" | "to" | "head" | "anchor" | "start" | "end"): Position {
    const range = this.view.state.selection.main;
    let offset: number;
    switch (start) {
      case "from":
      case "start":
        offset = range.from;
        break;
      case "to":
      case "end":
        offset = range.to;
        break;
      case "anchor":
        offset = range.anchor;
        break;
      case "head":
      default:
        offset = range.head;
    }
    return offsetToPos(this.doc, offset);
  }

  public setCursor(pos: Position | number, ch?: number) {
    const position: Position = typeof pos === "number" ? { line: pos, ch: ch ?? 0 } : pos;
    const offset = posToOffset(this.doc, position);
    this.view.dispatch({ selection: { anchor: offset }, scrollIntoView: true });
  }

  public setSelection(anchor: Position, head?: Position) {
    const a = posToOffset(this.doc, anchor);
    const h = head ? posToOffset(this.doc, head) : a;
    this.view.dispatch({ selection: { anchor: a, head: h }, scrollIntoView: true });
  }

  public listSelections(): Selection[] {
    return this.view.state.selection.ranges.map((r) => ({
      anchor: offsetToPos(this.doc, r.anchor),
      head: offsetToPos(this.doc, r.head),
    }));
  }

  public somethingSelected(): boolean {
    return this.view.state.selection.ranges.some((r) => !r.empty);
  }

  public getSelection(lineSep = "\n"): string {
    return this.view.state.selection.ranges
      .filter((r) => !r.empty)
      .map((r) => this.doc.sliceString(r.from, r.to))
      .join(lineSep);
  }

  public replaceSelection(text: string, collapse: "around" | "start" | "end" = "end") {
    this.view.dispatch(
      this.view.state.changeByRange((range) => {
        const end = range.from + text.length;
        let sel: ReturnType<typeof EditorSelection.range>;
        if (collapse === "around") sel = EditorSelection.range(range.from, end);
        else if (collapse === "start") sel = EditorSelection.cursor(range.from);
        else sel = EditorSelection.cursor(end);
        return { changes: { from: range.from, to: range.to, insert: text }, range: sel };
      }),
    );
  }

  public getRange(from: Position, to: Position): string {
    return this.doc.sliceString(posToOffset(this.doc, from), posToOffset(this.doc, to));
  }

  public replaceRange(text: string, from: Position, to?: Position) {
    const f = posToOffset(this.doc, from);
    const t = to ? posToOffset(this.doc, to) : f;
    this.view.dispatch({ changes: { from: Math.min(f, t), to: Math.max(f, t), insert: text } });
  }

  public selectAll() {
    this.view.dispatch({ selection: { anchor: 0, head: this.doc.length } });
  }
}
