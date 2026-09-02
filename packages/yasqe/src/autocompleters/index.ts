import { default as Yasqe, Token, Hint, Position, Config, HintFn, HintList } from "../";
import Trie from "../trie";
import { EventEmitter } from "events";
import { take } from "lodash-es";
import "./show-hint.scss";
export interface CompleterConfig {
  onInitialize?: (this: CompleterConfig, yasqe: Yasqe) => void; //allows for e.g. registering event listeners in yasqe, like the prefix autocompleter does
  isValidCompletionPosition: (yasqe: Yasqe) => boolean;
  get: (yasqe: Yasqe, token?: AutocompletionToken) => Promise<string[]> | string[];
  preProcessToken?: (yasqe: Yasqe, token: Token) => AutocompletionToken;
  postProcessSuggestion?: (yasqe: Yasqe, token: AutocompletionToken, suggestedString: string) => string;
  postprocessHints?: (yasqe: Yasqe, hints: Hint[]) => Hint[];
  bulk: boolean;
  autoShow?: boolean;
  persistenceId?: Config["persistenceId"];
  name: string;
}
const SUGGESTIONS_LIMIT = 100;
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
  private storeBulkCompletions(completions: string[]) {
    if (!completions || !(completions instanceof Array)) return;
    // store array as trie
    this.trie = new Trie();
    for (const c of completions) {
      this.trie.insert(c);
    }

    // store in localstorage as well
    var storageId = this.getStorageId();
    if (storageId)
      this.yasqe.storage.set(storageId, completions, 60 * 60 * 24 * 30, this.yasqe.handleLocalStorageQuotaFull);
  }

  /**
   * Get completion list from `get` function
   */
  public getCompletions(token?: AutocompletionToken): Promise<string[]> {
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
        this.config.get.filter((possibleMatch) => possibleMatch.indexOf(stringToAutocomplete) === 0),
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

  private getHint(autocompletionToken: AutocompletionToken, suggestedString: string): Hint {
    if (this.config.postProcessSuggestion) {
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
      displayText: suggestedString,
      from: from,
      to: to,
    };
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
      return this.getHints(this.yasqe.getCompleteToken()).then((list): HintList => {
        const cur = this.yasqe.getDoc().getCursor();
        const token: AutocompletionToken = this.yasqe.getCompleteToken();
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

  const params = new URLSearchParams();
  if (token.autocompletionString) params.append("q", token.autocompletionString);
  params.append("page_size", "50");
  params.append("type", type);
  const url = `${reqProtocol}lov.linkeddata.es/dataset/lov/api/v2/autocomplete/terms?${params.toString()}`;
  return fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Failed fetching suggestions from Linked Open Vocabularies");
      }
      return response.json();
    })
    .then((result) => {
      if (result.results) {
        return result.results.map((r: any) => r.uri[0]);
      }
      return [];
    })
    .catch((_e) => {
      yasqe.showNotification(notificationKey, "Failed fetching suggestions");
    });
};

import variableCompleter from "./variables";
import prefixCompleter from "./prefixes";
import propertyCompleter from "./properties";
import classCompleter from "./classes";
export var completers: CompleterConfig[] = [variableCompleter, prefixCompleter, propertyCompleter, classCompleter];
