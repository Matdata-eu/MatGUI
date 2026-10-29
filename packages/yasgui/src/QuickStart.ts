import { addClass } from "@matdata/yasgui-utils";
import { icon, modKeyLabel } from "./icons";
import type Yasgui from "./";
import "./QuickStart.scss";

/** Raise when the tour changes enough to show it again to users who saw an earlier one */
const TOUR_VERSION = "1";
const SEEN_KEY = "matgui_quickStart_seen";

interface TourItem {
  title: string;
  text: string;
  /** Inline SVG drawn on a 120 x 72 canvas, coloured with the `qs-*` classes */
  illustration: string;
}

interface TourPage {
  title: string;
  lead: string;
  items: TourItem[];
}

// Small, schematic drawings of the interface. The classes map to theme tokens in QuickStart.scss.
const svg = (body: string) =>
  `<svg viewBox="0 0 120 72" width="120" height="72" aria-hidden="true" focusable="false">${body}</svg>`;
const card = (x: number, y: number, w: number, h: number, extra = "") =>
  `<rect class="qs-card" x="${x}" y="${y}" width="${w}" height="${h}" rx="5"${extra}/>`;
const bar = (x: number, y: number, w: number, cls = "qs-text") =>
  `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="4" rx="2"/>`;

const ILLUSTRATIONS = {
  endpoint: svg(
    card(14, 8, 92, 18) +
      `<circle class="qs-brand" cx="25" cy="17" r="4"/>` +
      bar(34, 15, 44, "qs-ink") +
      `<path class="qs-stroke" d="m92 15 3 3 3-3" fill="none"/>` +
      card(14, 30, 92, 36, ' class="qs-card qs-raised"') +
      `<rect class="qs-brandSoft" x="18" y="34" width="84" height="12" rx="3"/>` +
      bar(24, 38, 50, "qs-brandInk") +
      bar(24, 54, 40),
  ),
  autocomplete: svg(
    card(6, 6, 108, 60) +
      bar(14, 14, 18, "qs-keyword") +
      bar(35, 14, 30, "qs-iri") +
      bar(14, 24, 10, "qs-variable") +
      bar(27, 24, 16, "qs-ink") +
      `<rect class="qs-caret" x="45" y="22" width="1.5" height="8"/>` +
      card(40, 32, 66, 30, ' class="qs-card qs-raised"') +
      `<rect class="qs-brandSoft" x="43" y="35" width="60" height="8" rx="2"/>` +
      bar(47, 37, 36, "qs-brandInk") +
      bar(47, 47, 44) +
      bar(47, 55, 30),
  ),
  run: svg(
    card(6, 14, 108, 44) +
      `<rect class="qs-brandFill" x="20" y="25" width="52" height="22" rx="6"/>` +
      `<path class="qs-onBrand" d="M30 31v10l8-5z"/>` +
      bar(42, 34, 22, "qs-onBrandBar") +
      `<rect class="qs-kbd" x="80" y="27" width="24" height="18" rx="4"/>` +
      bar(85, 34, 14),
  ),
  views: svg(
    card(6, 6, 108, 60) +
      `<rect class="qs-sunken" x="12" y="12" width="96" height="12" rx="4"/>` +
      `<rect class="qs-card qs-raised" x="14" y="14" width="24" height="8" rx="3"/>` +
      bar(18, 16, 16, "qs-ink") +
      bar(44, 16, 16) +
      bar(66, 16, 16) +
      bar(88, 16, 14) +
      `<path class="qs-line" d="M12 34h96M12 44h96M12 54h96M44 28v32M76 28v32" fill="none"/>` +
      bar(16, 37, 20, "qs-iri") +
      bar(48, 37, 22) +
      bar(16, 47, 24, "qs-iri") +
      bar(48, 47, 18) +
      bar(80, 37, 20) +
      bar(80, 47, 16),
  ),
  describe: svg(
    card(6, 6, 108, 60) +
      `<path class="qs-line" d="M12 24h52M12 36h52M12 48h52" fill="none"/>` +
      bar(14, 16, 34, "qs-iri") +
      bar(14, 28, 40) +
      bar(14, 40, 30) +
      `<rect class="qs-card qs-raised" x="66" y="10" width="44" height="52" rx="4"/>` +
      bar(71, 16, 28, "qs-ink") +
      bar(71, 23, 20, "qs-brandInk") +
      bar(71, 34, 34) +
      bar(71, 42, 26) +
      bar(71, 50, 30) +
      `<path class="qs-cursor" d="M40 14v12l3-3 3 5 2-1-3-5h4z"/>`,
  ),
  download: svg(
    `<path class="qs-card" d="M38 8h30l14 14v42a4 4 0 0 1-4 4H38a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z"/>` +
      `<path class="qs-sunkenFill" d="M68 8v10a4 4 0 0 0 4 4h10z"/>` +
      bar(42, 30, 28) +
      bar(42, 38, 22) +
      `<circle class="qs-brandFill" cx="80" cy="54" r="13"/>` +
      `<path class="qs-onBrandStroke" d="M80 47v13m-5-5 5 5 5-5" fill="none"/>`,
  ),
  tabs: svg(
    `<rect class="qs-sunken" x="6" y="14" width="108" height="22" rx="6"/>` +
      `<rect class="qs-card qs-raised" x="10" y="18" width="34" height="14" rx="4"/>` +
      `<circle class="qs-brand" cx="16" cy="25" r="2"/>` +
      bar(21, 23, 18, "qs-ink") +
      bar(50, 23, 22) +
      bar(78, 23, 16) +
      `<path class="qs-stroke" d="M104 21v8m-4-4h8" fill="none"/>` +
      card(10, 40, 100, 26) +
      bar(16, 47, 20, "qs-keyword") +
      bar(39, 47, 34, "qs-iri") +
      bar(16, 56, 46),
  ),
  workspaces: svg(
    card(10, 6, 100, 60) +
      `<path class="qs-folder" d="M18 14h7l2 2h9v8H18z"/>` +
      bar(41, 17, 36, "qs-ink") +
      `<path class="qs-folder" d="M26 30h7l2 2h9v8H26z"/>` +
      bar(49, 33, 30, "qs-ink") +
      `<rect class="qs-brandSoft" x="30" y="45" width="74" height="12" rx="3"/>` +
      `<path class="qs-file" d="M36 47h5l3 3v5h-8z"/>` +
      bar(49, 49, 32, "qs-brandInk"),
  ),
  share: svg(
    card(6, 18, 108, 24) +
      `<path class="qs-stroke" d="M17 33a4 4 0 0 1 0-6l3-3a4 4 0 0 1 6 6m-3 3a4 4 0 0 1-6 0" fill="none"/>` +
      bar(32, 28, 54) +
      `<rect class="qs-brandFill" x="90" y="23" width="18" height="14" rx="4"/>` +
      `<path class="qs-onBrandStroke" d="M95 30l2.5 2.5L103 27" fill="none"/>` +
      `<rect class="qs-card qs-raised" x="26" y="48" width="68" height="16" rx="5"/>` +
      bar(34, 54, 52, "qs-brandInk"),
  ),
  snippets: svg(
    card(6, 6, 50, 18) +
      `<path class="qs-brandStroke" d="M15 11c-2 0-3 1-3 3v1l-2 1 2 1v1c0 2 1 3 3 3m10-10c2 0 3 1 3 3v1l2 1-2 1v1c0 2-1 3-3 3" fill="none"/>` +
      bar(33, 13, 16, "qs-ink") +
      card(6, 28, 108, 38, ' class="qs-card qs-raised"') +
      `<path class="qs-stroke" d="m12 35 3 3-3 3" fill="none"/>` +
      bar(20, 36, 40, "qs-ink") +
      `<rect class="qs-brandSoft" x="10" y="44" width="100" height="10" rx="3"/>` +
      bar(20, 47, 52, "qs-brandInk") +
      bar(20, 58, 36),
  ),
  overview: svg(
    card(6, 6, 108, 60) +
      `<circle class="qs-brand" cx="15" cy="15" r="3.5"/>` +
      bar(22, 13, 40, "qs-ink") +
      bar(12, 27, 30) +
      `<rect class="qs-brandFill" x="48" y="26" width="56" height="6" rx="3"/>` +
      bar(12, 39, 24) +
      `<rect class="qs-brandMid" x="48" y="38" width="38" height="6" rx="3"/>` +
      bar(12, 51, 28) +
      `<rect class="qs-brandSoftStrong" x="48" y="50" width="22" height="6" rx="3"/>`,
  ),
  ai: svg(
    `<rect class="qs-sunken" x="8" y="8" width="66" height="20" rx="8"/>` +
      bar(16, 16, 50, "qs-ink") +
      card(30, 34, 82, 32, ' class="qs-card qs-raised"') +
      `<path class="qs-brand" d="M40 41l1.6 3.4L45 46l-3.4 1.6L40 51l-1.6-3.4L35 46l3.4-1.6z"/>` +
      bar(50, 42, 54, "qs-keyword") +
      bar(50, 50, 40, "qs-iri") +
      bar(38, 58, 52),
  ),
  hover: svg(
    card(6, 40, 108, 26) +
      bar(14, 48, 18, "qs-keyword") +
      `<rect class="qs-iriSoft" x="34" y="46" width="40" height="8" rx="2"/>` +
      bar(36, 48, 36, "qs-iri") +
      bar(14, 58, 50) +
      card(22, 4, 76, 34, ' class="qs-card qs-raised"') +
      bar(29, 11, 32, "qs-ink") +
      bar(29, 19, 56) +
      bar(29, 27, 40) +
      `<rect class="qs-brandSoft" x="66" y="9" width="26" height="8" rx="4"/>`,
  ),
  search: svg(
    card(8, 14, 104, 22, ' class="qs-card qs-raised"') +
      `<circle class="qs-stroke" cx="20" cy="25" r="4.5" fill="none"/><path class="qs-stroke" d="m23.5 28.5 3 3" fill="none"/>` +
      bar(32, 23, 40) +
      `<rect class="qs-kbd" x="84" y="19" width="22" height="12" rx="3"/>` +
      bar(88, 23, 14) +
      `<rect class="qs-brandSoft" x="8" y="42" width="104" height="10" rx="3"/>` +
      bar(14, 45, 46, "qs-brandInk") +
      bar(14, 60, 60),
  ),
  keys: svg(
    `<rect class="qs-kbd" x="10" y="22" width="30" height="28" rx="5"/>` +
      bar(18, 34, 14, "qs-ink") +
      `<rect class="qs-kbd" x="45" y="22" width="30" height="28" rx="5"/>` +
      bar(53, 34, 14, "qs-ink") +
      `<rect class="qs-brandFill" x="80" y="22" width="30" height="28" rx="5"/>` +
      bar(88, 34, 14, "qs-onBrandBar"),
  ),
  sidePanel: svg(
    card(6, 6, 108, 60) +
      `<path class="qs-line" d="M22 6v60M62 6v60" fill="none"/>` +
      `<rect class="qs-brandSoft" x="9" y="11" width="10" height="10" rx="3"/>` +
      `<rect class="qs-text" x="11" y="27" width="6" height="6" rx="2"/>` +
      `<rect class="qs-text" x="11" y="39" width="6" height="6" rx="2"/>` +
      bar(27, 13, 26, "qs-ink") +
      bar(27, 24, 30) +
      bar(27, 32, 22) +
      bar(27, 40, 28) +
      bar(68, 13, 20, "qs-keyword") +
      bar(68, 22, 36, "qs-iri") +
      bar(68, 31, 28),
  ),
  settings: svg(
    `<rect class="qs-card" x="10" y="12" width="48" height="48" rx="8"/>` +
      `<rect class="qs-darkCard" x="62" y="12" width="48" height="48" rx="8"/>` +
      `<circle class="qs-highlight" cx="34" cy="36" r="7"/>` +
      `<path class="qs-highlightStroke" d="M34 22v3m0 22v3m-14-14h3m22 0h3m-22-10 2 2m16 16 2 2m0-20-2 2M24 46l2-2" fill="none"/>` +
      `<path class="qs-moon" d="M88 26a10 10 0 1 0 8 15 8 8 0 0 1-8-15z"/>`,
  ),
};

