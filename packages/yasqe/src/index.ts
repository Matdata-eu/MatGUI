import "./scss/yasqe.scss";
import "./scss/buttons.scss";
import "./scss/codemirrorMods.scss";
import "leaflet/dist/leaflet.css";
import { findFirstPrefixLine as findFirstPrefixLineInDoc, foldAt, unfoldAt } from "./editor/folding";
import { getPrefixesFromQuery, addPrefixes, removePrefixes, Prefixes } from "./prefixUtils";
import { getPreviousNonWsToken, getNextNonWsToken, getCompleteToken } from "./tokenUtils";
import { Storage as YStorage } from "@matdata/yasgui-utils";
import * as queryString from "query-string";
import tooltip from "./tooltip";
import { addClass, removeClass } from "@matdata/yasgui-utils";
import * as Sparql from "./sparql";

import * as Autocompleter from "./autocompleters";
import { merge, mergeWith, escape } from "lodash-es";

import getDefaults from "./defaults";
import { EditorFacade, EditorOptions } from "./editor/facade";
import { runMode as runTokenizer } from "./editor/tokenizerRunner";
import type { Position, Token, TokenizerState } from "./editor/tokenizerRunner";
import type { ExtraKeys } from "./editor/keymap";
import type { HintFn, HintList } from "./editor/autocompletion";
import { isCompletionActive, openCompletion, hideCompletion } from "./editor/autocompletion";
import { YasqeAjaxConfig } from "./sparql";
import { spfmt } from "sparql-formatter";
import * as L from "leaflet";
import { coordinatesToWkt, wrapWktLiteral, WktCoordinate, WktGeometryType } from "./mapWidget";

// Toast notification timing constants
const TOAST_DEFAULT_DURATION = 3000; // 3 seconds
const TOAST_WARNING_DURATION = 4000; // 4 seconds for warnings
const TOAST_WARNING_DELAY = 500; // Delay before showing auth warning
const TOAST_FADEOUT_DURATION = 300; // Fade out animation duration

export interface Yasqe {
  on(eventName: "query", handler: (instance: Yasqe, req: Request, abortController?: AbortController) => void): void;
  off(eventName: "query", handler: (instance: Yasqe, req: Request, abortController?: AbortController) => void): void;
  on(eventName: "queryAbort", handler: (instance: Yasqe, req: Request) => void): void;
  off(eventName: "queryAbort", handler: (instance: Yasqe, req: Request) => void): void;
  on(eventName: "queryResponse", handler: (instance: Yasqe, response: any, duration: number) => void): void;
  off(eventName: "queryResponse", handler: (instance: Yasqe, response: any, duration: number) => void): void;
  on(eventName: "error", handler: (instance: Yasqe) => void): void;
  off(eventName: "error", handler: (instance: Yasqe) => void): void;
  on(eventName: "blur", handler: (instance: Yasqe) => void): void;
  off(eventName: "blur", handler: (instance: Yasqe) => void): void;
  on(eventName: "queryBefore", handler: (instance: Yasqe, config: YasqeAjaxConfig) => void): void;
  off(eventName: "queryBefore", handler: (instance: Yasqe, config: YasqeAjaxConfig) => void): void;
  on(eventName: "queryResults", handler: (instance: Yasqe, results: any, duration: number) => void): void;
  off(eventName: "queryResults", handler: (instance: Yasqe, results: any, duration: number) => void): void;
  on(eventName: "autocompletionShown", handler: (instance: Yasqe, widget: any) => void): void;
  off(eventName: "autocompletionShown", handler: (instance: Yasqe, widget: any) => void): void;
  on(eventName: "autocompletionClose", handler: (instance: Yasqe) => void): void;
  off(eventName: "autocompletionClose", handler: (instance: Yasqe) => void): void;
  on(eventName: "resize", handler: (instance: Yasqe, newSize: string) => void): void;
  off(eventName: "resize", handler: (instance: Yasqe, newSize: string) => void): void;
  on(eventName: "saveManagedQuery", handler: () => void): void;
  off(eventName: "saveManagedQuery", handler: () => void): void;
  on(eventName: "downloadRqFile", handler: () => void): void;
  off(eventName: "downloadRqFile", handler: () => void): void;
  on(eventName: "change", handler: (instance: Yasqe, changeObj?: any) => void): void;
  off(eventName: "change", handler: (instance: Yasqe, changeObj?: any) => void): void;
  on(eventName: "changes", handler: (instance: Yasqe) => void): void;
  off(eventName: "changes", handler: (instance: Yasqe) => void): void;
  on(eventName: "cursorActivity", handler: (instance: Yasqe) => void): void;
  off(eventName: "cursorActivity", handler: (instance: Yasqe) => void): void;
  on(eventName: "focus", handler: (instance: Yasqe) => void): void;
  off(eventName: "focus", handler: (instance: Yasqe) => void): void;
  on(eventName: string, handler: (...args: any[]) => void): void;
  off(eventName: string, handler: (...args: any[]) => void): void;
}

/** Editor option keys that are handed to the underlying CodeMirror 6 editor */
const EDITOR_OPTION_KEYS: (keyof EditorOptions)[] = [
  "mode",
  "value",
  "lineNumbers",
  "lineWrapping",
  "readOnly",
  "tabSize",
  "indentUnit",
  "indentWithTabs",
  "theme",
  "extraKeys",
  "tabMode",
  "foldGutter",
  "gutters",
  "matchBrackets",
  "highlightSelectionMatches",
  "autoCloseBrackets",
  "fixedGutter",
  "placeholder",
  "autofocus",
  "viewportMargin",
];

function mergeConfig(conf: PartialConfig): Config {
  // Use mergeWith to replace arrays instead of merging them by index
  // This ensures that snippets: [] properly overrides default snippets
  return mergeWith({}, Yasqe.defaults, conf, (_objValue: any, srcValue: any) => {
    if (Array.isArray(srcValue)) {
      return srcValue;
    }
  });
}

function createRootEl(parent: HTMLElement): HTMLDivElement {
  if (!parent) throw new Error("No parent passed as argument. Dont know where to draw YASQE");
  const rootEl = document.createElement("div");
  rootEl.className = "yasqe";
  parent.appendChild(rootEl);
  return rootEl;
}

export class Yasqe extends EditorFacade {
  private static storageNamespace = "triply";
  public autocompleters: { [name: string]: Autocompleter.Completer | undefined } = {};
  private prevQueryValid = false;
  public queryValid = true;
  public lastQueryDuration: number | undefined;
  private req: Request | undefined;
  private abortController: AbortController | undefined;
  private queryStatus: "valid" | "error" | undefined;
  private queryBtn: HTMLButtonElement | undefined;
  private saveBtnWrapper: HTMLDivElement | undefined;
  private fullscreenBtn: HTMLButtonElement | undefined;
  private hamburgerBtn: HTMLButtonElement | undefined;
  private hamburgerMenu: HTMLDivElement | undefined;
  private shareBtn: HTMLButtonElement | undefined;
  private mapBtn: HTMLButtonElement | undefined;
  private mapPopup: HTMLDivElement | undefined;
  private closeMapPopupHandler: (() => void) | undefined;
  private isFullscreen: boolean = false;
  private horizontalResizeWrapper?: HTMLDivElement;
  private snippetsBar?: HTMLDivElement;
  private snippetsClickHandler?: (e: MouseEvent) => void;
  private snippetsResizeHandler?: () => void;
  public rootEl: HTMLDivElement;
  public storage: YStorage;
  public config: Config;
  public persistentConfig: PersistentConfig | undefined;
  constructor(parent: HTMLElement, conf: PartialConfig = {}) {
    const config = mergeConfig(conf);
    const rootEl = createRootEl(parent);
    const editorOptions: EditorOptions = {};
    for (const key of EDITOR_OPTION_KEYS) {
      if ((config as any)[key] !== undefined) (editorOptions as any)[key] = (config as any)[key];
    }
    super(rootEl, editorOptions);
    this.rootEl = rootEl;
    this.config = config;

    //Do some post processing
    this.storage = new YStorage(Yasqe.storageNamespace);
    this.drawButtons();
    this.drawSnippetsBar();
    const storageId = this.getStorageId();
    // this.getWrapperElement
    if (storageId) {
      const persConf = this.storage.get<any>(storageId);
      if (persConf && typeof persConf === "string") {
        this.persistentConfig = { query: persConf, editorHeight: this.config.editorHeight };
      } else {
        this.persistentConfig = persConf;
      }
      if (!this.persistentConfig)
        this.persistentConfig = { query: this.getValue(), editorHeight: this.config.editorHeight };

      // Ensure autoformatOnQuery is true by default
      if (this.persistentConfig && typeof this.persistentConfig.autoformatOnQuery === "undefined") {
        this.persistentConfig.autoformatOnQuery = true;
      }

      if (this.persistentConfig && this.persistentConfig.query) this.setValue(this.persistentConfig.query);
    } else {
      // If no storage, ensure persistentConfig exists and autoformatOnQuery is true
      if (!this.persistentConfig) {
        this.persistentConfig = {
          query: this.getValue(),
          editorHeight: this.config.editorHeight,
          autoformatOnQuery: true,
        };
      } else if (typeof this.persistentConfig.autoformatOnQuery === "undefined") {
        this.persistentConfig.autoformatOnQuery = true;
      }
    }
    this.config.autocompleters.forEach((c) => this.enableCompleter(c).then(() => {}, console.warn));
    if (this.config.consumeShareLink) {
      this.config.consumeShareLink(this);
      //and: add a hash listener!
      window.addEventListener("hashchange", this.handleHashChange);
    }
    this.checkSyntax();
    this.checkConstructVariables();
    // Size codemirror to the
    if (this.persistentConfig && this.persistentConfig.editorHeight) {
      this.getWrapperElement().style.height = this.persistentConfig.editorHeight;
    } else if (this.config.editorHeight) {
      this.getWrapperElement().style.height = this.config.editorHeight;
    }

    if (this.config.resizeable) this.drawResizer();
    if (this.config.collapsePrefixesOnLoad) this.collapsePrefixes(true);
    this.registerEventListeners();
  }
  private handleHashChange = () => {
    this.config.consumeShareLink?.(this);
  };
  private handleChange = () => {
    this.checkSyntax();
    this.checkConstructVariables();
    this.updateQueryButton();
  };
  private handleBlur = () => {
    this.saveQuery();
  };
  private handleChanges = () => {
    // e.g. handle blur
    this.checkSyntax();
    this.checkConstructVariables();
    this.updateQueryButton();
  };
  private handleCursorActivity = () => {
    this.autocomplete(true);

    // Check if cursor is on a URI and show DESCRIBE hint
    const cursor = this.getDoc().getCursor();
    const token = this.getTokenAt(cursor);

    if (token && token.type === "variable-3") {
      // Token type "variable-3" represents URIs (IRI_REF)
      this.showNotification(
        "uri-describe-hint",
        "CTRL+click: find triples where URI is subject or object. CTRL+SHIFT+click: find triples where URI is object.",
      );
    } else {
      this.hideNotification("uri-describe-hint");
    }
  };
  private handleQuery = (_yasqe: Yasqe, req: Request, abortController?: AbortController) => {
    this.req = req;
    this.abortController = abortController;
    this.updateQueryButton();
  };
  private handleQueryResponse = (_yasqe: Yasqe, _response: any, duration: number) => {
    this.lastQueryDuration = duration;
    this.req = undefined;
    this.updateQueryButton();
  };
  private handleQueryAbort = (_yasqe: Yasqe, _req: Request) => {
    this.req = undefined;
    this.updateQueryButton();
  };

