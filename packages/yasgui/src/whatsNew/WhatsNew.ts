import { addClass } from "@matdata/yasgui-utils";
import { icon } from "../icons";
import type Yasgui from "../";
import { releases as defaultReleases, compareVersions, ChangeKind, Release } from "./releases";
import "./WhatsNew.scss";

const KIND_LABELS: { [kind in ChangeKind]: string } = {
  new: "New",
  improved: "Improved",
  fixed: "Fixed",
};
const RELEASES_URL = "https://github.com/Matdata-eu/MatGUI/releases";

type Filter = "all" | ChangeKind;

/**
 * "What's new" dialog, opened from the help menu or the Ctrl+K search: what changed per version, as
 * New / Improved / Fixed. Remembers the newest version the user has seen, and badges the help button
 * until a newer release has been looked at.
 */
export default class WhatsNew {
  private yasgui: Yasgui;
  private releases: Release[];
  private overlayEl?: HTMLDivElement;
  private listEl?: HTMLDivElement;
  private filter: Filter = "all";
  /** Newest version seen before this dialog was opened, so the unseen releases stay marked while it is open */
  private seenBefore: string | undefined;
  private returnFocusEl?: HTMLElement;

  constructor(yasgui: Yasgui, releases: Release[] = defaultReleases) {
    this.yasgui = yasgui;
    this.releases = releases;
    const persistent = yasgui.persistentConfig;
    // First visit: nothing is new to someone who never used an older version
    if (persistent.getWhatsNewSeen() === undefined && !persistent.hasStoredConfig()) this.markSeen();
    yasgui.helpMenu.addItem({
      id: "whatsNew",
      label: "What's new",
      icon: "sparkles",
      order: 20,
      badge: this.hasUnseen(),
      onClick: () => this.open(),
    });
  }

  public getLatestVersion(): string | undefined {
    return this.releases[0]?.version;
  }

  /** True when there is a release the user hasn't seen in this dialog yet */
  public hasUnseen(): boolean {
    const latest = this.getLatestVersion();
    if (!latest) return false;
    const seen = this.yasgui.persistentConfig.getWhatsNewSeen();
    return seen === undefined || compareVersions(latest, seen) > 0;
  }

  public isOpen(): boolean {
    return !!this.overlayEl && !this.overlayEl.hidden;
  }

  public open() {
    if (!this.overlayEl) this.draw();
    if (!this.overlayEl) return;
    if (document.activeElement instanceof HTMLElement) this.returnFocusEl = document.activeElement;
    this.seenBefore = this.yasgui.persistentConfig.getWhatsNewSeen();
    this.filter = "all";
    this.render();
    this.overlayEl.hidden = false;
    (this.overlayEl.querySelector(".yasgui-whatsNew__close") as HTMLButtonElement | null)?.focus();
    this.listEl?.scrollTo?.({ top: 0 });
    document.addEventListener("keydown", this.handleKeydown, true);
    this.markSeen();
  }

  public close() {
    if (!this.overlayEl || this.overlayEl.hidden) return;
    this.overlayEl.hidden = true;
    document.removeEventListener("keydown", this.handleKeydown, true);
    if (this.returnFocusEl?.isConnected) this.returnFocusEl.focus();
    this.returnFocusEl = undefined;
  }

  public destroy() {
    this.close();
    this.overlayEl?.remove();
    this.overlayEl = undefined;
  }

  private markSeen() {
    const latest = this.getLatestVersion();
    if (!latest) return;
    const seen = this.yasgui.persistentConfig.getWhatsNewSeen();
    if (seen === undefined || compareVersions(latest, seen) > 0) this.yasgui.persistentConfig.setWhatsNewSeen(latest);
    this.yasgui.helpMenu.setBadge("whatsNew", false);
  }