export default class QuickStart {
  private yasgui: Yasgui;
  private overlayEl?: HTMLDivElement;
  private dialogEl?: HTMLDivElement;
  private pages: TourPage[] = [];
  private pageIndex = 0;
  private returnFocusEl?: HTMLElement;

  constructor(yasgui: Yasgui) {
    this.yasgui = yasgui;
    yasgui.helpMenu.addItem({
      id: "quickStart",
      label: "How MatGUI works",
      icon: "compass",
      order: 10,
      onClick: () => this.open(),
    });
  }

  /** Whether this browser has seen the current version of the tour */
  public static hasBeenSeen(): boolean {
    try {
      return window.localStorage.getItem(SEEN_KEY) === TOUR_VERSION;
    } catch {
      // Without storage we can't remember a dismissal, so don't show the tour on every visit
      return true;
    }
  }

  public static markSeen() {
    try {
      window.localStorage.setItem(SEEN_KEY, TOUR_VERSION);
    } catch {
      // ignore: storage is blocked or full
    }
  }

  public isOpen(): boolean {
    return !!this.overlayEl && !this.overlayEl.hidden;
  }

  public open(page = 0) {
    QuickStart.markSeen();
    this.pages = this.buildPages();
    if (!this.overlayEl) this.draw();
    if (!this.overlayEl) return;
    if (!this.isOpen() && document.activeElement instanceof HTMLElement) {
      this.returnFocusEl = document.activeElement;
    }
    this.overlayEl.hidden = false;
    document.addEventListener("keydown", this.handleKeydown, true);
    this.showPage(page, false);
    this.dialogEl?.focus();
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
    this.yasgui.helpMenu.removeItem("quickStart");
  }

