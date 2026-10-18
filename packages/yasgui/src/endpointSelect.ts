import Autocomplete from "@tarekraafat/autocomplete.js";
import { EventEmitter } from "events";
import { pick } from "lodash-es";
import { addClass } from "@matdata/yasgui-utils";
import "./endpointSelect.scss";
import parse from "autosuggest-highlight/parse";
import DOMPurify from "dompurify";
import { icon } from "./icons";

//Export this here instead of from our custom-types folder of autocomplete-js
//as this interface is exported via the Matgui config. The custom typings are
//not exported as part of the Matgui typings, so we'd get typing errors.
//instead, include this interface in the Matgui typings itself by defining it here
interface AutocompleteItem<T> {
  index: number; //index of suggestion in array of suggestions
  value: T; //suggestion object
  key: keyof T; //key that matches search string. In our case, always 'all'
  match: string; //suggestion value of the key above
}
export interface CatalogueItem {
  endpoint: string;
  type?: "history";
}

export interface RenderedCatalogueItem<T> {
  matches: { [k in keyof T]?: ReturnType<typeof parse> } & { endpoint?: ReturnType<typeof parse> };
}

const { sanitize } = DOMPurify;

function listElementIsFullyVissible(el: HTMLLIElement) {
  const { top, bottom } = el.getBoundingClientRect();
  // Check if bottom of the element is off the page
  if (bottom < 0) return false;
  // Check its within the document viewport
  if (top > document.documentElement.clientHeight) return false;

  const ulRect = (el.parentNode as HTMLUListElement).getBoundingClientRect();
  if (bottom <= ulRect.bottom === false) return false;
  // Check if the element is out of view due to a container scrolling
  if (top <= ulRect.top) return false;
  return true;
}

function splitSearchString(searchString: string): string[] {
  return searchString.match(/\S+/g) || [];
}

export interface EndpointSelectConfig<T = CatalogueItem> {
  // Omit endpoint since it will be used as default, this makes sure elements don't appear twice in the list
  keys: (keyof T)[];
  getData: () => T[];
  renderItem: (data: AutocompleteItem<T> & RenderedCatalogueItem<T>, source: HTMLElement) => void;
}
export interface EndpointSelect {
  on(event: string | symbol, listener: (...args: any[]) => void): this;
  on(event: "remove", listener: (endpoint: string, history: string[]) => void): this;
  emit(event: "remove", endpoint: string, history: string[]): boolean;
  on(event: "select", listener: (endpoint: string, history: string[]) => void): this;
  emit(event: "select", endpoint: string, history: string[]): boolean;
  on(event: "manage", listener: () => void): this;
  emit(event: "manage"): boolean;
}

/** An endpoint with a label, listed in the "Quick switch" group of the endpoint dropdown */
export interface QuickSwitchItem {
  endpoint: string;
  label: string;
}