  /**
   * Aggregates the hints of all enabled autocompleters. Used by the CodeMirror 6 completion source.
   */
  protected getHintFn(): HintFn | undefined {
    // `pendingHintFn` is set by `autocomplete()`. When the completion was started by other means (e.g. a
    // CodeMirror `startCompletion` command), build the hint function on demand.
    const hintFn = this.pendingHintFn ?? this.buildHintFn(false);
    this.pendingHintFn = undefined;
    return hintFn;
  }
  private pendingHintFn: HintFn | undefined;

  private registerEventListeners() {
    /**
     * Register listeners
     */
    this.on("change", this.handleChange);
    this.on("blur", this.handleBlur);
    this.on("changes", this.handleChanges);
    this.on("cursorActivity", this.handleCursorActivity);

    this.on("query", this.handleQuery);
    this.on("queryResponse", this.handleQueryResponse);
    this.on("queryAbort", this.handleQueryAbort);
  }

  private unregisterEventListeners() {
    this.off("change", this.handleChange);
    this.off("blur", this.handleBlur);
    this.off("changes", this.handleChanges);
    this.off("cursorActivity", this.handleCursorActivity);

    this.off("query", this.handleQuery);
    this.off("queryResponse", this.handleQueryResponse);
    this.off("queryAbort", this.handleQueryAbort);
  }
  /**
   * Generic IDE functions
   */
  public getStorageId(getter?: Config["persistenceId"]): string | undefined {
    const persistenceId = getter || this.config.persistenceId;
    if (!persistenceId) return undefined;
    if (typeof persistenceId === "string") return persistenceId;
    return persistenceId(this);
  }
  private drawButtons() {
    const buttons = document.createElement("div");
    buttons.className = "yasqe_buttons";
    this.getWrapperElement().appendChild(buttons);

    if (this.config.pluginButtons) {
      const pluginButtons = this.config.pluginButtons();
      if (!pluginButtons) return;
      if (Array.isArray(pluginButtons)) {
        for (const button of pluginButtons) {
          buttons.append(button);
        }
      } else {
        buttons.appendChild(pluginButtons);
      }
    }

    /**
     * Draw query btn (FIRST)
     */
    if (this.config.showQueryButton) {
      this.queryBtn = document.createElement("button");
      addClass(this.queryBtn, "yasqe_queryButton");

      /**
       * Add all icon states: play (default), warning (error), loading (busy)
       */
      const queryEl = document.createElement("i");
      addClass(queryEl, "fas");
      addClass(queryEl, "fa-play");
      addClass(queryEl, "queryIcon");
      addClass(queryEl, "queryIcon--play");
      queryEl.setAttribute("aria-hidden", "true");
      this.queryBtn.appendChild(queryEl);

      const warningEl = document.createElement("i");
      addClass(warningEl, "fas");
      addClass(warningEl, "fa-exclamation-triangle");
      addClass(warningEl, "queryIcon");
      addClass(warningEl, "queryIcon--warning");
      warningEl.setAttribute("aria-hidden", "true");
      this.queryBtn.appendChild(warningEl);

      const loadingEl = document.createElement("i");
      addClass(loadingEl, "fas");
      addClass(loadingEl, "fa-spinner");
      addClass(loadingEl, "fa-pulse");
      addClass(loadingEl, "queryIcon");
      addClass(loadingEl, "queryIcon--loading");
      loadingEl.setAttribute("aria-hidden", "true");
      this.queryBtn.appendChild(loadingEl);

      /**
       * Add text label
       */
      const queryTextLabel = document.createElement("span");
      queryTextLabel.className = "yasqe_queryButton_text";
      queryTextLabel.textContent = "Run";
      this.queryBtn.appendChild(queryTextLabel);

      this.queryBtn.onclick = () => {
        if (this.config.queryingDisabled) return; // Don't do anything
        if (this.req) {
          this.abortQuery();
        } else {
          this.query().catch(() => {}); //catch this to avoid unhandled rejection
        }
      };
      this.queryBtn.title = "Run query (Ctrl+Enter)";
      this.queryBtn.setAttribute("aria-label", "Run query");

      buttons.appendChild(this.queryBtn);
      this.updateQueryButton();
    }

    /**
     * draw share link button (SECOND)
     */
    if (this.config.createShareableLink) {
      const shareIcon = document.createElement("i");
      addClass(shareIcon, "fas");
      addClass(shareIcon, "fa-share-nodes");
      shareIcon.setAttribute("aria-hidden", "true");
      const shareLinkWrapper = document.createElement("button");
      shareLinkWrapper.className = "yasqe_share";
      shareLinkWrapper.title = "Share query";
      shareLinkWrapper.setAttribute("aria-label", "Share query");
      shareLinkWrapper.appendChild(shareIcon);
      buttons.appendChild(shareLinkWrapper);
      this.shareBtn = shareLinkWrapper;
      shareLinkWrapper.addEventListener("click", (event: MouseEvent) => showSharePopup(event));
      shareLinkWrapper.addEventListener("keydown", (event: KeyboardEvent) => {
        if (event.code === "Enter") {
          showSharePopup(event);
        }
      });

      const showSharePopup = (event: MouseEvent | KeyboardEvent) => {
        event.stopPropagation();
        let popup: HTMLDivElement | undefined = document.createElement("div");
        popup.className = "yasqe_sharePopup";
        buttons.appendChild(popup);

        // Toast notification element for warnings
        let toastElement: HTMLDivElement | undefined;
        let toastTimeout: number | undefined;

        const showToast = (
          message: string,
          duration: number = TOAST_DEFAULT_DURATION,
          type: "info" | "warning" = "info",
        ) => {
          // Remove existing toast if any
          if (toastElement) {
            toastElement.remove();
          }
          // Clear existing timeout
          if (toastTimeout !== undefined) {
            clearTimeout(toastTimeout);
          }

          toastElement = document.createElement("div");
          toastElement.className = type === "warning" ? "yasqe_toast yasqe_toast-warning" : "yasqe_toast";

          // Add warning icon for warning toasts
          if (type === "warning") {
            const iconWrapper = document.createElement("span");
            iconWrapper.className = "yasqe_toast-icon";
            const icon = document.createElement("i");
            addClass(icon, "fas");
            addClass(icon, "fa-exclamation-triangle");
            icon.setAttribute("aria-hidden", "true");
            iconWrapper.appendChild(icon);
            toastElement.appendChild(iconWrapper);
          }

          const messageSpan = document.createElement("span");
          messageSpan.className = "yasqe_toast-message";
          messageSpan.textContent = message;
          toastElement.appendChild(messageSpan);

          document.body.appendChild(toastElement);

          // Auto-remove after duration
          toastTimeout = window.setTimeout(() => {
            if (toastElement) {
              toastElement.classList.add("yasqe_toast-fadeout");
              setTimeout(() => {
                toastElement?.remove();
                toastElement = undefined;
              }, TOAST_FADEOUT_DURATION);
            }
          }, duration);
        };

        // Create event listener that can be removed
        const closePopupHandler = (event: MouseEvent) => {
          if (popup && event.target !== popup && !popup.contains(<any>event.target)) {
            popup.remove();
            popup = undefined;
            // Clean up toast when popup closes
            if (toastElement) {
              toastElement.remove();
              toastElement = undefined;
            }
            if (toastTimeout !== undefined) {
              clearTimeout(toastTimeout);
            }
            // Remove this event listener to prevent memory leak
            document.body.removeEventListener("click", closePopupHandler, true);
          }
        };

        document.body.addEventListener("click", closePopupHandler, true);

        popup.innerHTML = "";

        // Helper function to copy text to clipboard
        const copyToClipboard = async (text: string, buttonText: string, hasAuth: boolean = false) => {
          try {
            // Check if Clipboard API is available
            if (!navigator.clipboard || !navigator.clipboard.writeText) {
              // Fallback for older browsers or non-secure contexts
              const textArea = document.createElement("textarea");
              textArea.value = text;
              textArea.style.position = "fixed";
              textArea.style.left = "-999999px";
              document.body.appendChild(textArea);
              textArea.select();
              try {
                document.execCommand("copy");
                document.body.removeChild(textArea);
                showToast(`${buttonText} copied to clipboard!`);
              } catch (err) {
                document.body.removeChild(textArea);
                throw new Error("Copy command not supported");
              }
            } else {
              await navigator.clipboard.writeText(text);
              showToast(`${buttonText} copied to clipboard!`);
            }

            // Show warning if credentials are included
            if (hasAuth) {
              setTimeout(() => {
                showToast(
                  "Warning: Authentication credentials included in copied content",
                  TOAST_WARNING_DURATION,
                  "warning",
                );
              }, TOAST_WARNING_DELAY);
            }
          } catch (err) {
            console.error("Failed to copy to clipboard:", err);
            showToast("Failed to copy to clipboard. Please copy manually.", 2000);
          }
        };

        // Create title
        const title = document.createElement("div");
        title.className = "yasqe_sharePopup_title";
        title.textContent = "Share Query";
        popup.appendChild(title);

        // Create button container
        const buttonContainer = document.createElement("div");
        buttonContainer.className = "yasqe_sharePopup_buttons";
        popup.appendChild(buttonContainer);

        // URL button
        const urlBtn = document.createElement("button");
        urlBtn.innerText = "Copy URL";
        urlBtn.className = "yasqe_btn yasqe_btn-sm yasqe_shareBtn";
        buttonContainer.appendChild(urlBtn);
        urlBtn.onclick = async () => {
          if (!this.config.createShareableLink) return;
          const url = this.config.createShareableLink(this);
          await copyToClipboard(url, "URL");
        };

        // URL Shorten button (if configured)
        const createShortLink = this.config.createShortLink;
        if (createShortLink) {
          const shortenBtn = document.createElement("button");
          shortenBtn.innerText = "Shorten URL";
          shortenBtn.className = "yasqe_btn yasqe_btn-sm yasqe_shareBtn";
          buttonContainer.appendChild(shortenBtn);
          shortenBtn.onclick = async () => {
            shortenBtn.disabled = true;
            shortenBtn.innerText = "Shortening...";
            try {
              if (!this.config.createShareableLink) return;
              const longUrl = this.config.createShareableLink(this);
              const shortUrl = await createShortLink(this, longUrl);
              await copyToClipboard(shortUrl, "Shortened URL");
              shortenBtn.innerText = "Shorten URL";
              shortenBtn.disabled = false;
            } catch (err) {
              shortenBtn.innerText = "Shorten URL";
              shortenBtn.disabled = false;
              let errorMsg = "Failed to shorten URL";
              if (typeof err === "string" && err.length !== 0) {
                errorMsg = err;
              } else if ((err as any).message && (err as any).message.length !== 0) {
                errorMsg = (err as any).message;
              }
              showToast(errorMsg, 3000);
            }
          };
        }

        // cURL button
        const curlBtn = document.createElement("button");
        curlBtn.innerText = "Copy cURL";
        curlBtn.className = "yasqe_btn yasqe_btn-sm yasqe_shareBtn";
        buttonContainer.appendChild(curlBtn);
        curlBtn.onclick = async () => {
          const curlString = this.getAsCurlString();
          const hasAuth = this.hasAuthenticationCredentials();
          await copyToClipboard(curlString, "cURL command", hasAuth);
        };

        // PowerShell button
        const psBtn = document.createElement("button");
        psBtn.innerText = "Copy PowerShell";
        psBtn.className = "yasqe_btn yasqe_btn-sm yasqe_shareBtn";
        buttonContainer.appendChild(psBtn);
        psBtn.onclick = async () => {
          const psString = this.getAsPowerShellString();
          const hasAuth = this.hasAuthenticationCredentials();
          await copyToClipboard(psString, "PowerShell command", hasAuth);
        };

        // wget button
        const wgetBtn = document.createElement("button");
        wgetBtn.innerText = "Copy wget";
        wgetBtn.className = "yasqe_btn yasqe_btn-sm yasqe_shareBtn";
        buttonContainer.appendChild(wgetBtn);
        wgetBtn.onclick = async () => {
          const wgetString = this.getAsWgetString();
          const hasAuth = this.hasAuthenticationCredentials();
          await copyToClipboard(wgetString, "wget command", hasAuth);
        };

        // Position popup after layout is complete
        const positionPopup = () => {
          if (!popup) return;
          const buttonsRect = buttons.getBoundingClientRect();
          const popupHeight = popup.offsetHeight || 300; // Estimated height
          const viewportHeight = window.innerHeight;
          const spaceAbove = buttonsRect.top;
          const spaceBelow = viewportHeight - buttonsRect.bottom;

          // If there's enough space above (with some padding), position above
          // Otherwise position below (will use scrolling if needed)
          if (spaceAbove >= popupHeight + 20) {
            popup.style.bottom = (buttons.clientHeight || 46) + "px";
            popup.style.top = "auto";
            popup.style.right = "0px";
          } else {
            // Not enough space above, use fixed positioning at top of viewport
            popup.style.position = "fixed";
            popup.style.bottom = "auto";
            popup.style.top = "20px";
            popup.style.right = "20px";
          }
        };

        if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
          window.requestAnimationFrame(positionPopup);
        } else {
          // Fallback for environments without requestAnimationFrame
          setTimeout(positionPopup, 0);
        }
      };
    }

