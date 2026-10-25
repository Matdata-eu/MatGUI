import { default as Yasqe, Token, Hint, Position, Config, HintFn, HintList } from "../";
import Trie from "../trie";
import { EventEmitter } from "events";
import { take } from "lodash-es";
import "./show-hint.scss";
export interface CompleterConfig {
  onInitialize?: (this: CompleterConfig, yasqe: Yasqe) => void; //allows for e.g. registering event listeners in yasqe, like the prefix autocompleter does
  isValidCompletionPosition: (yasqe: Yasqe) => boolean;
  get: (yasqe: Yasqe, token?: AutocompletionToken) => Promise<Suggestion[]> | Suggestion[];
  preProcessToken?: (yasqe: Yasqe, token: Token) => AutocompletionToken;
  postProcessSuggestion?: (yasqe: Yasqe, token: AutocompletionToken, suggestedString: string) => string;
  postprocessHints?: (yasqe: Yasqe, hints: Hint[]) => Hint[];
  bulk: boolean;
  autoShow?: boolean;
  persistenceId?: Config["persistenceId"];
  name: string;
}
const SUGGESTIONS_LIMIT = 100;
/**
 * A suggestion with presentation details. `text` is inserted as is: `postProcessSuggestion` is not applied.
 */
export interface RichSuggestion {
  text: string;
  displayText?: string;
  /** Shown next to the suggestion, e.g. a usage count */
  detail?: string;
  /** Groups suggestions under a heading in the hint list */
  section?: string | { name: string; rank?: number };
  /** Prefixes (prefix → namespace) to declare when the suggestion is picked */
  prefixes?: { [prefix: string]: string };
}
export type Suggestion = string | RichSuggestion;
/**
 * A class or property used in the endpoint, e.g. from the Endpoint overview of Yasgui.
 * Provided through the `endpointTerms` config option.
 */
export interface EndpointTerm {
  iri: string;
  /** Number of instances (classes) or triples (properties) */
  count?: number;
  /** Prefix and namespace with which the IRI can be shortened */
  prefix?: string;
  namespace?: string;
}
export interface AutocompletionToken extends Token {
  autocompletionString?: string;
  tokenPrefix?: string;
  tokenPrefixUri?: string;
  from?: Partial<Position>;
  to?: Partial<Position>;
}
export class Completer extends EventEmitter {
  protected yasqe: Yasqe;
  private trie?: Trie;
  private config: CompleterConfig;
  constructor(yasqe: Yasqe, config: CompleterConfig) {
    super();
    this.yasqe = yasqe;
    this.config = config;
  }

  // private selectHint(data:EditorChange, completion:any) {
  //   if (completion.text != this.yasqe.getTokenAt(this.yasqe.getDoc().getCursor()).string) {
  //     this.yasqe.getDoc().replaceRange(completion.text, data.from, data.to);
  //   }
  // };
  private getStorageId() {
    return this.yasqe.getStorageId(this.config.persistenceId);
  }

  /**
   * Store bulk completion in local storage, and populates the trie
   */
  private storeBulkCompletions(completions: Suggestion[]) {
    if (!completions || !(completions instanceof Array)) return;
    // store array as trie
    this.trie = new Trie();
    for (const c of completions) {
      if (typeof c === "string") this.trie.insert(c);
    }

    // store in localstorage as well
    var storageId = this.getStorageId();
    if (storageId)
      this.yasqe.storage.set(storageId, completions, 60 * 60 * 24 * 30, this.yasqe.handleLocalStorageQuotaFull);
  }

  /**
   * Get completion list from `get` function
   */
  public getCompletions(token?: AutocompletionToken): Promise<Suggestion[]> {
    if (!this.config.get) return Promise.resolve([]);

    //No token, so probably getting as bulk
    if (!token) {
      if (this.config.get instanceof Array) return Promise.resolve(this.config.get);
      //wrapping call in a promise.resolve, so this when a `get` is both async or sync
      return Promise.resolve(this.config.get(this.yasqe)).then((suggestions) => {
        if (suggestions instanceof Array) return suggestions;
        return [];
      });
    }

    //ok, there is a token
    const stringToAutocomplete = token.autocompletionString || token.string;
    if (this.trie) return Promise.resolve(take(this.trie.autoComplete(stringToAutocomplete), SUGGESTIONS_LIMIT));
    if (this.config.get instanceof Array)
      return Promise.resolve(
        this.config.get.filter(
          (possibleMatch) =>
            (typeof possibleMatch === "string" ? possibleMatch : possibleMatch.text).indexOf(stringToAutocomplete) ===
            0,
        ),
      );
    //assuming it's a function
    return Promise.resolve(this.config.get(this.yasqe, token)).then((r) => {
      if (r instanceof Array) return r;
      return [];
    });
  }

