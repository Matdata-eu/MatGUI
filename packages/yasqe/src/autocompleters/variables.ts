import * as autocompleter from "./";
import { runMode } from "../editor/tokenizerRunner";

var conf: autocompleter.CompleterConfig = {
  name: "variables",
  isValidCompletionPosition: function (yasqe) {
    var token = yasqe.getTokenAt(yasqe.getDoc().getCursor());
    if (token.type != "ws") {
      token = yasqe.getCompleteToken(token);
      if (token && (token.string[0] === "?" || token.string[0] === "$")) {
        return true;
      }
    }
    return false;
  },
  get: function (yasqe, token) {
    if (!token || token.string.length == 0) return []; //nothing to autocomplete
    const distinctVars: { [varname: string]: any } = {};
    const vars: string[] = [];
    // Tokenize the whole query (independent of what is rendered in the viewport), collecting all
    // variable tokens. This still works when the query is syntactically incorrect (e.g. when simply typing '?').
    const atoms: string[] = [];
    runMode(yasqe.getValue(), (stringVal: string, style: string | null) => {
      if (style === "atom" && (stringVal[0] === "?" || stringVal[0] === "$")) {
        atoms.push(stringVal);
      }
    });
    for (const variable of atoms) {
      if (distinctVars[variable]) continue; //already in list
      //skip single questionmarks
      if (variable.length <= 1) continue;

      //it should match our token ofcourse
      if (variable.indexOf(token.string) !== 0) continue;

      //skip exact matches
      if (variable === token.string) continue;

      //store in map so we have a unique list
      distinctVars[variable] = true;
      vars.push(variable);
    }
    return vars.sort();
  },
  bulk: false,
  autoShow: true,
};
export default conf;
