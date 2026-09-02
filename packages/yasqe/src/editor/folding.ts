/**
 * Code folding for SPARQL: folds bracket blocks (`{ ... }`) and the block of PREFIX declarations.
 *
 * Replaces the CodeMirror 5 combination of `fold.brace` and the custom `fold.prefix` helper.
 * Because the SPARQL grammar is a stream parser (no syntax tree with nesting), folding is
 * implemented as a `foldService` working on the tokenizer output.
 */
import { EditorState, Extension, Text } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { foldService, foldGutter, foldEffect, unfoldEffect, foldedRanges, foldable } from "@codemirror/language";
import { TokenizerRunner, Position } from "./tokenizerRunner";

export interface FoldRange {
  from: number;
  to: number;
}

const PREFIX_KEYWORD = "PREFIX ";

function tokenTypeAt(runner: TokenizerRunner, doc: Text, pos: Position) {
  return runner.getTokenAt(doc, pos).type;
}

/**
 * Finds the fold range for a block starting with a bracket on the given line. Mirrors the
 * CodeMirror 5 `brace` range finder: the *last* opening bracket on the line is used.
 */
export function braceFoldRange(runner: TokenizerRunner, doc: Text, line: number): FoldRange | undefined {
  const lineText = doc.line(line + 1).text;
  const pairs: { [open: string]: string } = { "{": "}", "[": "]", "(": ")" };
  let startCh = -1;
  let open = "";
  for (let ch = lineText.length - 1; ch >= 0; ch--) {
    const c = lineText[ch];
    if (pairs[c] && tokenTypeAt(runner, doc, { line, ch: ch + 1 }) === "punc") {
      startCh = ch;
      open = c;
      break;
    }
  }
  if (startCh < 0) return;
  const close = pairs[open];

  // Scan forward for the matching bracket, taking nesting into account and ignoring brackets inside strings/comments
  let depth = 1;
  const lastLine = doc.lines - 1;
  for (let l = line; l <= lastLine; l++) {
    const text = doc.line(l + 1).text;
    let ch = l === line ? startCh + 1 : 0;
    for (; ch < text.length; ch++) {
      const c = text[ch];
      if (c !== open && c !== close) continue;
      if (tokenTypeAt(runner, doc, { line: l, ch: ch + 1 }) !== "punc") continue;
      if (c === open) depth++;
      else if (--depth === 0) {
        if (l === line) return; // opening and closing bracket on the same line: nothing to fold
        return { from: doc.line(line + 1).from + startCh + 1, to: doc.line(l + 1).from + ch };
      }
    }
  }
  return;
}

/** Returns the char index of the first PREFIX keyword on the line (or undefined) */
export function findFirstPrefix(
  runner: TokenizerRunner,
  doc: Text,
  line: number,
  startFromCharIndex = 0,
): number | undefined {
  const lineText = doc.line(line + 1).text;
  if (!lineText) return undefined;
  const charIndex = lineText.toUpperCase().indexOf(PREFIX_KEYWORD, startFromCharIndex);
  if (charIndex >= 0 && tokenTypeAt(runner, doc, { line, ch: charIndex + 1 }) === "keyword") {
    return charIndex;
  }
  return undefined;
}

/** Returns the (0-based) line of the first PREFIX declaration in the document */
export function findFirstPrefixLine(runner: TokenizerRunner, doc: Text): number | undefined {
  for (let i = 0; i < doc.lines; i++) {
    const firstPrefix = findFirstPrefix(runner, doc, i);
    if (firstPrefix !== undefined && firstPrefix >= 0) return i;
  }
  return undefined;
}

/**
 * Fold range for the block of PREFIX declarations. Only the first PREFIX declaration of the query
 * starts a foldable block. Ported from the CodeMirror 5 `fold.prefix` helper.
 */