    /**
     * Draw save buttons (THIRD)
     */
    const saveBtnWrapper = document.createElement("div");
    addClass(saveBtnWrapper, "yasqe_saveWrapper");
    saveBtnWrapper.style.display = "none"; // Hidden by default, shown when workspace is configured
    this.saveBtnWrapper = saveBtnWrapper;

    const saveManagedBtn = document.createElement("button");
    addClass(saveManagedBtn, "yasqe_saveManagedButton");
    const saveManagedIcon = document.createElement("i");
    addClass(saveManagedIcon, "fas");
    addClass(saveManagedIcon, "fa-database");
    saveManagedIcon.setAttribute("aria-hidden", "true");
    saveManagedBtn.appendChild(saveManagedIcon);
    saveManagedBtn.title = "Save as managed query";
    saveManagedBtn.setAttribute("aria-label", "Save as managed query");
    saveManagedBtn.onclick = () => {
      this.emit("saveManagedQuery");
    };
    saveBtnWrapper.appendChild(saveManagedBtn);

    const saveRqBtn = document.createElement("button");
    addClass(saveRqBtn, "yasqe_saveRqButton");
    const saveRqIcon = document.createElement("i");
    addClass(saveRqIcon, "fas");
    addClass(saveRqIcon, "fa-file-download");
    saveRqIcon.setAttribute("aria-hidden", "true");
    saveRqBtn.appendChild(saveRqIcon);
    saveRqBtn.title = "Save as .rq file";
    saveRqBtn.setAttribute("aria-label", "Save as .rq file");
    saveRqBtn.onclick = () => {
      this.emit("downloadRqFile");
    };
    saveBtnWrapper.appendChild(saveRqBtn);

    buttons.appendChild(saveBtnWrapper);

    /**
     * Draw format btn (FOURTH)
     */
    if (this.config.showFormatButton) {
      const formatBtn = document.createElement("button");
      addClass(formatBtn, "yasqe_formatButton");
      const formatIcon = document.createElement("i");
      addClass(formatIcon, "fas");
      addClass(formatIcon, "fa-align-left");
      formatIcon.setAttribute("aria-hidden", "true");
      formatBtn.appendChild(formatIcon);
      formatBtn.onclick = () => {
        this.format();
      };
      formatBtn.title = "Format query (Shift+Ctrl+F)";
      formatBtn.setAttribute("aria-label", "Format query");
      buttons.appendChild(formatBtn);
    }

    /**
     * Draw map btn (FIFTH)
     */
    if (this.config.showMapButton) {
      this.mapBtn = document.createElement("button");
      addClass(this.mapBtn, "yasqe_mapButton");
      const mapIcon = document.createElement("i");
      addClass(mapIcon, "fas");
      addClass(mapIcon, "fa-map-location-dot");
      mapIcon.setAttribute("aria-hidden", "true");
      this.mapBtn.appendChild(mapIcon);
      this.mapBtn.onclick = (event: MouseEvent) => {
        this.toggleMapPopup(buttons, { x: event.clientX, y: event.clientY });
      };
      this.mapBtn.title = "Open map";
      this.mapBtn.setAttribute("aria-label", "Open map");
      buttons.appendChild(this.mapBtn);
    }

    /**
     * Draw fullscreen btn (SIXTH)
     */
    this.fullscreenBtn = document.createElement("button");
    addClass(this.fullscreenBtn, "yasqe_fullscreenButton");
    const fullscreenIcon = document.createElement("i");
    addClass(fullscreenIcon, "fas");
    addClass(fullscreenIcon, "fa-expand");
    addClass(fullscreenIcon, "fullscreenIcon");
    fullscreenIcon.setAttribute("aria-hidden", "true");
    this.fullscreenBtn.appendChild(fullscreenIcon);
    const fullscreenExitIcon = document.createElement("i");
    addClass(fullscreenExitIcon, "fas");
    addClass(fullscreenExitIcon, "fa-compress");
    addClass(fullscreenExitIcon, "fullscreenExitIcon");
    fullscreenExitIcon.setAttribute("aria-hidden", "true");
    this.fullscreenBtn.appendChild(fullscreenExitIcon);
    this.fullscreenBtn.onclick = () => {
      this.toggleFullscreen();
    };
    this.fullscreenBtn.title = "Toggle fullscreen (F11)";
    this.fullscreenBtn.setAttribute("aria-label", "Toggle fullscreen");
    buttons.appendChild(this.fullscreenBtn);

    /**
     * Draw hamburger menu button and dropdown (for mobile)
     */
    this.hamburgerBtn = document.createElement("button");
    addClass(this.hamburgerBtn, "yasqe_hamburgerButton");
    const hamburgerIcon = document.createElement("i");
    addClass(hamburgerIcon, "fas");
    addClass(hamburgerIcon, "fa-bars");
    hamburgerIcon.setAttribute("aria-hidden", "true");
    this.hamburgerBtn.appendChild(hamburgerIcon);
    this.hamburgerBtn.title = "More options";
    this.hamburgerBtn.setAttribute("aria-label", "More options");
    this.hamburgerBtn.setAttribute("aria-expanded", "false");
    buttons.appendChild(this.hamburgerBtn);

    // Create hamburger menu
    this.hamburgerMenu = document.createElement("div");
    this.hamburgerMenu.className = "yasqe_hamburgerMenu";
    buttons.appendChild(this.hamburgerMenu);

    // Add menu items
    if (this.config.createShareableLink) {
      const shareItem = document.createElement("button");
      shareItem.className = "yasqe_hamburgerMenuItem";
      const shareIconMenu = document.createElement("i");
      addClass(shareIconMenu, "fas");
      addClass(shareIconMenu, "fa-share-nodes");
      shareIconMenu.setAttribute("aria-hidden", "true");
      shareItem.appendChild(shareIconMenu);
      const shareLabel = document.createElement("span");
      shareLabel.textContent = "Share";
      shareItem.appendChild(shareLabel);
      shareItem.onclick = () => {
        this.closeHamburgerMenu();
        this.shareBtn?.click();
      };
      this.hamburgerMenu.appendChild(shareItem);
    }

    const saveManagedItem = document.createElement("button");
    saveManagedItem.className = "yasqe_hamburgerMenuItem";
    const saveManagedIconMenu = document.createElement("i");
    addClass(saveManagedIconMenu, "fas");
    addClass(saveManagedIconMenu, "fa-database");
    saveManagedIconMenu.setAttribute("aria-hidden", "true");
    saveManagedItem.appendChild(saveManagedIconMenu);
    const saveManagedLabel = document.createElement("span");
    saveManagedLabel.textContent = "Save as managed query";
    saveManagedItem.appendChild(saveManagedLabel);
    saveManagedItem.onclick = () => {
      this.closeHamburgerMenu();
      this.emit("saveManagedQuery");
    };
    this.hamburgerMenu.appendChild(saveManagedItem);

    const saveRqItem = document.createElement("button");
    saveRqItem.className = "yasqe_hamburgerMenuItem";
    const saveRqIconMenu = document.createElement("i");
    addClass(saveRqIconMenu, "fas");
    addClass(saveRqIconMenu, "fa-file-download");
    saveRqIconMenu.setAttribute("aria-hidden", "true");
    saveRqItem.appendChild(saveRqIconMenu);
    const saveRqLabel = document.createElement("span");
    saveRqLabel.textContent = "Save as .rq file";
    saveRqItem.appendChild(saveRqLabel);
    saveRqItem.onclick = () => {
      this.closeHamburgerMenu();
      this.emit("downloadRqFile");
    };
    this.hamburgerMenu.appendChild(saveRqItem);

    if (this.config.showFormatButton) {
      const formatItem = document.createElement("button");
      formatItem.className = "yasqe_hamburgerMenuItem";
      const formatIconMenu = document.createElement("i");
      addClass(formatIconMenu, "fas");
      addClass(formatIconMenu, "fa-align-left");
      formatIconMenu.setAttribute("aria-hidden", "true");
      formatItem.appendChild(formatIconMenu);
      const formatLabel = document.createElement("span");
      formatLabel.textContent = "Format";
      formatItem.appendChild(formatLabel);
      formatItem.onclick = () => {
        this.closeHamburgerMenu();
        this.format();
      };
      this.hamburgerMenu.appendChild(formatItem);
    }

    if (this.config.showMapButton) {
      const mapItem = document.createElement("button");
      mapItem.className = "yasqe_hamburgerMenuItem";
      const mapIconMenu = document.createElement("i");
      addClass(mapIconMenu, "fas");
      addClass(mapIconMenu, "fa-map-location-dot");
      mapIconMenu.setAttribute("aria-hidden", "true");
      mapItem.appendChild(mapIconMenu);
      const mapLabel = document.createElement("span");
      mapLabel.textContent = "Open map";
      mapItem.appendChild(mapLabel);
      mapItem.onclick = (event: MouseEvent) => {
        this.closeHamburgerMenu();
        this.toggleMapPopup(buttons, { x: event.clientX, y: event.clientY });
      };
      this.hamburgerMenu.appendChild(mapItem);
    }

    const fullscreenItem = document.createElement("button");
    fullscreenItem.className = "yasqe_hamburgerMenuItem";
    const fullscreenIconMenu = document.createElement("i");
    addClass(fullscreenIconMenu, "fas");
    addClass(fullscreenIconMenu, "fa-expand");
    fullscreenIconMenu.setAttribute("aria-hidden", "true");
    fullscreenItem.appendChild(fullscreenIconMenu);
    const fullscreenLabel = document.createElement("span");
    fullscreenLabel.textContent = "Fullscreen";
    fullscreenItem.appendChild(fullscreenLabel);
    fullscreenItem.onclick = () => {
      this.closeHamburgerMenu();
      this.toggleFullscreen();
    };
    this.hamburgerMenu.appendChild(fullscreenItem);