  private handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    this.close();
  };

  private draw() {
    const overlay = document.createElement("div");
    addClass(overlay, "yasgui-whatsNew");
    overlay.hidden = true;
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) this.close();
    });

    const dialog = document.createElement("div");
    addClass(dialog, "yasgui-whatsNew__dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "yasgui-whatsNew-title");

    const header = document.createElement("div");
    addClass(header, "yasgui-whatsNew__header");
    const title = document.createElement("h2");
    title.id = "yasgui-whatsNew-title";
    title.innerHTML = `${icon("sparkles", 18)}<span>What's new</span>`;
    header.appendChild(title);
    const close = document.createElement("button");
    close.type = "button";
    addClass(close, "yasgui-whatsNew__close");
    close.setAttribute("aria-label", "Close");
    close.title = "Close (Esc)";
    close.innerHTML = icon("x", 16);
    close.addEventListener("click", () => this.close());
    header.appendChild(close);
    dialog.appendChild(header);

    const filters = document.createElement("div");
    addClass(filters, "yasgui-whatsNew__filters");
    filters.setAttribute("role", "radiogroup");
    filters.setAttribute("aria-label", "Show");
    const options: Array<[Filter, string]> = [
      ["all", "All"],
      ["new", KIND_LABELS.new],
      ["improved", KIND_LABELS.improved],
      ["fixed", KIND_LABELS.fixed],
    ];
    for (const [value, label] of options) {
      const option = document.createElement("button");
      option.type = "button";
      option.textContent = label;
      option.dataset.filter = value;
      option.setAttribute("role", "radio");
      option.addEventListener("click", () => {
        this.filter = value;
        this.render();
      });
      filters.appendChild(option);
    }
    dialog.appendChild(filters);

    const list = document.createElement("div");
    addClass(list, "yasgui-whatsNew__list");
    dialog.appendChild(list);
    this.listEl = list;

    const footer = document.createElement("div");
    addClass(footer, "yasgui-whatsNew__footer");
    const link = document.createElement("a");
    link.href = RELEASES_URL;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.innerHTML = `<span>Full release notes on GitHub</span>${icon("externalLink", 13)}`;
    footer.appendChild(link);
    dialog.appendChild(footer);

    overlay.appendChild(dialog);
    // Inside the Yasgui root, so it gets the theme tokens
    this.yasgui.rootEl.appendChild(overlay);
    this.overlayEl = overlay;
  }

  private render() {
    if (!this.overlayEl || !this.listEl) return;
    for (const option of Array.from(this.overlayEl.querySelectorAll<HTMLButtonElement>("[data-filter]"))) {
      option.setAttribute("aria-checked", String(option.dataset.filter === this.filter));
    }
    const list = this.listEl;
    list.innerHTML = "";
    for (const release of this.releases) {
      const changes = release.changes.filter((change) => this.filter === "all" || change.kind === this.filter);
      if (!changes.length) continue;
      const section = document.createElement("section");
      addClass(section, "yasgui-whatsNew__release");

      const heading = document.createElement("div");
      addClass(heading, "yasgui-whatsNew__releaseHeader");
      const version = document.createElement("h3");
      version.textContent = `v${release.version}`;
      heading.appendChild(version);
      if (this.seenBefore === undefined || compareVersions(release.version, this.seenBefore) > 0) {
        const unseen = document.createElement("span");
        addClass(unseen, "yasgui-whatsNew__unseen");
        unseen.textContent = "New to you";
        heading.appendChild(unseen);
      }
      if (release.date) {
        const date = document.createElement("span");
        addClass(date, "yasgui-whatsNew__date");
        date.textContent = formatDate(release.date);
        heading.appendChild(date);
      }
      section.appendChild(heading);

      if (release.summary && this.filter === "all") {
        const summary = document.createElement("p");
        addClass(summary, "yasgui-whatsNew__summary");
        summary.textContent = release.summary;
        section.appendChild(summary);
      }

      const items = document.createElement("ul");
      for (const change of changes) {
        const item = document.createElement("li");
        const kind = document.createElement("span");
        addClass(kind, "yasgui-whatsNew__kind", `yasgui-whatsNew__kind--${change.kind}`);
        kind.textContent = KIND_LABELS[change.kind];
        item.appendChild(kind);
        const text = document.createElement("span");
        text.textContent = change.text;
        item.appendChild(text);
        items.appendChild(item);
      }
      section.appendChild(items);
      list.appendChild(section);
    }
  }
}

function formatDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