export function prefixFoldRange(runner: TokenizerRunner, doc: Text, line: number): FoldRange | undefined {
  // Only the opening prefix declaration is foldable
  for (let i = line - 1; i >= 0; i--) {
    if (
      doc
        .line(i + 1)
        .text.toUpperCase()
        .indexOf(PREFIX_KEYWORD) >= 0
    )
      return;
  }
  const prefixStart = findFirstPrefix(runner, doc, line);
  if (prefixStart === undefined) return;

  const getNextNonWsToken = (l: number, ch: number) => {
    let token = runner.getTokenAt(doc, { line: l, ch });
    if (token.end < ch) return undefined;
    while (token.type === "ws") {
      const next = runner.getTokenAt(doc, { line: l, ch: token.end + 1 });
      if (next.end < token.end + 1) return undefined;
      token = next;
    }
    return token;
  };
  const getLastPrefixPos = (l: number, ch: number): number => {
    const keyword = runner.getTokenAt(doc, { line: l, ch: ch + 1 });
    if (keyword.type !== "keyword") return -1;
    const shortname = getNextNonWsToken(l, keyword.end + 1);
    if (!shortname || shortname.type !== "string-2") return -1;
    const uri = getNextNonWsToken(l, shortname.end + 1);
    if (!uri || uri.type !== "variable-3") return -1;
    return uri.end;
  };

  let prefixEndChar = getLastPrefixPos(line, prefixStart);
  let prefixEndLine = line;
  let stopAtNextLine = false;
  for (let i = line; i < doc.lines; i++) {
    if (stopAtNextLine) break;
    const text = doc.line(i + 1).text;
    let pos = i === line ? prefixStart + 1 : 0;
    for (;;) {
      if (!stopAtNextLine && text.indexOf("{") >= 0) stopAtNextLine = true;
      const nextPrefixDeclaration = text.toUpperCase().indexOf(PREFIX_KEYWORD, pos);
      if (nextPrefixDeclaration < 0) break;
      const endCh = getLastPrefixPos(i, nextPrefixDeclaration);
      if (endCh > 0) {
        prefixEndChar = endCh;
        prefixEndLine = i;
        pos = prefixEndChar;
      }
      pos++;
    }
  }
  if (prefixEndChar < 0) return;
  const from = doc.line(line + 1).from + prefixStart + PREFIX_KEYWORD.length;
  const to = doc.line(prefixEndLine + 1).from + prefixEndChar;
  if (to <= from) return;
  return { from, to };
}

/** Combined range finder (brace first, then prefix block) for a given 0-based line */
export function foldRangeForLine(runner: TokenizerRunner, doc: Text, line: number): FoldRange | undefined {
  return braceFoldRange(runner, doc, line) || prefixFoldRange(runner, doc, line);
}

/** Folding extensions: fold service + fold gutter */
export function sparqlFolding(runner: TokenizerRunner): Extension {
  return [
    foldService.of((state: EditorState, lineStart: number) => {
      const line = state.doc.lineAt(lineStart).number - 1;
      return foldRangeForLine(runner, state.doc, line) || null;
    }),
    foldGutter({
      markerDOM(open) {
        const el = document.createElement("span");
        el.className = `cm-foldMarker CodeMirror-foldgutter-${open ? "open" : "folded"}`;
        el.title = open ? "Fold" : "Unfold";
        return el;
      },
    }),
  ];
}

/** Fold (or unfold, when already folded) the block starting at the given position. */
export function toggleFoldAt(view: EditorView, pos: number) {
  const line = view.state.doc.lineAt(pos);
  // Unfold when the line is (partly) hidden by a fold
  let unfolded = false;
  foldedRanges(view.state).between(line.from, line.to, (from, to) => {
    if (from >= line.from && from <= line.to) {
      view.dispatch({ effects: unfoldEffect.of({ from, to }) });
      unfolded = true;
      return false;
    }
    return;
  });
  if (unfolded) return;
  const range = foldable(view.state, line.from, line.to);
  if (range) view.dispatch({ effects: foldEffect.of(range) });
}

/** Fold the block starting at the given position (no-op if nothing foldable or already folded) */
export function foldAt(view: EditorView, pos: number) {
  const line = view.state.doc.lineAt(pos);
  let alreadyFolded = false;
  foldedRanges(view.state).between(line.from, line.to, () => {
    alreadyFolded = true;
    return false;
  });
  if (alreadyFolded) return;
  const range = foldable(view.state, line.from, line.to);
  if (range) view.dispatch({ effects: foldEffect.of(range) });
}

/** Unfold any fold that starts on the line of the given position (no-op if not folded) */
export function unfoldAt(view: EditorView, pos: number) {
  const line = view.state.doc.lineAt(pos);
  const effects: ReturnType<typeof unfoldEffect.of>[] = [];
  foldedRanges(view.state).between(line.from, line.to, (from, to) => {
    if (from >= line.from && from <= line.to) effects.push(unfoldEffect.of({ from, to }));
  });
  if (effects.length) view.dispatch({ effects });
}