  public getPageCount(): number {
    return this.buildPages().length;
  }

  private buildPages(): TourPage[] {
    const mod = modKeyLabel();
    const yasgui = this.yasgui;
    return [
      {
        title: "Write and run a query",
        lead: "Every tab holds one SPARQL query and the endpoint it runs against.",
        items: [
          {
            title: "Pick an endpoint",
            text: "Click the endpoint at the top of the card to switch, or type the URL of any SPARQL endpoint.",
            illustration: ILLUSTRATIONS.endpoint,
          },
          {
            title: "Write with autocomplete",
            text: `Prefixes, classes and properties are suggested while you type. Press Ctrl+Space to ask for them.`,
            illustration: ILLUSTRATIONS.autocomplete,
          },
          {
            title: "Run it",
            text: `Click Run or press ${mod}+Enter. While the query runs, the button turns into Stop.`,
            illustration: ILLUSTRATIONS.run,
          },
        ],
      },
      {
        title: "Explore the results",
        lead: "Results show up below the editor, or next to it in the side-by-side layout.",
        items: [
          {
            title: "Switch views",
            text: "See the results as a table, the raw response, or a map, graph or chart when the data fits.",
            illustration: ILLUSTRATIONS.views,
          },
          {
            title: "Describe a resource",
            text: "Ctrl+click an IRI anywhere to open its properties in the describe panel, then click on to follow links.",
            illustration: ILLUSTRATIONS.describe,
          },
          {
            title: "Download the results",
            text: "Each view has its own download, such as CSV for the table, in the toolbar above the results.",
            illustration: ILLUSTRATIONS.download,
          },
        ],
      },
      {
        title: "Keep your queries",
        lead: "Your tabs, queries and results stay in this browser until you close them.",
        items: [
          {
            title: "Work in tabs",
            text: "Click + in the top bar for a new query. Double-click the title of the card to rename it.",
            illustration: ILLUSTRATIONS.tabs,
          },
          {
            title: "Save to a workspace",
            text: "Keep queries in a Git repository or a SPARQL store and open them from the Queries view.",
            illustration: ILLUSTRATIONS.workspaces,
          },
          {
            title: "Share a link",
            text: "Share copies a link with the query and the endpoint, so others open exactly what you see.",
            illustration: ILLUSTRATIONS.share,
          },
        ],
      },
      {
        title: "Let MatGUI help",
        lead: "You don't need to remember every prefix or the shape of the data.",
        items: [
          {
            title: "Insert snippets",
            text: "Insert adds ready-made patterns, like FILTER or OPTIONAL, and Prefixes adds your declarations.",
            illustration: ILLUSTRATIONS.snippets,
          },
          {
            title: "Look at the endpoint",
            text: "The Endpoint view in the side panel lists the classes and properties the endpoint holds.",
            illustration: ILLUSTRATIONS.overview,
          },
          yasgui.aiAssistant
            ? {
                title: "Ask the AI assistant",
                text: "Describe what you are looking for and get a query, or have a query explained or fixed.",
                illustration: ILLUSTRATIONS.ai,
              }
            : {
                title: "Hover an IRI",
                text: "Hover an IRI in the editor to see its label, description and type.",
                illustration: ILLUSTRATIONS.hover,
              },
        ],
      },
      {
        title: "Find your way",
        lead: "A few shortcuts get you anywhere in MatGUI.",
        items: [
          yasgui.commandPalette
            ? {
                title: "Search everything",
                text: `Press ${mod}+K to find saved queries, snippets, commands and settings.`,
                illustration: ILLUSTRATIONS.search,
              }
            : {
                title: "Use the shortcuts",
                text: "Settings lists every keyboard shortcut, like F11 for a full screen editor.",
                illustration: ILLUSTRATIONS.keys,
              },
          {
            title: "Open the side panel",
            text: `Press ${mod}+B to show or hide your saved queries and the endpoint overview.`,
            illustration: ILLUSTRATIONS.sidePanel,
          },
          {
            title: "Make it yours",
            text: "Switch between light and dark, and manage endpoints, prefixes and the editor in Settings.",
            illustration: ILLUSTRATIONS.settings,
          },
        ],
      },
    ];
  }