export class EndpointSelect extends EventEmitter {
  private container: HTMLDivElement;
  private options: EndpointSelectConfig;
  private value: string;
  private history: CatalogueItem[];
  private inputField!: HTMLInputElement;
  private wrapperEl!: HTMLDivElement;
  private labelEl!: HTMLSpanElement;
  private dropdownEl!: HTMLDivElement;
  private quickSwitchEl!: HTMLDivElement;
  private quickSwitchItems: QuickSwitchItem[] = [];
  private endpointLabels: { [endpoint: string]: string } = {};
  private handleDocumentMouseDown!: (event: MouseEvent) => void;
  constructor(initialValue: string, container: HTMLDivElement, options: EndpointSelectConfig, history: string[]) {
    super();
    this.container = container;
    this.options = options;
    this.value = initialValue;
    this.history = history.map((endpoint) => {
      return { endpoint: sanitize(endpoint), type: "history" };
    });
    // Add endpoint if not defined
    if (this.options.keys.indexOf("endpoint") <= 0) this.options.keys.push("endpoint");
    this.draw();
  }
  private draw() {
    // Create container, we don't need to interact with it anymore
    const autocompleteWrapper = document.createElement("div");
    addClass(autocompleteWrapper, "autocompleteWrapper", "endpointPicker");
    this.wrapperEl = autocompleteWrapper;
    this.container.appendChild(autocompleteWrapper);

    const leadingIcon = document.createElement("span");
    addClass(leadingIcon, "endpointPicker__icon");
    leadingIcon.innerHTML = icon("database", 16);
    autocompleteWrapper.appendChild(leadingIcon);

    // Label of the endpoint (when it has one), shown before its URL
    this.labelEl = document.createElement("span");
    addClass(this.labelEl, "endpointPicker__label");
    autocompleteWrapper.appendChild(this.labelEl);

    // Create field
    this.inputField = document.createElement("input");
    addClass(this.inputField, "autocomplete");
    this.inputField.value = this.value;
    this.inputField.setAttribute("aria-label", "SPARQL endpoint");
    this.inputField.spellcheck = false;
    autocompleteWrapper.appendChild(this.inputField);

    // Create clear button
    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.title = "Clear endpoint";
    clearBtn.setAttribute("aria-label", "Clear endpoint");
    addClass(clearBtn, "tabContextButton", "endpointPicker__clear");
    clearBtn.innerHTML = icon("x", 16);
    clearBtn.addEventListener("click", () => {
      this.inputField.value = "";
      this.inputField.focus();
    });
    autocompleteWrapper.appendChild(clearBtn);

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.tabIndex = -1;
    toggleBtn.title = "Show endpoints";
    toggleBtn.setAttribute("aria-label", "Show endpoints");
    addClass(toggleBtn, "endpointPicker__toggle");
    toggleBtn.innerHTML = icon("chevronDown", 16, 2);
    toggleBtn.addEventListener("mousedown", (event) => {
      event.preventDefault();
      if (this.isOpen()) {
        this.inputField.blur();
        this.closeDropdown();
      } else {
        this.inputField.focus();
        this.openDropdown();
      }
    });
    autocompleteWrapper.appendChild(toggleBtn);

    // Dropdown: quick switch group, the endpoint catalogue and history, and a link to manage endpoints
    this.dropdownEl = document.createElement("div");
    addClass(this.dropdownEl, "endpointDropdown");
    this.quickSwitchEl = document.createElement("div");
    addClass(this.quickSwitchEl, "endpointQuickSwitch");
    this.quickSwitchEl.setAttribute("role", "group");
    this.quickSwitchEl.setAttribute("aria-label", "Quick switch");
    this.dropdownEl.appendChild(this.quickSwitchEl);
    const listHost = document.createElement("div");
    addClass(listHost, "endpointDropdown__list");
    const listHeading = document.createElement("div");
    addClass(listHeading, "endpointDropdown__heading");
    listHeading.textContent = "Endpoints";
    listHost.appendChild(listHeading);
    this.dropdownEl.appendChild(listHost);
    const manage = document.createElement("button");
    manage.type = "button";
    addClass(manage, "endpointDropdown__manage");
    manage.innerHTML = `${icon("settings", 16)}<span>Manage endpoints</span>`;
    manage.addEventListener("mousedown", (event) => event.preventDefault());
    manage.addEventListener("click", () => {
      this.closeDropdown();
      this.inputField.blur();
      this.emit("manage");
    });
    this.dropdownEl.appendChild(manage);
    autocompleteWrapper.appendChild(this.dropdownEl);

    this.inputField.addEventListener("focus", () => this.openDropdown());
    this.inputField.addEventListener("input", () => this.openDropdown());
    autocompleteWrapper.addEventListener("focusout", (event) => {
      const next = event.relatedTarget as Node | null;
      if (!next || !autocompleteWrapper.contains(next)) this.closeDropdown();
    });

    // Init autocomplete library
    new Autocomplete<CatalogueItem>({
      placeholder: "Search or add an endpoint",
      highlight: false,
      maxResults: 100,
      trigger: {
        event: ["input", "focusin"],
        //we always want to show the autocomplete, even if no query is set
        //in that case, we'd just show the full list
        condition: () => true,
      },
      // threshold: -1,
      searchEngine: (query, record) => {
        if (!query || query.trim().length === 0 || query === this.value) {
          //show everything when we've got an empty search string, or when the field still shows the current endpoint
          return true;
        }
        return splitSearchString(query).every((m) => record.indexOf(m) >= 0);
      },
      data: {
        src: async () => {
          return [...this.history, ...this.options.getData()].map((item) => ({
            ...item,
            all: Object.values(pick(item, ["endpoint", ...this.options.keys])).join(" "),
          }));
        },
        key: ["all" as any], // All is something we add as a workaround for getting multiple results of the library
        cache: false,
      },
      // Use a selector coming from the container, this is to make sure we grab our own autocomplete element
      selector: () => this.inputField,
      resultsList: {
        render: true,
        destination: listHost,
        position: "beforeend",
        container: (element) => {
          // Remove id, there can be multiple yasgui's active on one page, we can't delete since the library will then add the default
          element.id = "";
          addClass(element, "autocompleteList");
        },
      },
      resultItem: {
        content: (data, source) => {
          const endpoint = sanitize(data.value.endpoint);

          // Custom handling of items with history, these are able to be removed
          if (data.value.type && data.value.type === "history") {
            // Add a container to make folding work correctly
            const resultsContainer = document.createElement("div");
            // Match is highlighted text
            resultsContainer.innerHTML = parse(endpoint, createHighlights(endpoint, this.inputField.value)).reduce(
              (current, object) => (object.highlight ? current + object.text.bold() : current + object.text),
              "",
            );
            source.append(resultsContainer);

            // Remove button
            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.innerHTML = icon("x", 14);
            removeBtn.title = "Remove from history";
            removeBtn.setAttribute("aria-label", "Remove from history");
            addClass(removeBtn, "removeItem");
            removeBtn.addEventListener("mousedown", (event) => {
              this.history = this.history.filter((item) => item.endpoint !== endpoint);
              this.emit(
                "remove",
                this.value,
                this.history.map((value) => value.endpoint),
              );
              source.remove();
              event.stopPropagation();
            });

            source.appendChild(removeBtn);
          } else {
            // Add our own field highlighting
            const matches: RenderedCatalogueItem<CatalogueItem> = { matches: {} };
            for (const key of [...this.options.keys]) {
              const val = data.value[key];
              if (val) {
                matches.matches[key] = parse(val, createHighlights(val, this.inputField.value));
              }
            }
            this.options.renderItem({ ...data, ...matches }, source);
          }
        },
        element: "li",
      },
      onSelection: (feedback) => {
        const item = feedback.selection.value;
        this.value = item.endpoint;
        this.inputField.value = this.value;
        this.closeDropdown();
        this.emit(
          "select",
          this.value,
          this.history.map((value) => value.endpoint),
        );
      },
      noResults: () => {
        const container = this.container.querySelector(".autocompleteList");
        if (container) {
          const noResults = document.createElement("div");
          addClass(noResults, "noResults");
          noResults.innerText = "Press Enter to use this endpoint";
          container.appendChild(noResults);
        }
      },
    });
    // New data handler
    this.inputField.addEventListener("keyup", (event) => {
      const target = <HTMLInputElement>event.target;
      // Enter
      if (event.keyCode === 13) {
        this.closeDropdown();
        if (this.value === target.value) {
          //we have typed exactly the same value the one from the suggestion list
          //So, just close the suggestion list
          this.clearListSuggestionList();
          this.inputField.blur();
          return;
        }
        if (!target.value || !target.value.trim()) {
          this.clearListSuggestionList();
          this.inputField.blur();
          return;
        }
        if (
          this.options.getData().find((i) => i.endpoint === this.inputField.value) ||
          this.history.find((item) => item.endpoint === this.inputField.value)
        ) {
          //the value you typed is already in our catalogue or in our history
          this.value = target.value;
          this.clearListSuggestionList();
          this.emit(
            "select",
            this.value,
            this.history.map((h) => h.endpoint),
          );
          this.inputField.blur();
          return;
        }
        this.value = target.value;
        this.history.push({ endpoint: target.value, type: "history" });
        this.emit(
          "select",
          this.value,
          this.history.map((value) => value.endpoint),
        );
        this.clearListSuggestionList();
        this.inputField.blur();
      }
      // Blur and set value on enter
      if (event.keyCode === 27) {
        this.closeDropdown();
        this.inputField.blur();
        this.inputField.value = this.value;
        this.clearListSuggestionList();
      }

      // Stop moving caret around when hitting up and down keys
      if (event.keyCode === 38 || event.keyCode === 40) {
        event.stopPropagation();
        const selected: HTMLLIElement | null = this.container.querySelector(
          ".autocompleteList .autoComplete_result.autoComplete_selected",
        );
        if (selected && !listElementIsFullyVissible(selected)) {
          selected.scrollIntoView(false);
        }
      }
    });
    this.inputField.addEventListener("blur", (event) => {
      const target = <HTMLInputElement>event.target;
      // Tabbing blur event
      if (target.className === this.inputField.className && event.relatedTarget) {
        this.clearListSuggestionList();
        this.inputField.value = this.value;
      }
    });
    // Improvised clickAway handler, Blur will fire before select or click events, causing interactive suggestion to no longer work
    this.handleDocumentMouseDown = (event: MouseEvent) => {
      if (event.button !== 2) {
        const target = <HTMLElement>event.target;
        if (
          target.className === "removeItem" ||
          target.className === "autoComplete_result" ||
          target.className === "autocomplete"
        )
          return;
        if (this.wrapperEl.contains(target)) return;
        this.clearListSuggestionList();
        this.inputField.value = this.value;
        this.closeDropdown();
      }
    };
    document.addEventListener("mousedown", this.handleDocumentMouseDown);
    this.updateLabel();
  }