    // Toggle hamburger menu
    this.hamburgerBtn.onclick = (e) => {
      e.stopPropagation();
      this.toggleHamburgerMenu();
    };

    // Close hamburger menu when clicking outside
    document.addEventListener("click", (e) => {
      if (
        this.hamburgerMenu &&
        this.hamburgerBtn &&
        !this.hamburgerMenu.contains(e.target as Node) &&
        !this.hamburgerBtn.contains(e.target as Node)
      ) {
        this.closeHamburgerMenu();
      }
    });
  }

  private toggleHamburgerMenu() {
    if (!this.hamburgerMenu || !this.hamburgerBtn) return;
    const isActive = this.hamburgerMenu.classList.contains("active");
    if (isActive) {
      this.closeHamburgerMenu();
    } else {
      addClass(this.hamburgerMenu, "active");
      this.hamburgerBtn.setAttribute("aria-expanded", "true");
    }
  }

  private closeHamburgerMenu() {
    if (!this.hamburgerMenu || !this.hamburgerBtn) return;
    removeClass(this.hamburgerMenu, "active");
    this.hamburgerBtn.setAttribute("aria-expanded", "false");
  }
  private toggleMapPopup(buttons: HTMLDivElement, anchorPoint?: { x: number; y: number }) {
    if (this.mapPopup) {
      this.closeMapPopupHandler?.();
      return;
    }
    this.createMapPopup(buttons, anchorPoint);
  }

  private createMapPopup(buttons: HTMLDivElement, anchorPoint?: { x: number; y: number }) {
    this.mapPopup = document.createElement("div");
    this.mapPopup.className = "yasqe_mapPopup";
    buttons.appendChild(this.mapPopup);

    const header = document.createElement("div");
    header.className = "yasqe_mapPopup_header";
    const title = document.createElement("div");
    title.className = "yasqe_mapPopup_title";
    title.textContent = "Create WKT";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className = "yasqe_mapPopup_close";
    closeBtn.setAttribute("aria-label", "Close map");
    closeBtn.innerHTML = "&times;";
    header.appendChild(closeBtn);
    this.mapPopup.appendChild(header);

    const mapWrapper = document.createElement("div");
    mapWrapper.className = "yasqe_mapPopup_map";
    this.mapPopup.appendChild(mapWrapper);

    const mapContainer = document.createElement("div");
    mapContainer.style.height = "100%";
    mapContainer.style.width = "100%";
    mapWrapper.appendChild(mapContainer);

    const geometryControls = document.createElement("div");
    geometryControls.className = "yasqe_mapPopup_geometryControls leaflet-bar";
    mapWrapper.appendChild(geometryControls);

    const hint = document.createElement("div");
    hint.className = "yasqe_mapPopup_hint";
    hint.textContent = "Click the map to add coordinates";
    this.mapPopup.appendChild(hint);

    const preview = document.createElement("textarea");
    preview.className = "yasqe_mapPopup_preview";
    preview.readOnly = true;
    preview.rows = 2;
    this.mapPopup.appendChild(preview);

    const actions = document.createElement("div");
    actions.className = "yasqe_mapPopup_actions";
    const undoBtn = document.createElement("button");
    undoBtn.className = "yasqe_btn yasqe_btn-sm";
    undoBtn.textContent = "Undo";
    const clearBtn = document.createElement("button");
    clearBtn.className = "yasqe_btn yasqe_btn-sm";
    clearBtn.textContent = "Clear";
    const insertBtn = document.createElement("button");
    insertBtn.className = "yasqe_btn yasqe_btn-sm";
    insertBtn.textContent = "Insert WKT";
    actions.appendChild(undoBtn);
    actions.appendChild(clearBtn);
    actions.appendChild(insertBtn);
    this.mapPopup.appendChild(actions);

    let geometryType: WktGeometryType = "POINT";
    let coordinates: WktCoordinate[] = [];
    let marker: L.Marker | undefined;
    let shape: L.Polyline | L.Polygon | undefined;
    const geometryButtons: Partial<Record<WktGeometryType, HTMLButtonElement>> = {};

    const getMapAccentColor = () => {
      const accent = getComputedStyle(this.rootEl).getPropertyValue("--yasgui-accent-color").trim();
      return accent || "#337ab7";
    };

    const map = L.map(mapContainer, {
      zoomControl: true,
      attributionControl: true,
    }).setView([51.505, -0.09], 2);
    map.getContainer().style.cursor = "crosshair";
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    L.DomEvent.disableClickPropagation(geometryControls);
    L.DomEvent.disableScrollPropagation(geometryControls);

    const updatePreview = () => {
      const wkt = coordinatesToWkt(geometryType, coordinates);
      preview.value = wkt || "";
      insertBtn.disabled = !wkt;
      undoBtn.disabled = coordinates.length === 0;
      clearBtn.disabled = coordinates.length === 0;
    };

    const redrawGeometry = () => {
      if (marker) {
        map.removeLayer(marker);
        marker = undefined;
      }
      if (shape) {
        map.removeLayer(shape);
        shape = undefined;
      }

      const latLngs = coordinates.map((coord) => L.latLng(coord.lat, coord.lng));
      const accentColor = getMapAccentColor();
      if (geometryType === "POINT" && latLngs.length > 0) {
        marker = L.marker(latLngs[latLngs.length - 1]).addTo(map);
      } else if (geometryType === "LINESTRING" && latLngs.length > 0) {
        shape = L.polyline(latLngs, { color: accentColor }).addTo(map);
      } else if (geometryType === "POLYGON" && latLngs.length > 0) {
        shape = L.polygon(latLngs, { color: accentColor }).addTo(map);
      }

      updatePreview();
    };

    const updateGeometryButtons = () => {
      for (const type of ["POINT", "LINESTRING", "POLYGON"] as WktGeometryType[]) {
        const button = geometryButtons[type];
        if (!button) continue;
        button.classList.toggle("active", type === geometryType);
        button.setAttribute("aria-pressed", type === geometryType ? "true" : "false");
      }
    };

    const createGeometryButton = (type: WktGeometryType, iconClass: string, label: string) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "yasqe_mapPopup_geometryBtn";
      button.title = label;
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-pressed", "false");
      const icon = document.createElement("i");
      addClass(icon, "fas");
      addClass(icon, iconClass);
      icon.setAttribute("aria-hidden", "true");
      button.appendChild(icon);
      button.onclick = (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (geometryType === type) return;
        geometryType = type;
        coordinates = [];
        updateGeometryButtons();
        redrawGeometry();
      };
      geometryControls.appendChild(button);
      return button;
    };

    geometryButtons.POINT = createGeometryButton("POINT", "fa-location-dot", "Point");
    geometryButtons.LINESTRING = createGeometryButton("LINESTRING", "fa-slash", "LineString");
    geometryButtons.POLYGON = createGeometryButton("POLYGON", "fa-draw-polygon", "Polygon");
    updateGeometryButtons();

    const closePopup = () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.removeEventListener("click", closeOnOutsideClick, true);
      map.remove();
      this.mapPopup?.remove();
      this.mapPopup = undefined;
      this.closeMapPopupHandler = undefined;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePopup();
      }
    };

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!this.mapPopup) return;
      if (this.mapPopup.contains(event.target as Node) || this.mapBtn?.contains(event.target as Node)) return;
      closePopup();
    };

    map.on("click", (event: L.LeafletMouseEvent) => {
      const coordinate: WktCoordinate = { lat: event.latlng.lat, lng: event.latlng.lng };
      if (geometryType === "POINT") {
        coordinates = [coordinate];
      } else {
        coordinates.push(coordinate);
      }
      redrawGeometry();
    });

    undoBtn.onclick = () => {
      coordinates.pop();
      redrawGeometry();
    };

    clearBtn.onclick = () => {
      coordinates = [];
      redrawGeometry();
    };

    insertBtn.onclick = () => {
      const wkt = coordinatesToWkt(geometryType, coordinates);
      if (!wkt) return;
      this.replaceSelection(wrapWktLiteral(wkt));
      closePopup();
    };

    closeBtn.onclick = () => closePopup();
    this.closeMapPopupHandler = closePopup;

    document.addEventListener("keydown", handleKeyDown);
    document.body.addEventListener("click", closeOnOutsideClick, true);

    const positionPopup = () => {
      if (!this.mapPopup) return;
      const popupWidth = this.mapPopup.offsetWidth || this.mapPopup.scrollWidth || 520;
      const popupHeight = this.mapPopup.offsetHeight || this.mapPopup.scrollHeight || this.mapPopup.clientHeight;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      this.mapPopup.style.position = "fixed";
      this.mapPopup.style.bottom = "auto";

      if (anchorPoint) {
        const padding = 20;
        let left = anchorPoint.x + 12;
        let top = anchorPoint.y + 12;
        if (left + popupWidth > viewportWidth - padding) {
          left = Math.max(padding, anchorPoint.x - popupWidth - 12);
        }
        if (top + popupHeight > viewportHeight - padding) {
          top = Math.max(padding, anchorPoint.y - popupHeight - 12);
        }
        this.mapPopup.style.left = `${Math.max(padding, left)}px`;
        this.mapPopup.style.top = `${Math.max(padding, top)}px`;
        this.mapPopup.style.right = "auto";
        return;
      }

      const buttonsRect = buttons.getBoundingClientRect();
      const fallbackLeft = Math.min(viewportWidth - popupWidth - 20, Math.max(20, buttonsRect.right - popupWidth));
      this.mapPopup.style.left = `${Math.max(20, fallbackLeft)}px`;
      this.mapPopup.style.top = "20px";
      this.mapPopup.style.right = "auto";
    };

    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        positionPopup();
        map.invalidateSize();
      });
    } else {
      setTimeout(() => {
        positionPopup();
        map.invalidateSize();
      }, 0);
    }

    redrawGeometry();
  }

  public toggleMapWidget(anchorPoint?: { x: number; y: number }) {
    const buttons = this.getWrapperElement().querySelector(".yasqe_buttons");
    if (!buttons || !(buttons instanceof HTMLDivElement)) return;
    this.toggleMapPopup(buttons, anchorPoint);
  }

  public toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
    if (this.isFullscreen) {
      addClass(this.rootEl, "fullscreen");
      this.fullscreenBtn?.setAttribute("title", "Exit fullscreen (F11)");
    } else {
      removeClass(this.rootEl, "fullscreen");
      this.fullscreenBtn?.setAttribute("title", "Toggle fullscreen (F11)");
    }
    this.refresh();
  }
  public getIsFullscreen() {
    return this.isFullscreen;
  }

  private insertSnippet(code: string) {
    const doc = this.getDoc();
    const cursor = doc.getCursor();
    doc.replaceRange(code, cursor);
    // Move cursor to end of inserted code
    const lines = code.split("\n");
    const lastLine = lines[lines.length - 1];
    doc.setCursor({
      line: cursor.line + lines.length - 1,
      ch: lines.length === 1 ? cursor.ch + lastLine.length : lastLine.length,
    });
    this.focus();
  }

  private drawSnippetsBar() {
    // Check if snippets bar should be shown (now using global config only)
    const shouldShow = this.config.showSnippetsBar && this.config.snippets.length > 0;

    if (!shouldShow) {
      // Remove existing bar if present
      if (this.snippetsBar) {
        this.snippetsBar.remove();
        this.snippetsBar = undefined;
      }
      return;
    }

    // Create snippets bar if it doesn't exist
    if (!this.snippetsBar) {
      this.snippetsBar = document.createElement("div");
      addClass(this.snippetsBar, "yasqe_snippetsBar");
      // Insert before the CodeMirror wrapper element
      const cmWrapper = this.getWrapperElement();
      cmWrapper.parentElement?.insertBefore(this.snippetsBar, cmWrapper);
    }

    // Clear existing content
    this.snippetsBar.innerHTML = "";

    const snippets = this.config.snippets;

    // Create a container for visible items
    const visibleContainer = document.createElement("div");
    addClass(visibleContainer, "yasqe_snippetsVisible");

    // Create all buttons/dropdowns
    const allItems: HTMLElement[] = [];

    // Group snippets by group property for all snippets (not just >10)
    const grouped: { [group: string]: Snippet[] } = {};
    const ungrouped: Snippet[] = [];

    snippets.forEach((snippet) => {
      if (snippet.group) {
        if (!grouped[snippet.group]) grouped[snippet.group] = [];
        grouped[snippet.group].push(snippet);
      } else {
        ungrouped.push(snippet);
      }
    });

    // Create dropdown for each group
    Object.keys(grouped).forEach((groupName) => {
      const dropdown = document.createElement("div");
      addClass(dropdown, "yasqe_snippetDropdown");

      const dropdownBtn = document.createElement("button");
      addClass(dropdownBtn, "yasqe_snippetDropdownButton");
      dropdownBtn.textContent = groupName + " ";
      const chevron = document.createElement("i");
      addClass(chevron, "fas");
      addClass(chevron, "fa-chevron-down");
      addClass(chevron, "chevronIcon");
      chevron.setAttribute("aria-hidden", "true");
      dropdownBtn.appendChild(chevron);
      dropdownBtn.setAttribute("aria-label", `${groupName} snippets`);
      dropdownBtn.setAttribute("aria-expanded", "false");

      const dropdownContent = document.createElement("div");
      addClass(dropdownContent, "yasqe_snippetDropdownContent");
      dropdownContent.setAttribute("role", "menu");

      grouped[groupName].forEach((snippet) => {
        const item = document.createElement("button");
        addClass(item, "yasqe_snippetDropdownItem");
        item.textContent = snippet.label;
        item.title = snippet.code;
        item.setAttribute("role", "menuitem");
        item.onclick = () => {
          this.insertSnippet(snippet.code);
          dropdownContent.style.display = "none";
          dropdownBtn.setAttribute("aria-expanded", "false");
        };
        dropdownContent.appendChild(item);
      });

      dropdownBtn.onclick = (e) => {
        e.stopPropagation();
        const isOpen = dropdownContent.style.display === "block";
        // Close all other dropdowns
        const allDropdowns = this.snippetsBar!.querySelectorAll(".yasqe_snippetDropdownContent");
        allDropdowns.forEach((dd) => {
          (dd as HTMLElement).style.display = "none";
        });
        const allButtons = this.snippetsBar!.querySelectorAll(".yasqe_snippetDropdownButton");
        allButtons.forEach((btn) => btn.setAttribute("aria-expanded", "false"));

        // Toggle this dropdown
        if (!isOpen) {
          dropdownContent.style.display = "block";
          dropdownBtn.setAttribute("aria-expanded", "true");
        }
      };

      dropdown.appendChild(dropdownBtn);
      dropdown.appendChild(dropdownContent);
      allItems.push(dropdown);
    });

    // Add ungrouped snippets as individual buttons
    ungrouped.forEach((snippet) => {
      const btn = document.createElement("button");
      addClass(btn, "yasqe_snippetButton");
      btn.textContent = snippet.label;
      btn.title = snippet.code;
      btn.setAttribute("aria-label", `Insert ${snippet.label} snippet`);
      btn.onclick = () => this.insertSnippet(snippet.code);
      allItems.push(btn);
    });

    // Add all items to visible container initially
    allItems.forEach((item) => visibleContainer.appendChild(item));
    this.snippetsBar.appendChild(visibleContainer);

    // Create "Show More" dropdown (initially hidden)
    const showMoreDropdown = document.createElement("div");
    addClass(showMoreDropdown, "yasqe_snippetDropdown", "yasqe_showMore");
    showMoreDropdown.style.display = "none";

    const showMoreBtn = document.createElement("button");
    addClass(showMoreBtn, "yasqe_snippetDropdownButton", "yasqe_showMoreButton");
    showMoreBtn.textContent = "More ";
    const chevron = document.createElement("i");
    addClass(chevron, "fas");
    addClass(chevron, "fa-chevron-down");
    addClass(chevron, "chevronIcon");
    chevron.setAttribute("aria-hidden", "true");
    showMoreBtn.appendChild(chevron);
    showMoreBtn.setAttribute("aria-label", "Show more snippets");
    showMoreBtn.setAttribute("aria-expanded", "false");

    const showMoreContent = document.createElement("div");
    addClass(showMoreContent, "yasqe_snippetDropdownContent", "yasqe_showMoreContent");
    showMoreContent.setAttribute("role", "menu");

    showMoreBtn.onclick = (e) => {
      e.stopPropagation();
      const isOpen = showMoreContent.style.display === "block";
      // Close all other dropdowns
      const allDropdowns = this.snippetsBar!.querySelectorAll(".yasqe_snippetDropdownContent");
      allDropdowns.forEach((dd) => {
        if (dd !== showMoreContent) {
          (dd as HTMLElement).style.display = "none";
        }
      });
      const allButtons = this.snippetsBar!.querySelectorAll(".yasqe_snippetDropdownButton");
      allButtons.forEach((btn) => {
        if (btn !== showMoreBtn) {
          btn.setAttribute("aria-expanded", "false");
        }
      });

      // Toggle this dropdown
      if (!isOpen) {
        showMoreContent.style.display = "block";
        showMoreBtn.setAttribute("aria-expanded", "true");
      } else {
        showMoreContent.style.display = "none";
        showMoreBtn.setAttribute("aria-expanded", "false");
      }
    };

    showMoreDropdown.appendChild(showMoreBtn);
    showMoreDropdown.appendChild(showMoreContent);
    this.snippetsBar.appendChild(showMoreDropdown);

    // Create function to handle overflow detection
    const handleOverflow = () => {
      if (!this.snippetsBar) return;

      const containerWidth = this.snippetsBar.offsetWidth;
      const showMoreWidth = 80; // Approximate width for "Show More" button
      let availableWidth = containerWidth - showMoreWidth - 20; // 20px for padding/margin
      let currentWidth = 0;
      const overflowItems: { element: HTMLElement; snippet?: Snippet; groupName?: string }[] = [];

      // Check each item to see if it fits
      allItems.forEach((item, index) => {
        const itemWidth = item.offsetWidth + 5; // 5px gap

        if (currentWidth + itemWidth > availableWidth && index > 0) {
          // This item overflows, hide it and add to show more
          item.style.display = "none";

          // Find the corresponding snippet or group
          if (item.classList.contains("yasqe_snippetDropdown")) {
            // It's a group dropdown
            const groupBtn = item.querySelector(".yasqe_snippetDropdownButton");
            const groupName = groupBtn?.textContent?.trim().replace(" ", "") || "Group";
            overflowItems.push({ element: item, groupName });
          } else {
            // It's an individual button
            const snippet = ungrouped.find((s) => s.label === item.textContent);
            overflowItems.push({ element: item, snippet });
          }
        } else {
          currentWidth += itemWidth;
        }
      });

      // If there are overflow items, show the "Show More" button
      if (overflowItems.length > 0) {
        showMoreDropdown.style.display = "inline-block";

        // Populate show more content with proper grouping
        overflowItems.forEach(({ element, snippet, groupName }) => {
          if (groupName) {
            // It's a group - add a group header and its items
            const groupHeader = document.createElement("div");
            addClass(groupHeader, "yasqe_snippetGroupHeader");
            groupHeader.textContent = groupName;
            showMoreContent.appendChild(groupHeader);

            const groupItems = element.querySelectorAll(".yasqe_snippetDropdownItem");
            groupItems.forEach((item) => {
              const clonedItem = item.cloneNode(true) as HTMLElement;
              clonedItem.onclick = (item as HTMLElement).onclick;
              showMoreContent.appendChild(clonedItem);
            });
          } else if (snippet) {
            // It's an individual snippet
            const item = document.createElement("button");
            addClass(item, "yasqe_snippetDropdownItem");
            item.textContent = snippet.label;
            item.title = snippet.code;
            item.setAttribute("role", "menuitem");
            item.onclick = () => {
              this.insertSnippet(snippet.code);
              showMoreContent.style.display = "none";
              showMoreBtn.setAttribute("aria-expanded", "false");
            };
            showMoreContent.appendChild(item);
          }
        });
      }
    };

    // Run overflow detection on next frame
    requestAnimationFrame(handleOverflow);

    // Set up resize handler for overflow detection
    // Remove any existing handler first
    if (this.snippetsResizeHandler) {
      window.removeEventListener("resize", this.snippetsResizeHandler);
    }

    // Create and store the resize handler
    this.snippetsResizeHandler = () => {
      if (!this.snippetsBar) return;

      // Reset all items to visible first
      allItems.forEach((item) => (item.style.display = ""));
      showMoreDropdown.style.display = "none";
      showMoreContent.innerHTML = "";

      // Re-run overflow detection
      requestAnimationFrame(handleOverflow);
    };

    // Add the resize handler
    window.addEventListener("resize", this.snippetsResizeHandler);

    // Set up click handler for closing dropdowns when clicking outside
    // Remove any existing handler first
    if (this.snippetsClickHandler) {
      document.removeEventListener("click", this.snippetsClickHandler);
    }

    // Create and store the handler
    this.snippetsClickHandler = (e: MouseEvent) => {
      if (this.snippetsBar && !this.snippetsBar.contains(e.target as Node)) {
        const allDropdowns = this.snippetsBar.querySelectorAll(".yasqe_snippetDropdownContent");
        allDropdowns.forEach((dd) => {
          (dd as HTMLElement).style.display = "none";
        });
        const allButtons = this.snippetsBar.querySelectorAll(".yasqe_snippetDropdownButton");
        allButtons.forEach((btn) => btn.setAttribute("aria-expanded", "false"));
      }
    };

    // Add the handler
    document.addEventListener("click", this.snippetsClickHandler);
  }

  private drawResizer() {
    if (this.horizontalResizeWrapper) return;
    this.horizontalResizeWrapper = document.createElement("div");
    addClass(this.horizontalResizeWrapper, "horizontalResizeWrapper");
    const chip = document.createElement("div");
    addClass(chip, "horizontalResizeChip");
    this.horizontalResizeWrapper.appendChild(chip);
    this.horizontalResizeWrapper.addEventListener("mousedown", this.initDrag, false);
    this.horizontalResizeWrapper.addEventListener("dblclick", this.expandEditor);
    this.rootEl.appendChild(this.horizontalResizeWrapper);
  }
  private initDrag = () => {
    document.documentElement.addEventListener("mousemove", this.doDrag, false);
    document.documentElement.addEventListener("mouseup", this.stopDrag, false);
  };
  private calculateDragOffset(event: MouseEvent, rootEl: HTMLElement) {
    let parentOffset = 0;
    // offsetParent is, at the time of writing, a working draft. see https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/offsetParent
    if (rootEl.offsetParent) parentOffset = (rootEl.offsetParent as HTMLElement).offsetTop;
    let scrollOffset = 0;
    let parentElement = rootEl.parentElement;
    while (parentElement) {
      scrollOffset += parentElement.scrollTop;
      parentElement = parentElement.parentElement;
    }
    return event.clientY - parentOffset - this.rootEl.offsetTop + scrollOffset;
  }
  private doDrag = (event: MouseEvent) => {
    this.getWrapperElement().style.height = this.calculateDragOffset(event, this.rootEl) + "px";
  };
  private stopDrag = () => {
    document.documentElement.removeEventListener("mousemove", this.doDrag, false);
    document.documentElement.removeEventListener("mouseup", this.stopDrag, false);
    this.emit("resize", this.getWrapperElement().style.height);
    if (this.getStorageId() && this.persistentConfig) {
      // If there is no storage id there is no persistency wanted
      this.persistentConfig.editorHeight = this.getWrapperElement().style.height;
      this.saveQuery();
    }
    // Refresh the editor to make sure the 'hidden' lines are rendered
    this.refresh();
    // Trigger snippets overflow detection after resize
    if (this.snippetsResizeHandler) {
      this.snippetsResizeHandler();
    }
  };
  public duplicateLine() {
    const cur = this.getDoc().getCursor();
    if (cur) {
      const line = this.getDoc().getLine(cur.line);
      this.getDoc().replaceRange(line + "\n" + line, { ch: 0, line: cur.line }, { ch: line.length, line: cur.line });
    }
  }
  private updateQueryButton(status?: "valid" | "error") {
    if (!this.queryBtn) return;

    /**
     * Set query status (valid vs invalid)
     */
    if (this.config.queryingDisabled) {
      addClass(this.queryBtn, "query_disabled");
      this.queryBtn.title = this.config.queryingDisabled;
    } else {
      removeClass(this.queryBtn, "query_disabled");
      this.queryBtn.title = "Run query (Ctrl+Enter)";
      this.queryBtn.setAttribute("aria-label", "Run query");
    }
    if (!status) {
      status = this.queryValid ? "valid" : "error";
    }
    if (status != this.queryStatus) {
      //reset query status classnames
      removeClass(this.queryBtn, "query_" + this.queryStatus);
      addClass(this.queryBtn, "query_" + status);
      this.queryStatus = status;
    }

    /**
     * Set/remove spinner if needed and manage icon visibility
     */
    const isBusy = !!this.req;
    const hasError = status === "error";

    if (isBusy && this.queryBtn.className.indexOf("busy") < 0) {
      this.queryBtn.className = this.queryBtn.className += " busy";
    }
    if (!isBusy && this.queryBtn.className.indexOf("busy") >= 0) {
      this.queryBtn.className = this.queryBtn.className.replace("busy", "");
    }

    // Update button state classes for icon switching
    if (isBusy) {
      addClass(this.queryBtn, "state-loading");
      removeClass(this.queryBtn, "state-error");
      removeClass(this.queryBtn, "state-normal");
    } else if (hasError) {
      removeClass(this.queryBtn, "state-loading");
      addClass(this.queryBtn, "state-error");
      removeClass(this.queryBtn, "state-normal");
    } else {
      removeClass(this.queryBtn, "state-loading");
      removeClass(this.queryBtn, "state-error");
      addClass(this.queryBtn, "state-normal");
    }
  }
  public handleLocalStorageQuotaFull(_e: any) {
    console.warn("Localstorage quota exceeded. Clearing all queries");
    Yasqe.clearStorage();
  }

  public saveQuery() {
    const storageId = this.getStorageId();
    if (!storageId || !this.persistentConfig) return;
    this.persistentConfig.query = this.getValue();
    this.storage.set(storageId, this.persistentConfig, this.config.persistencyExpire, this.handleLocalStorageQuotaFull);
  }

  /**
   * Get SPARQL query props
   */
  public getQueryType() {
    return this.getOption("queryType");
  }
  public getQueryMode(): "update" | "query" {
    switch (this.getQueryType()) {
      case "INSERT":
      case "DELETE":
      case "LOAD":
      case "CLEAR":
      case "CREATE":
      case "DROP":
      case "COPY":
      case "MOVE":
      case "ADD":
        return "update";
      default:
        return "query";
    }
  }
  public getVariablesFromQuery() {
    //Use precise here. We want to be sure we use the most up to date state. If we're
    //not, we might get outdated info from the current query (creating loops such
    //as https://github.com/TriplyDB/YASGUI/issues/84)
    //on caveat: this function won't work when query is invalid (i.e. when typing)
    const token: Token = this.getTokenAt(
      { line: this.getDoc().lastLine(), ch: this.getDoc().getLine(this.getDoc().lastLine()).length },
      true,
    );
    const vars: string[] = [];
    for (var v in token.state.variables) {
      vars.push(v);
    }
    return vars.sort();
  }

  /**
   * Sparql-related tasks
   */
  private autoformatSelection(start: number, end: number): string {
    var text = this.getValue();
    text = text.substring(start, end);
    return Yasqe.autoformatString(text);
  }
  public static autoformatString(text: string): string {
    var breakAfterArray = [
      ["keyword", "ws", "string-2", "ws", "variable-3"], // i.e. prefix declaration
      ["keyword", "ws", "variable-3"], // i.e. base
    ];

    var breakBeforeCharacters = ["}"];

    var getBreakType = function (stringVal: string) {
      //first check the characters to break after
      if (stringVal === "{") return 1;
      if (stringVal === ".") return 1;
      if (stringVal === ";") {
        //it shouldnt be part of a group concat though.
        //To check this case, we need to check the previous char type in the stacktrace
        if (stackTrace.length > 2 && stackTrace[stackTrace.length - 2] === "punc") return 0;
        return 1;
      }

      //Now check which arrays to break after
      for (var i = 0; i < breakAfterArray.length; i++) {
        if (stackTrace.valueOf().toString() === breakAfterArray[i].valueOf().toString()) {
          return 1;
        }
      }
      for (var i = 0; i < breakBeforeCharacters.length; i++) {
        // don't want to issue 'breakbefore' AND 'breakafter', so check
        // current line
        if (currentLine.trim() !== "" && stringVal == breakBeforeCharacters[i]) {
          return -1;
        }
      }
      return 0;
    };
    var formattedQuery = "";
    var currentLine = "";
    var stackTrace: string[] = [];
    (<any>Yasqe).runMode(text, "sparql11", function (stringVal: string, type: string) {
      stackTrace.push(type);
      var breakType = getBreakType(stringVal);
      if (breakType != 0) {
        if (breakType == 1) {
          formattedQuery += stringVal + "\n";
          currentLine = "";
        } else {
          // (-1)
          formattedQuery += "\n" + stringVal;
          currentLine = stringVal;
        }
        stackTrace = [];
      } else {
        currentLine += stringVal;
        formattedQuery += stringVal;
      }
      if (stackTrace.length == 1 && stackTrace[0] == "sp-ws") stackTrace = [];
    });
    return formattedQuery.replace(/\n\s*\n/g, "\n").trim();
  }

  public commentLines() {
    var startLine = this.getDoc().getCursor("start").line;
    var endLine = this.getDoc().getCursor("end").line;
    var min = Math.min(startLine, endLine);
    var max = Math.max(startLine, endLine);

    // if all lines start with # (after whitespace), remove the comment. Otherwise add comment
    var linesAreCommented = true;
    for (var i = min; i <= max; i++) {
      var line = this.getDoc().getLine(i);
      var trimmedLine = line.trimStart();
      if (line.length > 0 && (trimmedLine.length === 0 || trimmedLine.substring(0, 1) !== "#")) {
        linesAreCommented = false;
        break;
      }
    }
    for (var i = min; i <= max; i++) {
      var line = this.getDoc().getLine(i);
      var trimmedLine = line.trimStart();
      var leadingWhitespace = line.length - trimmedLine.length;

      if (linesAreCommented && trimmedLine.length > 0) {
        // lines are commented, so remove the # character (and following space if present)
        var commentIndex = line.indexOf("#");
        if (commentIndex >= 0) {
          var removeLength = 1;
          // Also remove the space after # if present (e.g., "  # code" -> "  code")
          if (commentIndex + 1 < line.length && line.charAt(commentIndex + 1) === " ") {
            removeLength = 2;
          }
          this.getDoc().replaceRange(
            "",
            {
              line: i,
              ch: commentIndex,
            },
            {
              line: i,
              ch: commentIndex + removeLength,
            },
          );
        }
      } else if (!linesAreCommented && line.length > 0) {
        // Not all lines are commented, so add comments
        // Insert "# " after the leading whitespace
        this.getDoc().replaceRange("# ", {
          line: i,
          ch: leadingWhitespace,
        });
      }
    }
  }

  public autoformat() {
    if (!this.getDoc().somethingSelected()) this.execCommand("selectAll");
    const from = this.getDoc().getCursor("start");
    const to: Position = this.getDoc().getCursor("end");
    var absStart = this.getDoc().indexFromPos(from);
    var absEnd = this.getDoc().indexFromPos(to);
    // Insert additional line breaks where necessary according to the
    // mode's syntax

    const res = this.autoformatSelection(absStart, absEnd);

    // Replace and auto-indent the range
    this.operation(() => {
      this.getDoc().replaceRange(res, from, to);
      var startLine = this.getDoc().posFromIndex(absStart).line;
      var endLine = this.getDoc().posFromIndex(absStart + res.length).line;
      for (var i = startLine; i <= endLine; i++) {
        this.indentLine(i);
      }
    });
  }

  public formatQuery() {
    try {
      const currentQuery = this.getValue();
      const formatted = spfmt.format(currentQuery);
      this.setValue(formatted);
      // Collapse prefixes after formatting
      this.collapsePrefixes(true);
    } catch (error) {
      console.warn(
        "Failed to format SPARQL query using sparql-formatter. This may be due to syntax errors in the query. Falling back to legacy formatter.",
        error,
      );
      // If formatting fails, fall back to the built-in autoformat
      this.autoformat();
    }
  }

  public format() {
    const formatterType = this.persistentConfig?.formatterType || "sparql-formatter";
    if (formatterType === "legacy") {
      this.autoformat();
    } else {
      this.formatQuery();
    }
  }
  //values in the form of {?var: 'value'}, or [{?var: 'value'}]
  public getQueryWithValues(values: string | { [varName: string]: string } | Array<{ [varName: string]: string }>) {
    if (!values) return this.getValue();
    var injectString: string;
    if (typeof values === "string") {
      injectString = values;
    } else {
      //start building inject string
      if (!(values instanceof Array)) values = [values];
      var variables = values.reduce(function (vars, valueObj) {
        for (var v in valueObj) {
          vars[v] = v;
        }
        return vars;
      }, {});
      var varArray: string[] = [];
      for (var v in variables) {
        varArray.push(v);
      }

      if (!varArray.length) return this.getValue();
      //ok, we've got enough info to start building the string now
      injectString = "VALUES (" + varArray.join(" ") + ") {\n";
      values.forEach(function (valueObj) {
        injectString += "( ";
        varArray.forEach(function (variable) {
          injectString += valueObj[variable] || "UNDEF";
        });
        injectString += " )\n";
      });
      injectString += "}\n";
    }
    if (!injectString) return this.getValue();

    var newQuery = "";
    var injected = false;
    var gotSelect = false;
    (<any>Yasqe).runMode(
      this.getValue(),
      "sparql11",
      function (stringVal: string, className: string, _row: number, _col: number, _state: TokenizerState) {
        if (className === "keyword" && stringVal.toLowerCase() === "select") gotSelect = true;
        newQuery += stringVal;
        if (gotSelect && !injected && className === "punc" && stringVal === "{") {
          injected = true;
          //start injecting
          newQuery += "\n" + injectString;
        }
      },
    );
    return newQuery;
  }

  public getValueWithoutComments() {
    var cleanedQuery = "";
    (<any>Yasqe).runMode(this.getValue(), "sparql11", function (stringVal: string, className: string) {
      if (className != "comment") {
        cleanedQuery += stringVal;
      }
    });
    return cleanedQuery;
  }

  public setCheckSyntaxErrors(isEnabled: boolean) {
    this.config.syntaxErrorCheck = isEnabled;
    this.checkSyntax();
    this.checkConstructVariables();
  }
  public checkSyntax() {
    this.queryValid = true;

    this.clearGutter("gutterErrorBar");
    this.clearSyntaxErrorHighlight();

    var state: TokenizerState;
    for (var l = 0; l < this.getDoc().lineCount(); ++l) {
      var precise = false;
      if (!this.prevQueryValid) {
        // we don't want cached information in this case, otherwise the
        // previous error sign might still show up,
        // even though the syntax error might be gone already
        precise = true;
      }

      var token: Token = this.getTokenAt(
        {
          line: l,
          ch: this.getDoc().getLine(l).length,
        },
        precise,
      );
      var state = token.state;
      this.setOption("queryType", state.queryType);
      if (state.OK == false) {
        if (!this.config.syntaxErrorCheck) {
          //the library we use already marks everything as being an error. Overwrite this class attribute.
          const els = this.getWrapperElement().querySelectorAll(".sp-error");
          for (let i = 0; i < els.length; i++) {
            var el: any = els[i];
            if (el.style) el.style.color = "black";
          }
          //we don't want the gutter error, so return
          return;
        }

        const lineLength = this.getDoc().getLine(l).length;
        const startCh =
          typeof state.errorStartPos === "number"
            ? Math.max(0, Math.min(lineLength, state.errorStartPos))
            : Math.max(0, Math.min(lineLength, token.start));
        const fallbackEnd = token.string ? startCh + token.string.length : startCh + 1;
        const endCandidate = typeof state.errorEndPos === "number" ? state.errorEndPos : fallbackEnd;
        const endCh = Math.max(startCh + 1, Math.min(lineLength, endCandidate));
        if (endCh > startCh) {
          this.setSyntaxErrorHighlight({ line: l, ch: startCh }, { line: l, ch: endCh });
        }

        // Add gutter error icon
        const errorEl = document.createElement("i");
        errorEl.className = "fas fa-exclamation-circle parseErrorIcon";

        // Build tooltip message
        if (state.errorMsg) {
          tooltip(this, errorEl, escape(state.errorMsg));
        } else if (state.possibleCurrent && state.possibleCurrent.length > 0) {
          const expectedEncoded: string[] = [];
          state.possibleCurrent.forEach(function (expected) {
            expectedEncoded.push("<strong style='text-decoration:underline'>" + escape(expected) + "</strong>");
          });
          tooltip(this, errorEl, "This line is invalid. Expected: " + expectedEncoded.join(", "));
        } else {
          tooltip(this, errorEl, "Syntax error");
        }

        this.setGutterMarker(l, "gutterErrorBar", errorEl);

        // Also change run button to show error state
        if (this.queryBtn) {
          addClass(this.queryBtn, "query_error");
          this.queryBtn.title = "Query has syntax errors";
        }

        this.queryValid = false;
        break;
      }
    }
    if (this.queryValid) {
      if (this.queryBtn) {
        removeClass(this.queryBtn, "query_error");
        this.queryBtn.title = "Run query (Ctrl+Enter)";
      }
    }
  }

  public setCheckConstructVariables(isEnabled: boolean) {
    this.config.checkConstructVariables = isEnabled;
    if (!isEnabled) {
      // Clear any existing warnings when disabled
      this.clearGutter("gutterConstructWarning");
    } else {
      this.checkConstructVariables();
    }
  }

  public setSaveButtonVisible(visible: boolean) {
    if (this.saveBtnWrapper) {
      this.saveBtnWrapper.style.display = visible ? "inline-flex" : "none";
    }
  }

  public checkConstructVariables() {
    // Clear any existing warnings first
    this.clearGutter("gutterConstructWarning");

    // Only check if enabled, query is valid, and it's a CONSTRUCT query
    if (!this.config.checkConstructVariables || !this.queryValid || this.getQueryType() !== "CONSTRUCT") {
      return;
    }

    // Get the final state after parsing the entire query
    const lastLine = this.getDoc().lastLine();
    const token: Token = this.getTokenAt({ line: lastLine, ch: this.getDoc().getLine(lastLine).length }, true);

    const state = token.state as TokenizerState;

    // Check for undefined variables in CONSTRUCT template
    const undefinedVars: string[] = [];
    for (const varName in state.constructVariables) {
      if (!state.whereVariables[varName]) {
        undefinedVars.push(varName);
      }
    }

    if (undefinedVars.length === 0) {
      return;
    }

    // Find lines where undefined variables are used in CONSTRUCT template
    // Note: This iterates through all lines but filters by inConstructTemplate flag
    // For large queries, this could be optimized by tracking line ranges during tokenization
    for (let l = 0; l < this.getDoc().lineCount(); ++l) {
      const lineToken: Token = this.getTokenAt({ line: l, ch: this.getDoc().getLine(l).length }, true);
      const lineState = lineToken.state as TokenizerState;

      // Only mark variables in the CONSTRUCT template
      if (lineState.queryType === "CONSTRUCT" && lineState.inConstructTemplate) {
        const line = this.getDoc().getLine(l);
        // Check if this line contains any undefined variable (use word boundary to avoid partial matches)
        for (const undefinedVar of undefinedVars) {
          // Escape special regex characters in variable name
          // Use negative lookbehind/lookahead to ensure we match the full variable name
          // Variables can be followed by whitespace, punctuation, or end of line
          const escapedVar = undefinedVar.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const varRegex = new RegExp(`${escapedVar}(?![a-zA-Z0-9_])`);
          if (varRegex.test(line)) {
            const warningEl = document.createElement("i");
            warningEl.className = "fas fa-exclamation-triangle constructVariableWarning";
            tooltip(
              this,
              warningEl,
              "Variable <strong>" +
                escape(undefinedVar) +
                "</strong> is used in CONSTRUCT but not defined in WHERE clause",
            );
            this.setGutterMarker(l, "gutterConstructWarning", warningEl);
            break; // Only one marker per line
          }
        }
      }
    }
  }

  /**
   * Token management
   */

  public getCompleteToken(token?: Token, cur?: Position): Token {
    return getCompleteToken(this, token, cur);
  }
  public getPreviousNonWsToken(line: number, token: Token): Token {
    return getPreviousNonWsToken(this, line, token);
  }
  public getNextNonWsToken(lineNumber: number, charNumber?: number): Token | undefined {
    return getNextNonWsToken(this, lineNumber, charNumber);
  }
  /**
   * Notification management
   */
  private notificationEls: { [key: string]: HTMLDivElement } = {};

  /**
   * Shows notification
   * @param key reference to the notification
   * @param message the message to display
   */
  public showNotification(key: string, message: string) {
    if (!this.notificationEls[key]) {
      // We create one wrapper for each notification, since there is no interactivity with the container (yet) we don't need to keep a reference
      const notificationContainer = document.createElement("div");
      addClass(notificationContainer, "notificationContainer");
      this.getWrapperElement().appendChild(notificationContainer);

      // Create the actual notification element
      this.notificationEls[key] = document.createElement("div");
      addClass(this.notificationEls[key], "notification", "notif_" + key);
      notificationContainer.appendChild(this.notificationEls[key]);
    }
    // Hide others
    for (const notificationId in this.notificationEls) {
      if (notificationId !== key) this.hideNotification(notificationId);
    }
    const el = this.notificationEls[key];
    addClass(el, "active");
    el.innerText = message;
  }
  /**
   * Hides notification
   * @param key the identifier of the notification to hide
   */
  public hideNotification(key: string) {
    if (this.notificationEls[key]) {
      removeClass(this.notificationEls[key], "active");
    }
  }

  /**
   * Snippets management
   */
  public setSnippetsBarVisible(visible: boolean) {
    // Update config and redraw
    this.config.showSnippetsBar = visible;
    this.drawSnippetsBar();
  }

  public getSnippetsBarVisible(): boolean {
    return this.config.showSnippetsBar && this.config.snippets.length > 0;
  }

  public refreshSnippetsBar() {
    this.drawSnippetsBar();
    // Also trigger overflow detection after redrawing
    if (this.snippetsResizeHandler) {
      this.snippetsResizeHandler();
    }
  }

  /**
   * Autocompleter management
   */
  public enableCompleter(name: string): Promise<void> {
    if (!Yasqe.Autocompleters[name])
      return Promise.reject(new Error("Autocompleter " + name + " is not a registered autocompleter"));
    if (this.config.autocompleters.indexOf(name) < 0) this.config.autocompleters.push(name);
    const autocompleter = (this.autocompleters[name] = new Autocompleter.Completer(this, Yasqe.Autocompleters[name]));
    return autocompleter.initialize();
  }
  public disableCompleter(name: string) {
    this.config.autocompleters = this.config.autocompleters.filter((a) => a !== name);
    this.autocompleters[name] = undefined;
  }
  public autocomplete(fromAutoShow = false) {
    if (this.getDoc().somethingSelected()) return;
    const hintFn = this.buildHintFn(fromAutoShow);
    if (!hintFn) return;
    this.pendingHintFn = hintFn;
    openCompletion(this.view);
  }
  /**
   * Collects the hint functions of all completers that are valid at the current position and aggregates
   * them into a single hint function. Returns `undefined` when no completer applies.
   */
  private buildHintFn(fromAutoShow: boolean): HintFn | undefined {
    const hintFns: HintFn[] = [];
    for (const name of this.config.autocompleters) {
      const autocompleter = this.autocompleters[name];
      if (!autocompleter) continue;
      const hintFn = autocompleter.autocomplete(fromAutoShow);
      if (hintFn) hintFns.push(hintFn);
    }
    if (hintFns.length === 0) return undefined;

    return async (): Promise<HintList | undefined> => {
      const results = await Promise.all(hintFns.map((fn) => fn()));
      let aggregated: HintList | undefined;
      for (const result of results) {
        if (!result || !result.list || result.list.length === 0) continue;
        if (!aggregated) {
          aggregated = { list: [...result.list], from: result.from, to: result.to };
        } else {
          aggregated.list.push(...result.list);
        }
      }
      return aggregated;
    };
  }
  public isAutocompletionActive(): boolean {
    return isCompletionActive(this.view.state);
  }
  public hideAutocompletion() {
    hideCompletion(this.view);
  }

  /**
   * Prefix management
   */
  public collapsePrefixes(collapse = true) {
    const firstPrefixLine = findFirstPrefixLineInDoc(this.runner, this.view.state.doc);
    if (firstPrefixLine === undefined) return; //nothing to collapse
    const offset = this.view.state.doc.line(firstPrefixLine + 1).from;
    if (collapse) {
      foldAt(this.view, offset);
    } else {
      unfoldAt(this.view, offset);
    }
  }

  public getPrefixesFromQuery(): Prefixes {
    return getPrefixesFromQuery(this);
  }
  public addPrefixes(prefixes: string | Prefixes): void {
    return addPrefixes(this, prefixes);
  }
  public removePrefixes(prefixes: Prefixes): void {
    return removePrefixes(this, prefixes);
  }
  /**
   * @deprecated CodeMirror 6 positions the autocompletion tooltip itself. Kept for API compatibility.
   */
  public updateWidget() {
    // no-op
  }

  /**
   * Querying
   */
  public query(config?: Sparql.YasqeAjaxConfig) {
    if (this.config.queryingDisabled) return Promise.reject("Querying is disabled.");
    // Auto-format query before execution if enabled in persistent config
    if (this.persistentConfig?.autoformatOnQuery) {
      this.format();
    }
    // Abort previous request
    this.abortQuery();
    return Sparql.executeQuery(this, config);
  }
  public getUrlParams() {
    //first try hash
    let urlParams: queryString.ParsedQuery = {};
    if (window.location.hash.length > 1) {
      //firefox does some decoding if we're using window.location.hash (e.g. the + sign in contentType settings)
      //Don't want this. So simply get the hash string ourselves
      urlParams = queryString.parse(location.hash);
    }
    if ((!urlParams || !("query" in urlParams)) && window.location.search.length > 1) {
      //ok, then just try regular url params
      urlParams = queryString.parse(window.location.search);
    }
    return urlParams;
  }
  public configToQueryParams(): queryString.ParsedQuery {
    //extend existing link, so first fetch current arguments
    var urlParams: any = {};
    if (window.location.hash.length > 1) urlParams = queryString.parse(window.location.hash);
    urlParams["query"] = this.getValue();
    return urlParams;
  }
  public queryParamsToConfig(params: queryString.ParsedQuery) {
    if (params && params.query && typeof params.query === "string") {
      this.setValue(params.query);
    }
  }

  public getAsCurlString(config?: Sparql.YasqeAjaxConfig): string {
    return Sparql.getAsCurlString(this, config);
  }

  public getAsPowerShellString(config?: Sparql.YasqeAjaxConfig): string {
    return Sparql.getAsPowerShellString(this, config);
  }

  public getAsWgetString(config?: Sparql.YasqeAjaxConfig): string {
    return Sparql.getAsWgetString(this, config);
  }

  public hasAuthenticationCredentials(config?: Sparql.YasqeAjaxConfig): boolean {
    const ajaxConfig = Sparql.getAjaxConfig(this, config);
    return ajaxConfig ? Sparql.hasAuthenticationCredentials(ajaxConfig) : false;
  }

  public abortQuery() {
    if (this.req) {
      if (this.abortController) {
        this.abortController.abort();
      }
      this.emit("queryAbort", this, this.req);
    }
  }

  public expandEditor = () => {
    this.setSize(null, "100%");
  };

  public destroy() {
    // Abort running query
    this.abortQuery();
    this.closeMapPopupHandler?.();
    this.unregisterEventListeners();
    this.horizontalResizeWrapper?.removeEventListener("mousedown", this.initDrag, false);
    this.horizontalResizeWrapper?.removeEventListener("dblclick", this.expandEditor);
    if (this.snippetsClickHandler) {
      document.removeEventListener("click", this.snippetsClickHandler);
      this.snippetsClickHandler = undefined;
    }
    for (const autocompleter in this.autocompleters) {
      this.disableCompleter(autocompleter);
    }
    window.removeEventListener("hashchange", this.handleHashChange);
    this.destroyEditor();
    this.rootEl.remove();
  }

  /**
   * Statics
   */
  static Sparql = Sparql;
  /**
   * Tokenizes the given text using the SPARQL tokenizer, calling `callback` for every token with its
   * text and its style (`null` for whitespace/unstyled tokens). The `mode` argument is ignored and only
   * kept for backwards compatibility with the CodeMirror 5 `runMode` signature.
   */
  static runMode = (text: string, _mode: any, callback: (text: string, style: string | null) => void) =>
    runTokenizer(text, callback);
  static clearStorage() {
    const storage = new YStorage(Yasqe.storageNamespace);
    storage.removeNamespace();
  }

  static Autocompleters: { [name: string]: Autocompleter.CompleterConfig } = {};
  static registerAutocompleter(value: Autocompleter.CompleterConfig, enable = true) {
    const name = value.name;
    Yasqe.Autocompleters[name] = value;
    if (enable && Yasqe.defaults.autocompleters.indexOf(name) < 0) Yasqe.defaults.autocompleters.push(name);
  }
  static defaults = getDefaults();
  static forkAutocompleter(
    fromCompleter: string,
    newCompleter: { name: string } & Partial<Autocompleter.CompleterConfig>,
    enable = true,
  ) {
    if (!Yasqe.Autocompleters[fromCompleter]) throw new Error("Autocompleter " + fromCompleter + " does not exist");
    if (!newCompleter?.name) {
      throw new Error("Expected a name for newly registered autocompleter");
    }
    const name = newCompleter.name;
    Yasqe.Autocompleters[name] = { ...Yasqe.Autocompleters[fromCompleter], ...newCompleter };

    if (enable && Yasqe.defaults.autocompleters.indexOf(name) < 0) Yasqe.defaults.autocompleters.push(name);
  }
}

