import { addClass } from "@matdata/yasgui-utils";
import { icon } from "./icons";
import type Tab from "./Tab";

interface SnippetLike {
  label: string;
  code: string;
  group?: string;
}

/** Group names written in capitals (e.g. "DATE/TIME") are shown in sentence case ("Date/time") */
export function displayGroupName(group: string): string {
  if (/[A-Z]/.test(group) && group === group.toUpperCase()) {
    return group.charAt(0) + group.slice(1).toLowerCase();
  }
  return group;
}

/**
 * "Insert" menu of the query bar: the code snippets of yasqe grouped in one menu,
 * plus the map to insert a geometry.
 */
export default class InsertMenu {
  private tab: Tab;
  private rootEl: HTMLDivElement;
  private button: HTMLButtonElement;
  private menuEl: HTMLDivElement;
  private searchEl: HTMLInputElement;
  private listEl: HTMLDivElement;
  private expandedGroup: string | undefined;

  constructor(tab: Tab, container: HTMLElement, onMap?: (event: MouseEvent) => void) {
    this.tab = tab;
    this.rootEl = document.createElement("div");
    addClass(this.rootEl, "yasgui-insert");

    this.button = document.createElement("button");
    this.button.type = "button";
    addClass(this.button, "yasgui-queryBarButton", "yasgui-insertButton");
    this.button.setAttribute("aria-haspopup", "menu");
    this.button.setAttribute("aria-expanded", "false");
    this.button.setAttribute("aria-label", "Insert");
    this.button.title = "Insert a snippet or a geometry";
    this.button.innerHTML = `${icon("braces")}<span class="yasgui-btnLabel">Insert</span>${icon("chevronDown", 14, 2)}`;
    this.button.addEventListener("click", (event) => {
      event.stopPropagation();
      this.toggle();
    });
    this.rootEl.appendChild(this.button);

    this.menuEl = document.createElement("div");
    addClass(this.menuEl, "yasgui-insertMenu");
    this.menuEl.setAttribute("role", "menu");
    this.menuEl.setAttribute("aria-label", "Insert");
    this.menuEl.hidden = true;

    const searchWrapper = document.createElement("div");
    addClass(searchWrapper, "yasgui-insertMenu__search");
    searchWrapper.innerHTML = icon("search", 16);
    this.searchEl = document.createElement("input");
    this.searchEl.type = "search";
    this.searchEl.placeholder = "Search snippets";
    this.searchEl.setAttribute("aria-label", "Search snippets");
    this.searchEl.addEventListener("input", () => this.render());
    searchWrapper.appendChild(this.searchEl);
    this.menuEl.appendChild(searchWrapper);

    this.listEl = document.createElement("div");
    addClass(this.listEl, "yasgui-insertMenu__list");
    this.menuEl.appendChild(this.listEl);

    if (onMap) {
      const footer = document.createElement("div");
      addClass(footer, "yasgui-insertMenu__footer");
      const mapItem = document.createElement("button");
      mapItem.type = "button";
      mapItem.setAttribute("role", "menuitem");
      addClass(mapItem, "yasgui-insertMenu__item", "yasgui-insertMenu__map");
      mapItem.innerHTML = `${icon("map", 16)}<span>Geometry from a map</span>`;
      mapItem.title = "Draw a point, line or polygon and insert it as a WKT literal";
      mapItem.addEventListener("click", (event) => {
        this.close();
        onMap(event);
      });
      footer.appendChild(mapItem);
      this.menuEl.appendChild(footer);
    }

    this.menuEl.addEventListener("keydown", this.handleKeyDown);
    this.rootEl.appendChild(this.menuEl);
    container.appendChild(this.rootEl);
    document.addEventListener("click", this.handleDocumentClick);
  }

  public getElement() {
    return this.rootEl;
  }

  public isOpen() {
    return !this.menuEl.hidden;
  }

  public open() {
    this.searchEl.value = "";
    this.expandedGroup = undefined;
    this.render();
    this.menuEl.hidden = false;
    this.button.setAttribute("aria-expanded", "true");
    addClass(this.button, "active");
    this.searchEl.focus();
  }

  public close(returnFocus = false) {
    if (this.menuEl.hidden) return;
    this.menuEl.hidden = true;
    this.button.setAttribute("aria-expanded", "false");
    this.button.classList.remove("active");
    if (returnFocus) this.button.focus();
  }