  /**
   * Populates completions. Pre-fetches those if bulk is set to true
   */
  public initialize(): Promise<void> {
    if (this.config.onInitialize) this.config.onInitialize(this.yasqe);
    if (this.config.bulk) {
      if (this.config.get instanceof Array) {
        // we don't care whether the completions are already stored in
        // localstorage. just use this one
        this.storeBulkCompletions(this.config.get);
        return Promise.resolve();
      } else {
        // if completions are defined in localstorage, use those! (calling the
        // function may come with overhead (e.g. async calls))
        var completionsFromStorage: string[] | undefined;
        var storageId = this.getStorageId();
        if (storageId) completionsFromStorage = this.yasqe.storage.get<string[]>(storageId);
        if (completionsFromStorage && completionsFromStorage.length > 0) {
          this.storeBulkCompletions(completionsFromStorage);
          return Promise.resolve();
        } else {
          return this.getCompletions().then((c) => this.storeBulkCompletions(c));
        }
      }
    }
    return Promise.resolve();
  }

  private isValidPosition(): boolean {
    if (!this.config.isValidCompletionPosition) return false; //no way to check whether we are in a valid position
    if (!this.config.isValidCompletionPosition(this.yasqe)) {
      this.emit("invalidPosition", this);
      this.yasqe.hideNotification(this.config.name);
      return false;
    }
    if (!this.config.autoShow) {
      this.yasqe.showNotification(this.config.name, "Press CTRL - <spacebar> to autocomplete");
    }
    this.emit("validPosition", this);
    return true;
  }

  private getHint(autocompletionToken: AutocompletionToken, suggestion: Suggestion): Hint {
    const rich = typeof suggestion === "string" ? undefined : suggestion;
    let suggestedString = typeof suggestion === "string" ? suggestion : suggestion.text;
    if (!rich && this.config.postProcessSuggestion) {
      suggestedString = this.config.postProcessSuggestion(this.yasqe, autocompletionToken, suggestedString);
    }
    let from: Position | undefined;
    let to: Position;
    const cursor = this.yasqe.getDoc().getCursor();
    if (autocompletionToken.from) {
      from = { ...cursor, ...autocompletionToken.from };
    }
    // Need to set a 'to' part as well, as otherwise we'd be appending the result to the already typed filter
    const line = this.yasqe.getDoc().getCursor().line;
    if (autocompletionToken.to) {
      to = { ch: autocompletionToken?.to?.ch || this.yasqe.getCompleteToken().end, line: line };
    } else if (autocompletionToken.string.length > 0) {
      to = { ch: this.yasqe.getCompleteToken().end, line: line };
    } else {
      to = <any>autocompletionToken.from;
    }
    return {
      text: suggestedString,
      displayText: rich?.displayText || suggestedString,
      detail: rich?.detail,
      section: rich?.section,
      prefixes: rich?.prefixes,
      from: from,
      to: to,
    };
  }

  /**
   * The token to complete. Whitespace is not replaced: completing there inserts at the cursor.
   */
  private getTokenToComplete(): AutocompletionToken {
    const token: AutocompletionToken = this.yasqe.getCompleteToken();
    if (token.string.trim().length === 0) {
      const ch = this.yasqe.getDoc().getCursor().ch;
      return { ...token, string: "", start: ch, end: ch };
    }
    return token;
  }

  private getHints(token: AutocompletionToken): Promise<Hint[]> {
    if (this.config.preProcessToken) {
      token = this.config.preProcessToken(this.yasqe, token);
    }

    if (token)
      return this.getCompletions(token)
        .then((suggestions) => suggestions.map((s) => this.getHint(token, s)))
        .then((hints) => {
          if (this.config.postprocessHints) return this.config.postprocessHints(this.yasqe, hints);
          return hints;
        });
    return Promise.resolve([]);
  }
  /**
   * Returns whether the cursor is currently at a position this completer can complete.
   * Also takes care of showing/hiding the "press ctrl-space" notification.
   */
  public isValidCompletionPosition(): boolean {
    return this.isValidPosition();
  }

  /**
   * Returns a hint function for the current cursor position, or `false` when this completer should not
   * (or cannot) show completions right now. The caller (Yasqe) is responsible for opening the completion popup.
   */
  public autocomplete(fromAutoShow: boolean): HintFn | false {
    //this part goes before the autoshow check, as we _would_ like notification showing to indicate a user can press ctrl-space
    if (!this.isValidPosition()) return false;
    if (
      fromAutoShow && // from autoShow, i.e. this gets called each time the editor content changes
      (!this.config.autoShow || this.yasqe.isAutocompletionActive()) // Don't show  and don't create a new instance when its already active
    ) {
      return false;
    }
    return this.getHintFn();
  }

