import { addClass } from "@matdata/yasgui-utils";
import { icon, IconName } from "./icons";
import type Yasgui from "./";
import "./HelpMenu.scss";

export interface HelpMenuItem {
  /** Unique id, used to replace, remove or badge the item later */
  id: string;
  label: string;
  icon?: IconName;
  onClick: () => void;
  /** Show a dot on the item and on the help button, e.g. for unseen release notes */
  badge?: boolean;
  /** Items are sorted on this number (default 100); built-in items use 10, 20 and 90 */
  order?: number;
}

/**
 * Menu of the help button in the top bar: the quick start tour, what's new and the documentation.
 * The button only shows when the menu has an item; with a single item it runs that item directly.
 */
export default class HelpMenu {
  private yasgui: Yasgui;
  private items: HelpMenuItem[] = [];
  private buttonEl?: HTMLButtonElement;
  private menuEl?: HTMLDivElement;

  constructor(yasgui: Yasgui) {
    this.yasgui = yasgui;
    const helpUrl = yasgui.config.helpUrl;
    if (helpUrl) {
      this.addItem({
        id: "documentation",
        label: "Documentation",
        icon: "externalLink",
        order: 90,
        onClick: () => window.open(helpUrl, "_blank", "noopener,noreferrer"),
      });
    }
  }

  /** Add an item, or replace the item with the same id */
  public addItem(item: HelpMenuItem) {
    this.items = this.items.filter((existing) => existing.id !== item.id);
    this.items.push(item);
    this.items.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    this.update();
  }

  public removeItem(id: string) {
    this.items = this.items.filter((item) => item.id !== id);
    this.update();
  }

  public setBadge(id: string, badge: boolean) {
    const item = this.items.find((existing) => existing.id === id);
    if (!item || !!item.badge === badge) return;
    item.badge = badge;
    this.update();
  }

  public getItems(): HelpMenuItem[] {
    return [...this.items];
  }

  /** The help button of the top bar, kept up to date with the items */
  public getButton(): HTMLButtonElement {
    if (this.buttonEl) return this.buttonEl;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "yasgui-topBarButton yasgui-helpButton";
    button.setAttribute("aria-haspopup", "menu");
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      if (this.items.length === 1) {
        this.items[0].onClick();
        return;
      }
      if (this.isOpen()) this.close();
      else this.open();
    });
    this.buttonEl = button;
    this.update();
    return button;
  }

  public isOpen(): boolean {
    return !!this.menuEl && !this.menuEl.hidden;
  }

  public open() {
    if (!this.buttonEl || !this.items.length) return;
    if (!this.menuEl) this.drawMenu();
    const menu = this.menuEl!;
    this.renderMenu();
    menu.hidden = false;
    this.buttonEl.setAttribute("aria-expanded", "true");
    const rect = this.buttonEl.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 6}px`;
    menu.style.right = `${Math.max(8, document.documentElement.clientWidth - rect.right)}px`;
    (menu.querySelector("button") as HTMLButtonElement | null)?.focus();
    document.addEventListener("mousedown", this.handleOutside, true);
    document.addEventListener("keydown", this.handleKeydown, true);
  }

  public close(returnFocus = false) {
    if (!this.menuEl || this.menuEl.hidden) return;
    this.menuEl.hidden = true;
    this.buttonEl?.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", this.handleOutside, true);
    document.removeEventListener("keydown", this.handleKeydown, true);
    if (returnFocus) this.buttonEl?.focus();
  }

  public destroy() {
    this.close();
    this.menuEl?.remove();
    this.menuEl = undefined;
  }

  private handleOutside = (event: MouseEvent) => {
    const target = event.target as Node | null;
    if (target && (this.menuEl?.contains(target) || this.buttonEl?.contains(target))) return;
    this.close();
  };

  private handleKeydown = (event: KeyboardEvent) => {
    if (!this.menuEl) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.close(true);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = Array.from(this.menuEl.querySelectorAll<HTMLButtonElement>("button"));
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = (current + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };

  private drawMenu() {
    const menu = document.createElement("div");
    addClass(menu, "yasgui-helpMenu");
    menu.setAttribute("role", "menu");
    menu.hidden = true;
    // Inside the Yasgui root, so it gets the theme tokens
    this.yasgui.rootEl.appendChild(menu);
    this.menuEl = menu;
  }

  private renderMenu() {
    if (!this.menuEl) return;
    this.menuEl.innerHTML = "";
    for (const item of this.items) {
      const entry = document.createElement("button");
      entry.type = "button";
      entry.setAttribute("role", "menuitem");
      addClass(entry, "yasgui-helpMenu__item");
      entry.innerHTML = `${item.icon ? icon(item.icon, 15) : ""}<span></span>`;
      entry.querySelector("span")!.textContent = item.label;
      if (item.badge) {
        const dot = document.createElement("span");
        addClass(dot, "yasgui-helpMenu__badge");
        dot.setAttribute("aria-label", "New");
        entry.appendChild(dot);
      }
      entry.addEventListener("click", () => {
        this.close();
        item.onClick();
      });
      this.menuEl.appendChild(entry);
    }
  }

  private update() {
    const button = this.buttonEl;
    if (!button) return;
    button.hidden = this.items.length === 0;
    const single = this.items.length === 1 ? this.items[0] : undefined;
    const badge = this.items.some((item) => item.badge);
    const label = single?.id === "documentation" ? "Open the documentation" : single ? single.label : "Help";
    button.title = badge ? `${label} (new)` : label;
    button.setAttribute("aria-label", badge ? `${label}, new` : label);
    button.setAttribute("aria-haspopup", single ? "false" : "menu");
    button.innerHTML = icon("help", 16);
    if (badge) {
      const dot = document.createElement("span");
      addClass(dot, "yasgui-helpButton__badge");
      button.appendChild(dot);
    }
    if (this.isOpen()) this.renderMenu();
  }
}