  public toggle() {
    if (this.isOpen()) this.close();
    else this.open();
  }

  private getSnippets(): SnippetLike[] {
    const yasqe = this.tab.getYasqe();
    return ((yasqe?.config.snippets as SnippetLike[] | undefined) || []).filter((s) => s && s.label && s.code);
  }

  private insert(snippet: SnippetLike) {
    const yasqe = this.tab.getYasqe();
    this.close();
    if (!yasqe) return;
    if (typeof (yasqe as any).insertSnippet === "function") {
      (yasqe as any).insertSnippet(snippet.code);
    } else {
      yasqe.replaceSelection(snippet.code);
      yasqe.focus();
    }
  }

  private snippetItem(snippet: SnippetLike) {
    const item = document.createElement("button");
    item.type = "button";
    item.setAttribute("role", "menuitem");
    addClass(item, "yasgui-insertMenu__item", "yasgui-insertMenu__snippet");
    item.textContent = snippet.label;
    item.title = snippet.code;
    item.addEventListener("click", () => this.insert(snippet));
    return item;
  }

  private render() {
    const list = this.listEl;
    list.innerHTML = "";
    const snippets = this.getSnippets();
    const filter = this.searchEl.value.trim().toLowerCase();

    if (filter) {
      const matches = snippets.filter(
        (s) => s.label.toLowerCase().indexOf(filter) >= 0 || (s.group || "").toLowerCase().indexOf(filter) >= 0,
      );
      if (!matches.length) {
        const empty = document.createElement("div");
        addClass(empty, "yasgui-insertMenu__empty");
        empty.textContent = "No matching snippets";
        list.appendChild(empty);
      }
      for (const snippet of matches) list.appendChild(this.snippetItem(snippet));
      return;
    }

    if (!snippets.length) {
      const empty = document.createElement("div");
      addClass(empty, "yasgui-insertMenu__empty");
      empty.textContent = "No snippets configured";
      list.appendChild(empty);
      return;
    }

    const groups: { name: string; snippets: SnippetLike[] }[] = [];
    const ungrouped: SnippetLike[] = [];
    for (const snippet of snippets) {
      if (!snippet.group) {
        ungrouped.push(snippet);
        continue;
      }
      let group = groups.find((g) => g.name === snippet.group);
      if (!group) {
        group = { name: snippet.group, snippets: [] };
        groups.push(group);
      }
      group.snippets.push(snippet);
    }

    for (const group of groups) {
      const expanded = this.expandedGroup === group.name;
      const header = document.createElement("button");
      header.type = "button";
      header.setAttribute("role", "menuitem");
      header.setAttribute("aria-expanded", String(expanded));
      addClass(header, "yasgui-insertMenu__item", "yasgui-insertMenu__group");
      const label = document.createElement("span");
      label.textContent = displayGroupName(group.name);
      const count = document.createElement("span");
      addClass(count, "yasgui-insertMenu__count");
      count.textContent = String(group.snippets.length);
      header.append(label, count);
      header.insertAdjacentHTML("beforeend", icon(expanded ? "chevronDown" : "chevronRight", 14, 2));
      header.addEventListener("click", (event) => {
        event.stopPropagation();
        this.expandedGroup = expanded ? undefined : group.name;
        this.render();
        (this.listEl.querySelector(`[data-group="${CSS.escape(group.name)}"]`) as HTMLElement | null)?.focus();
      });
      header.dataset.group = group.name;
      list.appendChild(header);
      if (expanded) {
        const children = document.createElement("div");
        addClass(children, "yasgui-insertMenu__groupItems");
        for (const snippet of group.snippets) children.appendChild(this.snippetItem(snippet));
        list.appendChild(children);
      }
    }
    for (const snippet of ungrouped) list.appendChild(this.snippetItem(snippet));
  }

  private handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.close(true);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = Array.from(this.menuEl.querySelectorAll<HTMLElement>("input, [role='menuitem']"));
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length];
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };

  private handleDocumentClick = (event: MouseEvent) => {
    if (this.isOpen() && !this.rootEl.contains(event.target as Node)) this.close();
  };

  public destroy() {
    document.removeEventListener("click", this.handleDocumentClick);
    this.rootEl.remove();
  }
}