  /**
   * Hint function that computes the hints for the token at the current cursor position
   */
  public getHintFn(): HintFn {
    const getHints: HintFn = () => {
      return this.getHints(this.getTokenToComplete()).then((list): HintList => {
        const cur = this.yasqe.getDoc().getCursor();
        const token: AutocompletionToken = this.getTokenToComplete();
        return {
          list: list,
          from: <Position>{
            line: cur.line,
            ch: token.start,
          },
          to: <Position>{
            line: cur.line,
            ch: token.end,
          },
        };
      });
    };
    return getHints;
  }
}

/**
 * Converts rdf:type to http://.../type and converts <http://...> to http://...
 * Stores additional info such as the used namespace and prefix in the token object
 */
export function preprocessIriForCompletion(yasqe: Yasqe, token: AutocompletionToken) {
  const queryPrefixes = yasqe.getPrefixesFromQuery();
  const stringToPreprocess = token.string;

  if (stringToPreprocess.indexOf("<") < 0) {
    token.tokenPrefix = stringToPreprocess.substring(0, stringToPreprocess.indexOf(":") + 1);

    if (queryPrefixes[token.tokenPrefix.slice(0, -1)] != null) {
      token.tokenPrefixUri = queryPrefixes[token.tokenPrefix.slice(0, -1)];
    }
  }

  token.autocompletionString = stringToPreprocess.trim();
  if (stringToPreprocess.indexOf("<") < 0 && stringToPreprocess.indexOf(":") > -1) {
    // hmm, the token is prefixed. We still need the complete uri for autocompletions. generate this!
    for (var prefix in queryPrefixes) {
      if (token.tokenPrefix === prefix + ":") {
        token.autocompletionString = queryPrefixes[prefix];
        token.autocompletionString += stringToPreprocess.substring(prefix.length + 1);
        break;
      }
    }
  }

  if (token.autocompletionString.indexOf("<") == 0)
    token.autocompletionString = token.autocompletionString.substring(1);
  if (token.autocompletionString.indexOf(">", token.autocompletionString.length - 1) > 0)
    token.autocompletionString = token.autocompletionString.substring(0, token.autocompletionString.length - 1);
  return token;
}

export function postprocessIriCompletion(_yasqe: Yasqe, token: AutocompletionToken, suggestedString: string) {
  if (token.tokenPrefix && token.autocompletionString && token.tokenPrefixUri) {
    // we need to get the suggested string back to prefixed form
    suggestedString = token.tokenPrefix + suggestedString.substring(token.tokenPrefixUri.length);
  } else {
    // it is a regular uri. add '<' and '>' to string
    suggestedString = "<" + suggestedString + ">";
  }
  return suggestedString;
}

//Use protocol relative request when served via http[s]*. Otherwise (e.g. file://, fetch via http)
export const fetchFromLov = (
  yasqe: Yasqe,
  type: "class" | "property",
  token?: AutocompletionToken,
): Promise<string[]> => {
  var reqProtocol = window.location.protocol.indexOf("http") === 0 ? "https://" : "http://";
  const notificationKey = "autocomplete_" + type;
  if (!token || !token.string || token.string.trim().length == 0) {
    yasqe.showNotification(notificationKey, "Nothing to autocomplete yet!");
    return Promise.resolve([]);
  }
  // //if notification bar is there, show a loader
  // yasqe.autocompleters.notifications
  //   .getEl(completer)
  //   .empty()
  //   .append($("<span>Fetchting autocompletions &nbsp;</span>"))
  //   .append($(yutils.svg.getElement(require("../imgs.js").loader)).addClass("notificationLoader"));
  // doRequests();

  // LOV API v2 (https://lov.linkeddata.es/dataset/api): "autocomplete" completes (prefixed) IRIs,
  // "search" is a full text search, which suits a plain word better
  const q = (token.autocompletionString || token.string).trim();
  const isIri = q.indexOf(":") >= 0;
  const params = new URLSearchParams();
  params.append("q", q);
  params.append("page_size", "50");
  params.append("type", type);
  const url = `${reqProtocol}lov.linkeddata.es/dataset/api/v2/term/${isIri ? "autocomplete" : "search"}?${params.toString()}`;
  return fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed fetching suggestions from Linked Open Vocabularies");
      }
      return response.json();
    })
    .then((result) => {
      if (!result || !Array.isArray(result.results)) return [];
      // Depending on the API version, `uri` is a string or a list with one string
      return result.results
        .map((r: any) => (Array.isArray(r?.uri) ? r.uri[0] : r?.uri))
        .filter((uri: unknown): uri is string => typeof uri === "string" && uri.length > 0);
    })
    .catch((_e) => {
      yasqe.showNotification(notificationKey, "Failed fetching suggestions");
    });
};

const ENDPOINT_SUGGESTIONS_LIMIT = 50;
export const ENDPOINT_SECTION = { name: "Used in this endpoint", rank: 0 };
export const LOV_SECTION = { name: "Linked Open Vocabularies", rank: 1 };
export const FUNCTION_SECTION = { name: "Functions", rank: 2 };