export type { TokenizerState, Position, Token } from "./editor/tokenizerRunner";
export type { Hint, HintList, HintFn } from "./editor/autocompletion";
export type { EditorOptions } from "./editor/facade";
export type { ExtraKeys } from "./editor/keymap";

/**
 * Autocompletion popup configuration.
 * Most CodeMirror 5 show-hint options are no longer applicable with CodeMirror 6; the remaining ones are
 * kept for backwards compatibility and are currently informational only.
 */
export interface HintConfig {
  completeOnSingleClick?: boolean;
  container?: HTMLElement;
  closeCharacters?: RegExp;
  completeSingle?: boolean;
  alignWithWord?: boolean;
  closeOnUnfocus?: boolean;
}
export interface BasicAuthConfig {
  username: string;
  password: string;
}
export interface BearerAuthConfig {
  token: string;
}
export interface ApiKeyAuthConfig {
  headerName: string;
  apiKey: string;
}
export interface OAuth2AuthConfig {
  accessToken: string;
  idToken?: string; // ID token for authentication (Azure AD, OIDC)
}
export type AuthConfig = BasicAuthConfig | BearerAuthConfig | ApiKeyAuthConfig | OAuth2AuthConfig;
export interface RequestConfig<Y> {
  queryArgument: string | ((yasqe: Y) => string) | undefined;
  endpoint: string | ((yasqe: Y) => string);
  method: "POST" | "GET" | ((yasqe: Y) => "POST" | "GET");
  acceptHeaderGraph: string | ((yasqe: Y) => string);
  acceptHeaderSelect: string | ((yasqe: Y) => string);
  acceptHeaderUpdate: string | ((yasqe: Y) => string);
  namedGraphs: string[] | ((yasqe: Y) => string[]);
  defaultGraphs: string[] | ((yasqe: Y) => []);
  args: Array<{ name: string; value: string }> | ((yasqe: Y) => Array<{ name: string; value: string }>);
  headers: { [key: string]: string } | ((yasqe: Y) => { [key: string]: string });
  withCredentials: boolean | ((yasqe: Y) => boolean);
  adjustQueryBeforeRequest: ((yasqe: Y) => string) | false;
  basicAuth: BasicAuthConfig | ((yasqe: Y) => BasicAuthConfig | undefined) | undefined;
  bearerAuth: BearerAuthConfig | ((yasqe: Y) => BearerAuthConfig | undefined) | undefined;
  apiKeyAuth: ApiKeyAuthConfig | ((yasqe: Y) => ApiKeyAuthConfig | undefined) | undefined;
  oauth2Auth: OAuth2AuthConfig | ((yasqe: Y) => OAuth2AuthConfig | undefined) | undefined;
}
export type PlainRequestConfig = {
  [K in keyof RequestConfig<any>]: Exclude<RequestConfig<any>[K], Function>;
};
export type PartialConfig = {
  [P in keyof Config]?: Config[P] extends object ? Partial<Config[P]> : Config[P];
};

