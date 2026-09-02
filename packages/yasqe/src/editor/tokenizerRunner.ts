/**
 * Runs the SPARQL stream tokenizer over a CodeMirror 6 document and exposes
 * CodeMirror 5 style token information (`getTokenAt`, `getTokenTypeAt`, `runMode`).
 *
 * CodeMirror 6 does not expose the stream-parser state of a `StreamLanguage`, but Yasqe relies
 * heavily on that state (possible next tokens for autocompletion, declared prefixes/variables,
 * syntax error information, query type detection, ...). This runner keeps a per-line cache of
 * tokenizer states so that repeated lookups stay cheap.
 */
import { StringStream, StreamParser } from "@codemirror/language";
import type { Text } from "@codemirror/state";
import { State as TokenizerState, copyState } from "../../grammar/tokenizer";
export type { TokenizerState };
import { createSparqlParser } from "./language";

/** CodeMirror 5 compatible token shape. `line` and `ch` are 0-based. */
export interface Token {
  start: number;
  end: number;
  string: string;
  type: string | null;
  state: TokenizerState;
}

export interface Position {
  line: number;
  ch: number;
}

export interface TokenizerRunnerOptions {
  tabSize?: number;
  indentUnit?: number;
}

export type RunModeCallback = (
  text: string,
  style: string | null,
  line: number,
  col: number,
  state: TokenizerState,
) => void;

export class TokenizerRunner {
  private parser: StreamParser<TokenizerState>;
  private tabSize: number;
  private indentUnit: number;
  /** Cached document the line states belong to */
  private cachedDoc: Text | undefined;
  /** State at the *start* of line `i` (0-based). Index 0 is always the start state. */
  private lineStartStates: (TokenizerState | undefined)[] = [];

  constructor(options: TokenizerRunnerOptions = {}) {
    this.tabSize = options.tabSize ?? 4;
    this.indentUnit = options.indentUnit ?? 2;
    this.parser = createSparqlParser({ indentUnit: this.indentUnit });
  }

  private startState(): TokenizerState {
    return this.parser.startState!(this.indentUnit);
  }

  /**
   * Drop all cached line states from `fromLine` (0-based) onwards. Call this when the document
   * changed. Passing no argument clears the whole cache.
   */
  public invalidate(fromLine = 0) {
    if (fromLine <= 0) {
      this.lineStartStates = [];
      this.cachedDoc = undefined;
    } else {
      this.lineStartStates.length = Math.min(this.lineStartStates.length, fromLine);
    }
  }

  /**
   * Make sure the cache is bound to `doc`. Because `Text` is immutable, a different document
   * reference means the cache must be (partially) rebuilt. The caller is responsible for
   * calling `invalidate(fromLine)` on edits; if that did not happen we play safe and reset.
   */
  private bindDoc(doc: Text) {
    if (this.cachedDoc !== doc) {
      if (this.lineStartStates.length > doc.lines) this.lineStartStates.length = doc.lines;
      this.cachedDoc = doc;
    }
  }

  /** Run the tokenizer over a single line, mutating `state`. Optionally stop before `stopAt` (ch). */
  private tokenizeLine(
    lineText: string,
    state: TokenizerState,
    onToken?: (start: number, end: number, style: string | null) => void,
    stopAt?: number,
  ) {
    const stream = new StringStream(lineText, this.tabSize, this.indentUnit);
    if (lineText.length === 0) {
      if (this.parser.blankLine) this.parser.blankLine(state, this.indentUnit);
      return stream;
    }
    while (!stream.eol()) {
      if (stopAt !== undefined && stream.pos >= stopAt) break;
      stream.start = stream.pos;
      const style = this.parser.token(stream, state);
      if (stream.pos <= stream.start) {
        // Guard against a tokenizer that did not advance (would loop forever)
        stream.pos = stream.start + 1;
      }
      if (onToken) onToken(stream.start, stream.pos, style);
    }
    return stream;
  }

  /** Returns a *copy* of the tokenizer state at the start of `line` (0-based). */
  public getStateBefore(doc: Text, line: number, precise = false): TokenizerState {
    if (precise) this.invalidate();
    this.bindDoc(doc);
    if (line < 0) line = 0;
    if (line > doc.lines) line = doc.lines;
    if (!this.lineStartStates[0]) this.lineStartStates[0] = this.startState();

    // Find the closest cached state before `line`
    let from = Math.min(line, this.lineStartStates.length - 1);
    while (from > 0 && !this.lineStartStates[from]) from--;
    let state = copyState(this.lineStartStates[from]!);
    for (let l = from; l < line; l++) {
      this.tokenizeLine(doc.line(l + 1).text, state);
      this.lineStartStates[l + 1] = copyState(state);
    }
    return state;
  }

  /** Returns the tokenizer state after the last line of the document. */
  public getFinalState(doc: Text, precise = false): TokenizerState {
    const lastLine = doc.lines - 1;
    const state = this.getStateBefore(doc, lastLine, precise);
    this.tokenizeLine(doc.line(lastLine + 1).text, state);
    return state;
  }

  /**
   * CodeMirror 5 compatible `getTokenAt`. Returns the token that ends at or after `pos.ch`
   * together with the tokenizer state *after* that token.
   */
  public getTokenAt(doc: Text, pos: Position, precise = false): Token {
    const line = Math.max(0, Math.min(pos.line, doc.lines - 1));
    const lineText = doc.line(line + 1).text;
    const ch = Math.max(0, Math.min(pos.ch, lineText.length));
    const state = this.getStateBefore(doc, line, precise);

    let start = 0;
    let end = 0;
    let type: string | null = null;
    if (lineText.length > 0 && ch > 0) {
      this.tokenizeLine(
        lineText,
        state,
        (s, e, style) => {
          start = s;
          end = e;
          type = style;
        },
        ch,
      );
    }
    return { start, end, string: lineText.slice(start, end), type, state };
  }

  /** CodeMirror 5 compatible `getTokenTypeAt` */
  public getTokenTypeAt(doc: Text, pos: Position): string | null {
    return this.getTokenAt(doc, pos).type;
  }

  /**
   * CodeMirror 5 `runMode` equivalent: tokenizes `text` from scratch and invokes `callback`
   * for every token (including newlines, reported with style `null`).
   */
  public runMode(text: string, callback: RunModeCallback): TokenizerState {
    const lines = text.split(/\r?\n/);
    const state = this.startState();
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      this.tokenizeLine(lineText, state, (start, end, style) => {
        callback(lineText.slice(start, end), style, i, start, state);
      });
      if (i < lines.length - 1) callback("\n", null, i, lineText.length, state);
    }
    return state;
  }
}

/** Shared runner used for stateless operations on arbitrary text. */
const defaultRunner = new TokenizerRunner();

/**
 * Tokenize arbitrary SPARQL text (independent of any editor instance).
 */
export function runMode(text: string, callback: RunModeCallback): TokenizerState {
  return defaultRunner.runMode(text, callback);
}