function localName(iri: string): string {
  return iri.substring(Math.max(iri.lastIndexOf("#"), iri.lastIndexOf("/")) + 1);
}

/**
 * Selects the endpoint terms that match what the user typed, keeping their (usage) order.
 * Matches the full IRI, the prefixed name, or, when the user typed a plain word, the local name.
 */
export function matchEndpointTerms(terms: EndpointTerm[], token?: AutocompletionToken): EndpointTerm[] {
  const typed = (token?.string || "").trim().toLowerCase();
  const iriString = (token?.autocompletionString || "").trim().toLowerCase();
  if (!typed) return terms.slice(0, ENDPOINT_SUGGESTIONS_LIMIT);
  const plainWord = typed.indexOf(":") < 0 && typed.indexOf("<") < 0;
  return terms
    .filter((term) => {
      const iri = term.iri.toLowerCase();
      if (iriString && iri.indexOf(iriString) === 0) return true;
      if (term.prefix !== undefined && term.namespace && term.iri.indexOf(term.namespace) === 0) {
        const prefixed = `${term.prefix}:${term.iri.substring(term.namespace.length)}`.toLowerCase();
        if (prefixed.indexOf(typed) === 0) return true;
      }
      return plainWord && localName(iri).indexOf(typed) >= 0;
    })
    .slice(0, ENDPOINT_SUGGESTIONS_LIMIT);
}

/**
 * The text to insert for an endpoint term: a prefixed name when possible (declaring the prefix when it is missing),
 * otherwise the full IRI.
 */
export function endpointTermToSuggestion(
  yasqe: Yasqe,
  token: AutocompletionToken,
  term: EndpointTerm,
  section: RichSuggestion["section"] = ENDPOINT_SECTION,
): RichSuggestion {
  const detail = term.count !== undefined ? term.count.toLocaleString() : undefined;
  // The user is typing with a declared prefix that fits this IRI: keep using it
  if (token.tokenPrefix && token.tokenPrefixUri && term.iri.indexOf(token.tokenPrefixUri) === 0) {
    const text = token.tokenPrefix + term.iri.substring(token.tokenPrefixUri.length);
    return { text, detail, section };
  }
  if (term.prefix !== undefined && term.namespace && term.iri.indexOf(term.namespace) === 0) {
    const declared = yasqe.getPrefixesFromQuery()[term.prefix];
    if (declared === undefined || declared === term.namespace) {
      const text = `${term.prefix}:${term.iri.substring(term.namespace.length)}`;
      return {
        text,
        detail,
        section,
        prefixes: declared === undefined ? { [term.prefix]: term.namespace } : undefined,
      };
    }
  }
  return { text: `<${term.iri}>`, detail, section };
}

/**
 * Class and property suggestions: the terms used in the current endpoint (see the `endpointTerms` config option),
 * followed by the matching terms of Linked Open Vocabularies (bundled, see the `lovTerms` config option).
 */
export const fetchIriSuggestions = async (
  yasqe: Yasqe,
  type: "class" | "property",
  token?: AutocompletionToken,
): Promise<Suggestion[]> => {
  let endpointTerms: EndpointTerm[] = [];
  if (yasqe.config.endpointTerms) {
    try {
      endpointTerms = (await yasqe.config.endpointTerms(yasqe, type)) || [];
    } catch (e) {
      console.warn("Could not get endpoint terms for autocompletion", e);
    }
  }
  if (!token) return [];
  const matched = matchEndpointTerms(endpointTerms, token);
  const known = new Set(matched.map((term) => term.iri));
  const lovTerms = yasqe.config.lovTerms === undefined ? bundledLovTerms : yasqe.config.lovTerms;
  const fromLov = lovTerms ? searchLov(lovTerms, type, token) : [];
  const suggestions = [
    ...matched.map((term) => endpointTermToSuggestion(yasqe, token, term)),
    ...fromLov
      .filter((term) => !known.has(term.iri))
      .map((term) => endpointTermToSuggestion(yasqe, token, term, LOV_SECTION)),
  ];
  if (suggestions.length === 0 && !token.string.trim()) {
    yasqe.showNotification("autocomplete_" + type, "Nothing to autocomplete yet!");
  }
  return suggestions;
};

import { bundledLovTerms, searchLov } from "./lov";
export type { LovTerms, LovTermType } from "./lov";
import variableCompleter from "./variables";
import prefixCompleter from "./prefixes";
import propertyCompleter from "./properties";
import classCompleter from "./classes";
import functionCompleter from "./functions";
export var completers: CompleterConfig[] = [
  variableCompleter,
  prefixCompleter,
  propertyCompleter,
  classCompleter,
  functionCompleter,
];
