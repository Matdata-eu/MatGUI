import * as Autocompleter from "./";
import { bundledLovTerms, searchLov } from "./lov";
import type { Token } from "../";

/**
 * The complete token can span the expression before the function name, e.g. "BIND(fx:ent": keeps the part after the
 * last opening parenthesis, comma or operator.
 */
function trimToFunctionName(token: Token): Autocompleter.AutocompletionToken {
  const match = /[\s(),!=&|*+]([^\s(),!=&|*+]*)$/.exec(token.string);
  if (!match) return token;
  const start = token.end - match[1].length;
  // `from` makes the suggestion replace the function name only
  return { ...token, start, string: match[1], from: { ch: start } };
}

/**
 * Suggests the functions of the bundled vocabularies (see the `lovTerms` config option), such as the SPARQL Anything
 * functions fx:entity or fx:String.substring, where an expression can start: in FILTER, BIND, SELECT expressions...
 */
var conf: Autocompleter.CompleterConfig = {
  get: function (yasqe, token) {
    if (!token) return [];
    const lovTerms = yasqe.config.lovTerms === undefined ? bundledLovTerms : yasqe.config.lovTerms;
    if (!lovTerms) return [];
    return searchLov(lovTerms, "function", token).map((term) =>
      Autocompleter.endpointTermToSuggestion(yasqe, token, term, Autocompleter.FUNCTION_SECTION),
    );
  },
  isValidCompletionPosition: function (yasqe) {
    const token = trimToFunctionName(yasqe.getCompleteToken());
    if (token.string.length == 0) return false; //we want -something- to autocomplete
    if (token.string[0] === "?" || token.string[0] === "$") return false; // we are typing a var
    // An expression can start here: a built-in call such as STR(...) is allowed
    return token.state.possibleCurrent.indexOf("STR") >= 0;
  },
  preProcessToken: function (yasqe, token) {
    return Autocompleter.preprocessIriForCompletion(yasqe, trimToFunctionName(token));
  },
  postProcessSuggestion: function (yasqe, token, suggestedString) {
    return Autocompleter.postprocessIriCompletion(yasqe, token, suggestedString);
  },
  bulk: false,
  name: "function",
};

export default conf;