  private isOpen() {
    return this.wrapperEl.classList.contains("open");
  }

  private openDropdown() {
    this.renderQuickSwitch();
    addClass(this.wrapperEl, "open");
  }

  private closeDropdown() {
    this.wrapperEl.classList.remove("open");
  }

  /**
   * Endpoints listed in the "Quick switch" group of the dropdown (formerly the endpoint buttons)
   */
  /** Focus the endpoint field and show the endpoint list */
  public open() {
    this.inputField.focus();
    this.inputField.select();
    if (!this.isOpen()) this.openDropdown();
  }

  public setQuickSwitch(items: QuickSwitchItem[]) {
    this.quickSwitchItems = items;
    this.renderQuickSwitch();
  }

  /**
   * Known labels of endpoints, shown before the URL of the selected endpoint
   */
  public setEndpointLabels(labels: { [endpoint: string]: string }) {
    this.endpointLabels = labels;
    this.updateLabel();
  }

  private updateLabel() {
    const label =
      this.endpointLabels[this.value] || this.quickSwitchItems.find((item) => item.endpoint === this.value)?.label;
    this.labelEl.textContent = label || "";
    this.wrapperEl.classList.toggle("hasLabel", !!label);
  }

  private renderQuickSwitch() {
    const container = this.quickSwitchEl;
    container.innerHTML = "";
    const typed = this.inputField.value.trim().toLowerCase();
    // While the user is typing a new endpoint, only show the matching quick switches
    const filter = typed && this.inputField.value !== this.value ? typed : "";
    const items = this.quickSwitchItems.filter(
      (item) =>
        !filter || item.label.toLowerCase().indexOf(filter) >= 0 || item.endpoint.toLowerCase().indexOf(filter) >= 0,
    );
    container.hidden = items.length === 0;
    if (!items.length) return;
    const heading = document.createElement("div");
    addClass(heading, "endpointQuickSwitch__heading");
    heading.textContent = "Quick switch";
    container.appendChild(heading);
    for (const item of items) {
      const button = document.createElement("button");
      button.type = "button";
      addClass(button, "endpointQuickSwitch__item");
      if (item.endpoint === this.value) addClass(button, "active");
      button.title = `Set endpoint to ${item.endpoint}`;
      button.setAttribute("aria-label", `Set endpoint to ${item.endpoint}`);
      const dot = document.createElement("span");
      addClass(dot, "endpointQuickSwitch__dot");
      const label = document.createElement("span");
      addClass(label, "endpointQuickSwitch__label");
      label.textContent = item.label;
      const url = document.createElement("span");
      addClass(url, "endpointQuickSwitch__url");
      url.textContent = item.endpoint.replace(/^https?:\/\//, "");
      button.append(dot, label, url);
      const choose = () => {
        this.value = item.endpoint;
        this.inputField.value = item.endpoint;
        this.clearListSuggestionList();
        this.closeDropdown();
        this.inputField.blur();
        this.updateLabel();
        this.emit(
          "select",
          item.endpoint,
          this.history.map((value) => value.endpoint),
        );
      };
      // Keep the focus in the field until the choice is made
      button.addEventListener("mousedown", (event) => event.preventDefault());
      button.addEventListener("click", choose);
      container.appendChild(button);
    }
  }
  private clearListSuggestionList = () => {
    const autocompleteList = this.container.querySelector(".autocompleteList");
    if (autocompleteList) autocompleteList.innerHTML = "";
  };

  public setEndpoint(endpoint: string, endpointHistory?: string[]) {
    this.value = endpoint;
    if (endpointHistory) {
      this.history = endpointHistory.map((endpoint) => {
        return { endpoint, type: "history" };
      });
    }
    // Force focus when the endpoint is open
    if (this.inputField === document.activeElement) {
      this.inputField.focus();
    } else {
      // Only set when the user is not using the widget at this time
      this.inputField.value = endpoint;
    }
    this.updateLabel();
    if (this.isOpen()) this.renderQuickSwitch();
  }
  public destroy() {
    this.removeAllListeners();
    document.removeEventListener("mousedown", this.handleDocumentMouseDown);
    this.inputField.remove();
  }
}

function createHighlights(text: string, query: string) {
  return splitSearchString(query)
    .reduce((result: Array<[number, number]>, word: string) => {
      if (!word.length) return result;
      const wordLen = word.length;
      // const regex = new RegExp(escapeRegexCharacters(word), 'i');
      // const { index = -1 } = text.match(regex);
      const index = text.indexOf(word);
      if (index > -1) {
        result.push([index, index + wordLen]);

        // Replace what we just found with spaces so we don't find it again.
        text = text.slice(0, index) + new Array(wordLen + 1).join(" ") + text.slice(index + wordLen);
      }

      return result;
    }, [])
    .sort((match1: [number, number], match2: [number, number]) => {
      return match1[0] - match2[0];
    });
}

export default EndpointSelect;
