/**
 * A dropdown with a search field, grouped options and optionally free text: the Provider and Model fields of the AI
 * settings. The list opens below the field (above it when there is no room), in fixed position, so the scrolling
 * settings page doesn't clip it.
 */
import { icon } from "../icons";

export interface ComboOption {
  value: string;
  label: string;
  /** Options with the same group are listed under that heading, in the order of the options */
  group?: string;
  /** Short text at the right of the option, e.g. "no key" */
  sub?: string;
  /** Small badge after the label, e.g. "EU" */
  badge?: string;
  /** Recommended option, marked with a star */
  star?: boolean;
  /** Coloured initial shown as a logo */
  logo?: { text: string; color: string };
}

export interface ComboboxOptions {
  ariaLabel: string;
  placeholder: string;
  searchPlaceholder: string;
  /** Labels and values in a monospace font (model ids) */
  mono?: boolean;
  /** Offer what is typed in the search field as a value of its own ("Use …") */
  allowCustom?: boolean;
  onChange: (value: string) => void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function logoEl(logo: { text: string; color: string }) {
  const element = el("span", "yasgui-combo__logo", logo.text);
  element.style.background = logo.color;
  return element;
}

let comboCount = 0;

export default class Combobox {
  public readonly el: HTMLDivElement;
  private button: HTMLButtonElement;
  private pop: HTMLDivElement;
  private search: HTMLInputElement;
  private list: HTMLDivElement;
  private footer: HTMLDivElement;
  private options: ComboOption[] = [];
  private value: string | undefined;
  private highlighted = 0;
  private visible: ComboOption[] = [];
  private listId = `yasgui-combo-${++comboCount}`;

