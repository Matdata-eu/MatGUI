/**
 * `EditorFacade` wraps a CodeMirror 6 `EditorView` and exposes a CodeMirror 5 flavoured API
 * (getValue/setValue, getDoc(), getTokenAt(), setOption(), gutter markers, events, ...).
 *
 * YASQE (and YASGUI) were written against CodeMirror 5. Keeping this compatibility surface
 * means the rest of the code base — autocompleters, prefix utilities, tab management —
 * keeps working without invasive rewrites, while the actual editor is CodeMirror 6.
 */
import { Compartment, EditorState, Extension, StateEffect } from "@codemirror/state";
import {
  EditorView,
  ViewUpdate,
  lineNumbers as lineNumbersExt,
  drawSelection,
  highlightActiveLine,
  highlightActiveLineGutter,
  rectangularSelection,
  crosshairCursor,
  dropCursor,
} from "@codemirror/view";
import { history, indentMore, indentLess, selectAll, deleteLine, undo, redo } from "@codemirror/commands";
import { bracketMatching, indentUnit as indentUnitFacet, getIndentation, indentString } from "@codemirror/language";
import { closeBrackets } from "@codemirror/autocomplete";
import { highlightSelectionMatches } from "@codemirror/search";
import { sparql } from "./language";
import { sparqlFolding, foldAt, toggleFoldAt } from "./folding";
import { markerGutters, setGutterMarker, clearGutter, GutterName } from "./gutters";
import { TokenizerRunner, Token, Position } from "./tokenizerRunner";
import { extraKeysExtension, tabKeymap, defaultKeymaps, ExtraKeys } from "./keymap";
import { sparqlAutocompletion, AutocompletionHost, HintFn } from "./autocompletion";
import { DocFacade, posToOffset, offsetToPos } from "./doc";

/**
 * Editor related configuration. Mirrors the subset of CodeMirror 5's `EditorConfiguration`
 * that YASQE historically supported.
 */
export interface EditorOptions {
  mode?: string;
  value?: string;
  lineNumbers?: boolean;
  lineWrapping?: boolean;
  readOnly?: boolean;
  tabSize?: number;
  indentUnit?: number;
  indentWithTabs?: boolean;
  theme?: string;
  extraKeys?: ExtraKeys<any>;
  tabMode?: string;
  foldGutter?: boolean | object;
  gutters?: string[];
  matchBrackets?: boolean;
  highlightSelectionMatches?: boolean | object;
  autoCloseBrackets?: boolean;
  fixedGutter?: boolean;
  placeholder?: string;
  /** Kept for backwards compatibility; ignored */
  autofocus?: boolean;
  /** Kept for backwards compatibility; ignored */
  viewportMargin?: number;
}

export type EventHandler = (...args: any[]) => void;

export interface CursorCoords {
  left: number;
  top: number;
  bottom: number;
}

const THEME_CLASS_PREFIX = "cm-s-";

/**
 * Classes applied to the editor root. CM6 owns `view.dom.className` and rewrites it whenever its computed
 * attributes change (e.g. focus), so these must go through `EditorView.editorAttributes` rather than classList.
 * `CodeMirror` is kept as a legacy hook for existing styling / tests.
 */
function themeClassExtension(theme: string | undefined): Extension {
  const classes = ["CodeMirror"];
  if (theme) {
    for (const t of theme.split(/\s+/)) {
      if (t) classes.push(THEME_CLASS_PREFIX + t);
    }
  }
  return EditorView.editorAttributes.of({ class: classes.join(" ") });
}

export abstract class EditorFacade {
  public readonly view: EditorView;
  public readonly runner: TokenizerRunner;
  protected readonly editorOptions: EditorOptions;
  private readonly doc: DocFacade;
  private readonly eventHandlers: { [event: string]: EventHandler[] } = {};
  private readonly customOptions: { [key: string]: any } = {};

  private readonly compartments = {
    theme: new Compartment(),
    readOnly: new Compartment(),
    lineNumbers: new Compartment(),
    lineWrapping: new Compartment(),
    tabSize: new Compartment(),
    indentUnit: new Compartment(),
    extraKeys: new Compartment(),
    tabMode: new Compartment(),
    matchBrackets: new Compartment(),
    highlightSelectionMatches: new Compartment(),
    autoCloseBrackets: new Compartment(),
  };