  private draw() {
    const overlay = document.createElement("div");
    addClass(overlay, "yasgui-quickStart");
    overlay.hidden = true;
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) this.close();
    });

    const dialog = document.createElement("div");
    addClass(dialog, "yasgui-quickStart__dialog");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "yasgui-quickStart-title");
    dialog.tabIndex = -1;
    this.dialogEl = dialog;
    overlay.appendChild(dialog);

    // Inside the Yasgui root, so it gets the theme tokens
    this.yasgui.rootEl.appendChild(overlay);
    this.overlayEl = overlay;
  }

  private showPage(index: number, focusNav = true) {
    const dialog = this.dialogEl;
    if (!dialog) return;
    const count = this.pages.length;
    this.pageIndex = Math.max(0, Math.min(index, count - 1));
    const page = this.pages[this.pageIndex];
    const last = this.pageIndex === count - 1;
    const helpUrl = this.yasgui.config.helpUrl;

    dialog.innerHTML = "";

    const header = document.createElement("div");
    addClass(header, "yasgui-quickStart__header");
    const eyebrow = document.createElement("div");
    addClass(eyebrow, "yasgui-quickStart__eyebrow");
    eyebrow.textContent = `How MatGUI works · ${this.pageIndex + 1} of ${count}`;
    const title = document.createElement("h2");
    title.id = "yasgui-quickStart-title";
    addClass(title, "yasgui-quickStart__title");
    title.textContent = page.title;
    const lead = document.createElement("p");
    addClass(lead, "yasgui-quickStart__lead");
    lead.textContent = page.lead;
    const close = document.createElement("button");
    close.type = "button";
    addClass(close, "yasgui-quickStart__close");
    close.innerHTML = icon("x", 16);
    close.title = "Close";
    close.setAttribute("aria-label", "Close the quick start");
    close.addEventListener("click", () => this.close());
    header.append(eyebrow, title, lead, close);
    dialog.appendChild(header);

    const items = document.createElement("ul");
    addClass(items, "yasgui-quickStart__items");
    for (const item of page.items) {
      const entry = document.createElement("li");
      addClass(entry, "yasgui-quickStart__item");
      const figure = document.createElement("div");
      addClass(figure, "yasgui-quickStart__illustration");
      figure.innerHTML = item.illustration;
      const body = document.createElement("div");
      const heading = document.createElement("h3");
      heading.textContent = item.title;
      const text = document.createElement("p");
      text.textContent = item.text;
      body.append(heading, text);
      entry.append(figure, body);
      items.appendChild(entry);
    }
    dialog.appendChild(items);

    const footer = document.createElement("div");
    addClass(footer, "yasgui-quickStart__footer");

    const dots = document.createElement("div");
    addClass(dots, "yasgui-quickStart__dots");
    this.pages.forEach((p, i) => {
      const dot = document.createElement("button");
      dot.type = "button";
      addClass(dot, "yasgui-quickStart__dot");
      if (i === this.pageIndex) {
        addClass(dot, "active");
        dot.setAttribute("aria-current", "step");
      }
      dot.setAttribute("aria-label", `Page ${i + 1}: ${p.title}`);
      dot.title = p.title;
      dot.addEventListener("click", () => this.showPage(i));
      dots.appendChild(dot);
    });
    footer.appendChild(dots);

    if (helpUrl) {
      const guide = document.createElement("a");
      addClass(guide, "yasgui-quickStart__guide");
      guide.href = helpUrl;
      guide.target = "_blank";
      guide.rel = "noopener noreferrer";
      guide.innerHTML = `<span>Read the full user guide</span>${icon("externalLink", 14)}`;
      footer.appendChild(guide);
    }

    const nav = document.createElement("div");
    addClass(nav, "yasgui-quickStart__nav");
    if (this.pageIndex > 0) {
      const back = document.createElement("button");
      back.type = "button";
      addClass(back, "yasgui-quickStart__button", "yasgui-quickStart__back");
      back.textContent = "Back";
      back.addEventListener("click", () => this.showPage(this.pageIndex - 1));
      nav.appendChild(back);
    } else {
      const skip = document.createElement("button");
      skip.type = "button";
      addClass(skip, "yasgui-quickStart__button", "yasgui-quickStart__skip");
      skip.textContent = "Skip";
      skip.addEventListener("click", () => this.close());
      nav.appendChild(skip);
    }
    const next = document.createElement("button");
    next.type = "button";
    addClass(next, "yasgui-quickStart__button", "yasgui-quickStart__next", "primary");
    if (last) {
      next.textContent = "Start querying";
      next.addEventListener("click", () => this.close());
    } else {
      next.innerHTML = `<span>Next</span>${icon("chevronRight", 16, 2)}`;
      next.addEventListener("click", () => this.showPage(this.pageIndex + 1));
    }
    nav.appendChild(next);
    footer.appendChild(nav);
    dialog.appendChild(footer);

    if (focusNav) next.focus();
  }

  private handleKeydown = (event: KeyboardEvent) => {
    if (!this.isOpen() || !this.dialogEl) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return;
    }
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      // Only when no other control in the dialog wants the arrows (the dialog holds buttons and a link)
      event.preventDefault();
      event.stopPropagation();
      this.showPage(this.pageIndex + (event.key === "ArrowRight" ? 1 : -1));
      return;
    }
    if (event.key === "Tab") {
      // Keep the focus inside the dialog
      const focusable = Array.from(this.dialogEl.querySelectorAll<HTMLElement>("button, a[href]"));
      if (!focusable.length) return;
      const first = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === this.dialogEl)) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && active === lastEl) {
        event.preventDefault();
        first.focus();
      } else if (!this.dialogEl.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }
  };
}