  constructor(private config: ComboboxOptions) {
    this.el = el("div", "yasgui-combo" + (config.mono ? " yasgui-combo--mono" : ""));
    this.button = el("button", "yasgui-combo__button");
    this.button.type = "button";
    this.button.setAttribute("aria-haspopup", "listbox");
    this.button.setAttribute("aria-expanded", "false");
    this.button.setAttribute("aria-label", config.ariaLabel);
    this.button.addEventListener("click", () => (this.isOpen() ? this.close() : this.open()));
    this.button.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        this.open();
      }
    });

    this.pop = el("div", "yasgui-combo__pop");
    this.pop.hidden = true;
    this.search = el("input", "yasgui-combo__search");
    this.search.type = "search";
    this.search.placeholder = config.searchPlaceholder;
    this.search.spellcheck = false;
    this.search.autocomplete = "off";
    this.search.setAttribute("role", "combobox");
    this.search.setAttribute("aria-controls", this.listId);
    this.search.setAttribute("aria-label", config.ariaLabel);
    this.search.addEventListener("input", () => {
      this.highlighted = 0;
      this.renderList();
    });
    this.search.addEventListener("keydown", (event) => this.onKey(event));
    this.list = el("div", "yasgui-combo__list");
    this.list.id = this.listId;
    this.list.setAttribute("role", "listbox");
    this.footer = el("div", "yasgui-combo__footer");
    this.pop.append(this.search, this.list, this.footer);
    this.el.append(this.button, this.pop);
    this.renderButton();
  }

  public setOptions(options: ComboOption[], footer?: string) {
    this.options = options;
    this.footer.textContent = footer || "";
    this.footer.hidden = !footer;
    this.renderButton();
    if (this.isOpen()) this.renderList();
  }

  public setValue(value: string | undefined) {
    this.value = value || undefined;
    this.renderButton();
  }

  public getValue(): string | undefined {
    return this.value;
  }

  public setSearchPlaceholder(text: string) {
    this.search.placeholder = text;
  }

  public focus() {
    this.button.focus();
  }

  public isOpen() {
    return !this.pop.hidden;
  }

  public open() {
    if (this.isOpen()) return;
    this.pop.hidden = false;
    this.button.setAttribute("aria-expanded", "true");
    this.el.classList.add("open");
    this.search.value = "";
    const selected = this.options.findIndex((option) => option.value === this.value);
    this.highlighted = Math.max(0, selected);
    this.renderList();
    this.place();
    this.search.focus();
    document.addEventListener("mousedown", this.onOutside, true);
    window.addEventListener("resize", this.onViewportChange);
    document.addEventListener("scroll", this.onScroll, true);
  }

  public close(focusButton = false) {
    if (!this.isOpen()) return;
    this.pop.hidden = true;
    this.button.setAttribute("aria-expanded", "false");
    this.el.classList.remove("open");
    document.removeEventListener("mousedown", this.onOutside, true);
    window.removeEventListener("resize", this.onViewportChange);
    document.removeEventListener("scroll", this.onScroll, true);
    if (focusButton) this.button.focus();
  }

  private onOutside = (event: MouseEvent) => {
    if (!this.el.contains(event.target as Node)) this.close();
  };

  private onViewportChange = () => this.close();

  private onScroll = (event: Event) => {
    if (!this.pop.contains(event.target as Node)) this.close();
  };

  /** Fixed position below the field, or above it when there is more room there */
  private place() {
    const rect = this.button.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const up = below < 260 && above > below;
    const room = Math.max(160, Math.min(360, up ? above : below));
    this.pop.style.left = `${rect.left}px`;
    this.pop.style.width = `${Math.max(rect.width, 280)}px`;
    this.pop.style.maxHeight = `${room}px`;
    this.pop.style.top = up ? "" : `${rect.bottom + 4}px`;
    this.pop.style.bottom = up ? `${window.innerHeight - rect.top + 4}px` : "";
  }

  private onKey(event: KeyboardEvent) {
    if (event.key === "Escape") {
      // Closes the list only, not the settings
      event.preventDefault();
      event.stopPropagation();
      this.close(true);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!this.visible.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      this.highlighted = (this.highlighted + step + this.visible.length) % this.visible.length;
      this.renderList();
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = this.visible[this.highlighted];
      if (option) this.pick(option.value);
    } else if (event.key === "Tab") {
      this.close();
    }
  }

  private pick(value: string) {
    this.value = value;
    this.renderButton();
    this.close(true);
    this.config.onChange(value);
  }

  private renderButton() {
    this.button.innerHTML = "";
    const option = this.options.find((candidate) => candidate.value === this.value);
    if (option?.logo) this.button.appendChild(logoEl(option.logo));
    const label = el(
      "span",
      "yasgui-combo__value" + (this.value ? "" : " placeholder"),
      option?.label || this.value || this.config.placeholder,
    );
    this.button.appendChild(label);
    if (option?.badge) this.button.appendChild(el("span", "yasgui-badge yasgui-badge--region", option.badge));
    if (option?.star) this.button.appendChild(el("span", "yasgui-combo__sub", "recommended"));
    const chevron = el("span", "yasgui-combo__chevron");
    chevron.innerHTML = icon("chevronDown", 14);
    this.button.appendChild(chevron);
  }

  private renderList() {
    const words = this.search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (option: ComboOption) =>
      words.every((word) => `${option.label} ${option.value} ${option.sub || ""}`.toLowerCase().includes(word));
    this.visible = this.options.filter(matches);
    const typed = this.search.value.trim();
    if (this.config.allowCustom && typed && !this.options.some((option) => option.value === typed)) {
      this.visible.push({ value: typed, label: `Use “${typed}”`, group: "Other model id" });
    }
    if (this.highlighted >= this.visible.length) this.highlighted = 0;

    this.list.innerHTML = "";
    if (!this.visible.length) {
      this.list.appendChild(el("div", "yasgui-combo__empty", "Nothing found"));
      return;
    }
    let group: string | undefined;
    this.visible.forEach((option, index) => {
      if (option.group && option.group !== group) {
        group = option.group;
        this.list.appendChild(el("div", "yasgui-combo__group", group));
      }
      const row = el("div", "yasgui-combo__option");
      row.setAttribute("role", "option");
      row.setAttribute("aria-selected", String(option.value === this.value));
      row.id = `${this.listId}-${index}`;
      if (index === this.highlighted) {
        row.classList.add("highlighted");
        this.search.setAttribute("aria-activedescendant", row.id);
      }
      if (option.star) row.appendChild(el("span", "yasgui-combo__star", "★"));
      if (option.logo) row.appendChild(logoEl(option.logo));
      row.appendChild(el("span", "yasgui-combo__label", option.label));
      if (option.badge) row.appendChild(el("span", "yasgui-badge yasgui-badge--region", option.badge));
      if (option.sub) row.appendChild(el("span", "yasgui-combo__sub", option.sub));
      if (option.value === this.value) {
        const check = el("span", "yasgui-combo__check");
        check.innerHTML = icon("check", 14);
        row.appendChild(check);
      }
      row.addEventListener("mousedown", (event) => event.preventDefault());
      row.addEventListener("click", () => this.pick(option.value));
      row.addEventListener("mousemove", () => {
        if (this.highlighted === index) return;
        this.list.querySelector(".highlighted")?.classList.remove("highlighted");
        row.classList.add("highlighted");
        this.highlighted = index;
      });
      this.list.appendChild(row);
    });
    this.list.querySelector(".highlighted")?.scrollIntoView({ block: "nearest" });
  }
}
