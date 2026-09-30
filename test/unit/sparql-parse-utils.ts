import { StringStream } from "@codemirror/language";

import sparqlTokenizer, { State } from "../../packages/yasqe/grammar/tokenizer.js";

export interface ParseResult {
  /** No syntax error was detected (this is what Yasqe shows as valid/invalid) */
  ok: boolean;
  /** The query may end here */
  complete: boolean;
  /** 1-based line of the first syntax error */
  errorLine?: number;
  errorMsg?: string;
  state: State;
}

/** Runs the Yasqe tokenizer over a query, line by line, the same way the editor does */
export function parse(query: string): ParseResult {
  const parser = sparqlTokenizer();
  const state = parser.startState!(2);
  const lines = query.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const stream = new StringStream(lines[i], 4, 2);
    while (!stream.eol()) {
      stream.start = stream.pos;
      parser.token(stream, state);
      if (stream.pos <= stream.start) stream.pos = stream.start + 1;
    }
    if (!state.OK) return { ok: false, complete: false, errorLine: i + 1, errorMsg: state.errorMsg, state };
  }
  return { ok: state.OK, complete: state.complete, state };
}

/** Returns the [text, style] pairs of all non-whitespace tokens */
export function tokenStyles(query: string): Array<[string, string]> {
  const parser = sparqlTokenizer();
  const state = parser.startState!(2);
  const result: Array<[string, string]> = [];
  for (const line of query.split(/\r?\n/)) {
    const stream = new StringStream(line, 4, 2);
    while (!stream.eol()) {
      stream.start = stream.pos;
      const style = parser.token(stream, state) || "";
      if (style !== "ws") result.push([line.slice(stream.start, stream.pos), style]);
    }
  }
  return result;
}
