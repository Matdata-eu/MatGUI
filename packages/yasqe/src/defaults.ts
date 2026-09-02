/**
 * The default options of YASQE (check the CodeMirror documentation for even
 * more options, such as disabling line numbers, or changing keyboard shortcut
 * keys). Either change the default options by setting Yasqe.defaults, or by
 * passing your own options as second argument to the YASQE constructor
 */
import { default as Yasqe, Config, PlainRequestConfig } from "./";
import * as queryString from "query-string";
export default function get() {
  const prefixCcApi = null; // null = use bundled prefix data (packages/yasqe/src/prefixes.json, refreshed each build)
  const config: Omit<Config, "requestConfig"> = {
    mode: "sparql11",
    value: `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT * WHERE {
  ?sub ?pred ?obj .
} LIMIT 10`,
    highlightSelectionMatches: {
      showToken: /\w/,
    },
    tabMode: "indent",
    lineNumbers: true,
    lineWrapping: true,
    foldGutter: true, // Folding of braces and prefix blocks is handled by the built-in SPARQL fold service
    collapsePrefixesOnLoad: false,
    gutters: ["gutterErrorBar", "gutterConstructWarning"],
    matchBrackets: true,
    fixedGutter: true,
    syntaxErrorCheck: true,
    autocompleters: [],
    extraKeys: {
      /**
       * Need to use _yasqe:any as function parameter here. Otherwise ts will complain that we're not following
       * the codemirror config interface (that specifies the type should be codemirror-editor)
       */
      "Ctrl-Space": function (_yasqe: any) {
        const yasqe: Yasqe = _yasqe;
        yasqe.autocomplete();
      },
      "Shift-Ctrl-K": function (_yasqe: any) {
        const yasqe: Yasqe = _yasqe;
        const lineNumber = yasqe.getDoc().getCursor().line;
        if (lineNumber === yasqe.getDoc().lastLine() && lineNumber > 1) {
          //delete current line, and the linebreak just before
          return yasqe
            .getDoc()
            .replaceRange(
              "",
              { ch: yasqe.getDoc().getLine(lineNumber - 1).length, line: lineNumber - 1 },
              { ch: yasqe.getDoc().getLine(lineNumber).length, line: lineNumber },
            );
        } else {
          //delete current line including the linebreak after
          return yasqe.getDoc().replaceRange("", { ch: 0, line: lineNumber }, { ch: 0, line: lineNumber + 1 });
        }
      },
      "Ctrl-/": function (_yasqe: any) {
        const yasqe: Yasqe = _yasqe;
        yasqe.commentLines();
      },
      "Shift-Ctrl-D": function (_yasqe: any) {
        const yasqe: Yasqe = _yasqe;
        yasqe.duplicateLine();
      },
      "Shift-Ctrl-F": function (_yasqe: any) {
        const yasqe: Yasqe = _yasqe;
        yasqe.format();
      },
      "Ctrl-S": function (_yasqe: any) {
        const yasqe: Yasqe = _yasqe;
        yasqe.saveQuery();
      },

      "Cmd-Enter": function (_yasqe: any) {
        const yasqe: Yasqe = _yasqe;
        yasqe.query().catch(() => {}); //catch this to avoid unhandled rejection
      },
      "Ctrl-Enter": function (_yasqe: any) {
        const yasqe: Yasqe = _yasqe;
        yasqe.query().catch(() => {}); //catch this to avoid unhandled rejection
      },
      Esc: function (_yasqe: any) {
        const yasqe: Yasqe = _yasqe;
        yasqe.getInputField().blur();
      },
      F11: function (_yasqe: any) {
        const yasqe: Yasqe = _yasqe;
        yasqe.toggleFullscreen();
      },
    },

    createShareableLink: function (yasqe: Yasqe) {
      return (
        document.location.protocol +
        "//" +
        document.location.host +
        document.location.pathname +
        document.location.search +
        "#" +
        queryString.stringify(yasqe.configToQueryParams())
      );
    },
    pluginButtons: undefined,

    createShortLink: undefined,

    consumeShareLink: function (yasqe: Yasqe) {
      yasqe.queryParamsToConfig(yasqe.getUrlParams());
    },
    persistenceId: function (yasqe: Yasqe) {
      //Traverse parents untl we've got an id
      // Get matching parent elements
      let id = "";
      let elem: any = yasqe.rootEl;
      if ((<any>elem).id) id = (<any>elem).id;
      for (; elem && elem !== <any>document; elem = elem.parentNode) {
        if (elem) {
          if ((<any>elem).id) id = (<any>elem).id;
          break;
        }
      }
      return "yasqe_" + id + "_query";
    },
    persistencyExpire: 60 * 60 * 24 * 30,

    showQueryButton: true,

    hintConfig: {},
    resizeable: true,
    editorHeight: "300px",
    queryingDisabled: undefined,
    prefixCcApi: prefixCcApi,
    showFormatButton: true,
    showMapButton: true,
    checkConstructVariables: true,
    snippets: [
      {
        label: "SELECT",
        code: "SELECT * WHERE {\n  ?s ?p ?o .\n} LIMIT 10",
        group: "Query Types",
      },
      {
        label: "CONSTRUCT",
        code: "CONSTRUCT {\n  ?s ?p ?o .\n} WHERE {\n  ?s ?p ?o .\n} LIMIT 10",
        group: "Query Types",
      },
      {
        label: "ASK",
        code: "ASK {\n  ?s ?p ?o .\n}",
        group: "Query Types",
      },
      {
        label: "FILTER",
        code: "FILTER (?var > 100)",
        group: "Patterns",
      },
      {
        label: "OPTIONAL",
        code: "OPTIONAL {\n  ?s ?p ?o .\n}",
        group: "Patterns",
      },
    ],
    showSnippetsBar: true,
  };
  const requestConfig: PlainRequestConfig = {
    queryArgument: undefined, //undefined means: get query argument based on query mode
    endpoint: "https://dbpedia.org/sparql",
    method: "POST",
    acceptHeaderGraph: "text/turtle,*/*;q=0.9",
    acceptHeaderSelect: "application/sparql-results+json,*/*;q=0.9",
    acceptHeaderUpdate: "text/plain,*/*;q=0.9",
    namedGraphs: [],
    defaultGraphs: [],
    args: [],
    headers: {},
    withCredentials: false,
    adjustQueryBeforeRequest: false,
    basicAuth: undefined,
    bearerAuth: undefined,
    apiKeyAuth: undefined,
    oauth2Auth: undefined,
  };
  return { ...config, requestConfig };
}