export interface Snippet {
  label: string;
  code: string;
  group?: string;
}
export interface Config extends Omit<EditorOptions, "extraKeys"> {
  mode: string;
  extraKeys: ExtraKeys<Yasqe>;
  collapsePrefixesOnLoad: boolean;
  syntaxErrorCheck: boolean;
  /**
   * Show a button with which users can create a link to this query. Set this value to null to disable this functionality.
   * By default, this feature is enabled, and the only the query value is appended to the link.
   * ps. This function should return an object which is parseable by jQuery.param (http://api.jquery.com/jQuery.param/)
   */
  createShareableLink: ((yasqe: Yasqe) => string) | undefined | null;
  createShortLink: ((yasqe: Yasqe, longLink: string) => Promise<string>) | undefined;
  consumeShareLink: ((yasqe: Yasqe) => void) | undefined | null;
  /**
   * Change persistency settings for the YASQE query value. Setting the values
   * to null, will disable persistancy: nothing is stored between browser
   * sessions Setting the values to a string (or a function which returns a
   * string), will store the query in localstorage using the specified string.
   * By default, the ID is dynamically generated using the closest dom ID, to avoid collissions when using multiple YASQE items on one
   * page
   */
  persistenceId: ((yasqe: Yasqe) => string) | string | undefined | null;
  persistencyExpire: number; //seconds
  showQueryButton: boolean;
  requestConfig: RequestConfig<Yasqe> | ((yasqe: Yasqe) => RequestConfig<Yasqe>);
  pluginButtons: (() => HTMLElement[] | HTMLElement) | undefined;
  highlightSelectionMatches: boolean | { showToken?: RegExp; annotateScrollbar?: boolean };
  tabMode: string;
  foldGutter: boolean | object;
  matchBrackets: boolean;
  autocompleters: string[];
  hintConfig: Partial<HintConfig>;
  resizeable: boolean;
  editorHeight: string;
  queryingDisabled: string | undefined; // The string will be the message displayed when hovered
  prefixCcApi: string | null; // URL to fetch prefix data from; null (default) uses the bundled prefix data
  showFormatButton: boolean; // Show a button to format the query
  showMapButton: boolean; // Show a button to create WKT literals from map input
  checkConstructVariables: boolean; // Check for undefined variables in CONSTRUCT queries
  snippets: Snippet[]; // Code snippets to show in the snippets bar
  showSnippetsBar: boolean; // Show the snippets bar
}
export interface PersistentConfig {
  query: string;
  editorHeight: string;
  formatterType?: "sparql-formatter" | "legacy"; // Which formatter to use
  autoformatOnQuery?: boolean; // Auto-format query on execution
}
// export var _Yasqe = _Yasqe;

//add missing static functions, added by e.g. addons
// declare function runMode(text:string, mode:any, out:any):void

//Need to assign our prototype to codemirror's, as some of the callbacks (e.g. the keymap opts)
//give us a cm doc, instead of a yasqe + cm doc
Autocompleter.completers.forEach((c) => {
  Yasqe.registerAutocompleter(c);
});

export default Yasqe;