  /**
   * @param parent    element the editor is appended to
   * @param options   editor options
   */
  constructor(parent: HTMLElement, options: EditorOptions) {
    this.editorOptions = { ...options };
    this.runner = new TokenizerRunner({ tabSize: options.tabSize, indentUnit: options.indentUnit });

    const host: AutocompletionHost = {
      getHintFn: () => this.getHintFn(),
      onShown: (dom) => this.emit("autocompletionShown", dom),
      onClose: () => this.emit("autocompletionClose"),
    };

    const state = EditorState.create({
      doc: options.value || "",
      extensions: [
        sparql(),
        sparqlFolding(this.runner),
        markerGutters(),
        this.compartments.lineNumbers.of(
          options.lineNumbers === false ? [] : [lineNumbersExt(), highlightActiveLineGutter()],
        ),
        this.compartments.lineWrapping.of(options.lineWrapping === false ? [] : EditorView.lineWrapping),
        this.compartments.readOnly.of([
          EditorState.readOnly.of(!!options.readOnly),
          EditorView.editable.of(!options.readOnly),
        ]),
        this.compartments.tabSize.of(EditorState.tabSize.of(options.tabSize || 4)),
        this.compartments.indentUnit.of(indentUnitFacet.of(indentUnitString(options))),
        this.compartments.theme.of(themeClassExtension(options.theme)),
        this.compartments.matchBrackets.of(options.matchBrackets === false ? [] : bracketMatching()),
        this.compartments.highlightSelectionMatches.of(
          options.highlightSelectionMatches ? highlightSelectionMatches() : [],
        ),
        this.compartments.autoCloseBrackets.of(options.autoCloseBrackets ? closeBrackets() : []),
        history(),
        drawSelection(),
        dropCursor(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        EditorState.allowMultipleSelections.of(true),
        sparqlAutocompletion(host),
        this.compartments.extraKeys.of(extraKeysExtension(options.extraKeys, () => this)),
        this.compartments.tabMode.of(tabKeymap(options.tabMode)),
        defaultKeymaps(),
        EditorView.updateListener.of((update) => this.handleUpdate(update)),
        EditorView.domEventHandlers({
          blur: () => {
            this.emit("blur");
          },
          focus: () => {
            this.emit("focus");
          },
        }),
      ],
    });
    this.view = new EditorView({ state, parent });
    // Legacy back-reference (CM5 exposed `wrapper.CodeMirror`); used by Yasgui theme management
    (this.view.dom as any).CodeMirror = this;
    this.doc = new DocFacade(this.view);
    this.customOptions.theme = options.theme;
    if (options.mode) this.customOptions.mode = options.mode;
  }

  /** Returns the hint function for the current completion session. Implemented by Yasqe. */
  protected abstract getHintFn(): HintFn | undefined;

  private handleUpdate(update: ViewUpdate) {
    if (update.docChanged) {
      let fromLine = Number.MAX_SAFE_INTEGER;
      update.changes.iterChangedRanges((fromA) => {
        const line = update.startState.doc.lineAt(fromA).number - 1;
        if (line < fromLine) fromLine = line;
      });
      this.runner.invalidate(fromLine === Number.MAX_SAFE_INTEGER ? 0 : fromLine);
      this.emit("change", { origin: "input" });
      this.emit("changes");
    }
    if (update.selectionSet || update.docChanged) {
      this.emit("cursorActivity");
    }
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */

  public on(eventName: string, handler: EventHandler): void {
    if (!this.eventHandlers[eventName]) this.eventHandlers[eventName] = [];
    this.eventHandlers[eventName].push(handler);
  }

  public off(eventName: string, handler: EventHandler): void {
    const handlers = this.eventHandlers[eventName];
    if (!handlers) return;
    this.eventHandlers[eventName] = handlers.filter((h) => h !== handler);
  }

  /** Emits an event. Handlers are invoked with `(this, ...data)` like CodeMirror 5 did. */
  public emit(eventName: string, ...data: any[]): void {
    const handlers = this.eventHandlers[eventName];
    if (!handlers || !handlers.length) return;
    for (const handler of handlers.slice()) {
      handler(this, ...data);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Document                                                            */
  /* ------------------------------------------------------------------ */

  public getDoc(): DocFacade {
    return this.doc;
  }

  public getValue(): string {
    return this.doc.getValue();
  }

  public setValue(value: string) {
    this.doc.setValue(value);
  }

  public getLine(line: number) {
    return this.doc.getLine(line);
  }

  public lineCount() {
    return this.doc.lineCount();
  }

  public lastLine() {
    return this.doc.lastLine();
  }

  public getCursor(start?: "from" | "to" | "head" | "anchor" | "start" | "end") {
    return this.doc.getCursor(start);
  }

  public setCursor(pos: Position | number, ch?: number) {
    this.doc.setCursor(pos, ch);
  }

  public setSelection(anchor: Position, head?: Position) {
    this.doc.setSelection(anchor, head);
  }

  public somethingSelected() {
    return this.doc.somethingSelected();
  }

  public getSelection() {
    return this.doc.getSelection();
  }

  public replaceSelection(text: string, collapse?: "around" | "start" | "end") {
    this.doc.replaceSelection(text, collapse);
  }

  public getRange(from: Position, to: Position) {
    return this.doc.getRange(from, to);
  }

  public replaceRange(text: string, from: Position, to?: Position) {
    this.doc.replaceRange(text, from, to);
  }

  public indexFromPos(pos: Position) {
    return this.doc.indexFromPos(pos);
  }

  public posFromIndex(index: number) {
    return this.doc.posFromIndex(index);
  }

  /**
   * CM5 compatibility: batch operations. CodeMirror 6 already batches DOM updates,
   * so the callback is simply executed.
   */
  public operation<T>(fn: () => T): T {
    return fn();
  }

  /* ------------------------------------------------------------------ */
  /* Tokens                                                              */
  /* ------------------------------------------------------------------ */

  public getTokenAt(pos: Position, precise = false): Token {
    return this.runner.getTokenAt(this.view.state.doc, pos, precise);
  }

  public getTokenTypeAt(pos: Position): string | null {
    return this.runner.getTokenTypeAt(this.view.state.doc, pos);
  }

  /* ------------------------------------------------------------------ */
  /* Options                                                             */
  /* ------------------------------------------------------------------ */

  public getOption(name: string): any {
    if (name in this.customOptions) return this.customOptions[name];
    return (this.editorOptions as any)[name];
  }

  public setOption(name: string, value: any) {
    (this.editorOptions as any)[name] = value;
    switch (name) {
      case "theme":
        this.setTheme(value);
        break;
      case "readOnly": {
        const readOnly = !!value && value !== "nocursor" ? true : !!value;
        this.view.dispatch({
          effects: this.compartments.readOnly.reconfigure([
            EditorState.readOnly.of(readOnly),
            EditorView.editable.of(!readOnly),
          ]),
        });
        break;
      }
      case "lineNumbers":
        this.view.dispatch({
          effects: this.compartments.lineNumbers.reconfigure(
            value ? [lineNumbersExt(), highlightActiveLineGutter()] : [],
          ),
        });
        break;
      case "lineWrapping":
        this.view.dispatch({
          effects: this.compartments.lineWrapping.reconfigure(value ? EditorView.lineWrapping : []),
        });
        break;
      case "tabSize":
        this.view.dispatch({ effects: this.compartments.tabSize.reconfigure(EditorState.tabSize.of(value || 4)) });
        break;
      case "indentUnit":
      case "indentWithTabs":
        this.view.dispatch({
          effects: this.compartments.indentUnit.reconfigure(indentUnitFacet.of(indentUnitString(this.editorOptions))),
        });
        break;
      case "extraKeys":
        this.view.dispatch({
          effects: this.compartments.extraKeys.reconfigure(extraKeysExtension(value, () => this)),
        });
        break;
      case "tabMode":
        this.view.dispatch({ effects: this.compartments.tabMode.reconfigure(tabKeymap(value)) });
        break;
      case "matchBrackets":
        this.view.dispatch({ effects: this.compartments.matchBrackets.reconfigure(value ? bracketMatching() : []) });
        break;
      case "highlightSelectionMatches":
        this.view.dispatch({
          effects: this.compartments.highlightSelectionMatches.reconfigure(value ? highlightSelectionMatches() : []),
        });
        break;
      case "autoCloseBrackets":
        this.view.dispatch({ effects: this.compartments.autoCloseBrackets.reconfigure(value ? closeBrackets() : []) });
        break;
      default:
        this.customOptions[name] = value;
    }
  }

  private setTheme(theme: string | undefined) {
    this.view.dispatch({ effects: this.compartments.theme.reconfigure(themeClassExtension(theme)) });
    this.customOptions.theme = theme;
  }

  /* ------------------------------------------------------------------ */
  /* Gutters                                                             */
  /* ------------------------------------------------------------------ */

  public setGutterMarker(line: number, gutterName: GutterName, element: HTMLElement | null) {
    setGutterMarker(this.view, line, gutterName, element);
  }

  public clearGutter(gutterName: GutterName) {
    clearGutter(this.view, gutterName);
  }

  /* ------------------------------------------------------------------ */
  /* Commands / editing helpers                                          */
  /* ------------------------------------------------------------------ */

  public execCommand(command: string): void {
    switch (command) {
      case "selectAll":
        selectAll(this.view);
        break;
      case "indentMore":
        indentMore(this.view);
        break;
      case "indentLess":
        indentLess(this.view);
        break;
      case "deleteLine":
        deleteLine(this.view);
        break;
      case "undo":
        undo(this.view);
        break;
      case "redo":
        redo(this.view);
        break;
      default:
        // eslint-disable-next-line no-console
        console.warn(`Unknown editor command: ${command}`);
    }
  }

  /**
   * Re-indents the given (0-based) line using the language's indentation rules
   * (CM5 `indentLine(line, "smart")`).
   */
  public indentLine(lineNumber: number) {
    const line = this.view.state.doc.line(lineNumber + 1);
    const indentation = getIndentation(this.view.state, line.from);
    if (indentation === null) return;
    const currentWs = /^\s*/.exec(line.text)?.[0] || "";
    const newWs = indentString(this.view.state, indentation);
    if (currentWs === newWs) return;
    this.view.dispatch({ changes: { from: line.from, to: line.from + currentWs.length, insert: newWs } });
  }

  /** Fold the block starting on the given line. */
  public foldCode(line: number | Position) {
    const pos = typeof line === "number" ? { line, ch: 0 } : line;
    foldAt(this.view, posToOffset(this.view.state.doc, pos));
  }

  /** Toggle folding of the block starting on the given line. */
  public toggleFold(line: number | Position) {
    const pos = typeof line === "number" ? { line, ch: 0 } : line;
    toggleFoldAt(this.view, posToOffset(this.view.state.doc, pos));
  }

  /* ------------------------------------------------------------------ */
  /* DOM / layout                                                        */
  /* ------------------------------------------------------------------ */

  public getWrapperElement(): HTMLElement {
    return this.view.dom;
  }

  public getInputField(): HTMLElement {
    return this.view.contentDOM;
  }

  public getScrollerElement(): HTMLElement {
    return this.view.scrollDOM;
  }

  public focus() {
    this.view.focus();
  }

  public hasFocus() {
    return this.view.hasFocus;
  }

  public refresh() {
    this.view.requestMeasure();
  }

  public setSize(width: number | string | null, height: number | string | null) {
    const toCss = (v: number | string) => (typeof v === "number" ? `${v}px` : v);
    if (width !== null && width !== undefined) this.view.dom.style.width = toCss(width);
    if (height !== null && height !== undefined) this.view.dom.style.height = toCss(height);
    this.view.requestMeasure();
  }

  /** Coordinates of a position, relative to the page (CM5 `cursorCoords(where, "page")`). */
  public cursorCoords(where?: Position | boolean): CursorCoords {
    const pos =
      where && typeof where === "object"
        ? posToOffset(this.view.state.doc, where)
        : where === false
          ? this.view.state.selection.main.anchor
          : this.view.state.selection.main.head;
    const rect = this.view.coordsAtPos(pos);
    if (!rect) {
      const domRect = this.view.dom.getBoundingClientRect();
      return { left: domRect.left, top: domRect.top, bottom: domRect.top };
    }
    return { left: rect.left, top: rect.top, bottom: rect.bottom };
  }

  /** Position for page coordinates (CM5 `coordsChar`). */
  public coordsChar(coords: { left: number; top: number }): Position {
    const offset = this.view.posAtCoords({ x: coords.left, y: coords.top });
    return offsetToPos(this.view.state.doc, offset === null ? this.view.state.doc.length : offset);
  }

  /** Adds an extension at runtime (e.g. by plugins). */
  public addExtension(extension: Extension) {
    this.view.dispatch({ effects: StateEffect.appendConfig.of(extension) });
  }

  /** Destroys the editor view. */
  public destroyEditor() {
    this.view.destroy();
  }
}

/** Compute the indent unit string from the options (CM5 `indentUnit` + `indentWithTabs`). */
function indentUnitString(options: EditorOptions) {
  if (options.indentWithTabs) return "\t";
  return " ".repeat(options.indentUnit || 2);
}
