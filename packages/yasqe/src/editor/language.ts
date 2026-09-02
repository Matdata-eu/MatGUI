/**
 * CodeMirror 6 language definition for SPARQL 1.1, built on top of the
 * legacy (stream based) LL(1) tokenizer in ../../grammar/tokenizer.ts.
 *
 * Every token style emitted by the tokenizer gets its own lezer Tag and a
 * matching `cm-<style>` CSS class so the existing style sheets keep working.
 */
import { StreamLanguage, HighlightStyle, syntaxHighlighting, LanguageSupport } from "@codemirror/language";
import { Tag } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";
import sparqlTokenizer, {
  TOKEN_STYLES,
  TokenStyle,
  State as TokenizerState,
  TokenizerConfig,
} from "../../grammar/tokenizer";

export type { TokenizerState };

export const sparqlTags: Record<TokenStyle, Tag> = TOKEN_STYLES.reduce(
  (acc, style) => {
    acc[style] = Tag.define();
    return acc;
  },
  {} as Record<TokenStyle, Tag>,
);

export function createSparqlParser(config: TokenizerConfig = {}) {
  const parser = sparqlTokenizer(config);
  parser.tokenTable = sparqlTags;
  return parser;
}

export const sparqlLanguage = StreamLanguage.define<TokenizerState>(createSparqlParser());

/**
 * Highlight style mapping each SPARQL token tag to the classic CodeMirror 5 class name (`cm-keyword`, `cm-atom`, ...).
 */
export const sparqlHighlightStyle = HighlightStyle.define(
  TOKEN_STYLES.map((style) => ({ tag: sparqlTags[style], class: `cm-${style}` })),
);

export function sparql(): LanguageSupport {
  return new LanguageSupport(sparqlLanguage, [syntaxHighlighting(sparqlHighlightStyle)]);
}

export const sparqlExtensions = (): Extension => sparql();
