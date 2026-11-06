import type Yasqe from "./";

/** Lucide icons (https://lucide.dev, ISC license) used by the share popup */
const ICONS = {
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  terminal: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
  scissors:
    '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12"/><path d="M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
  alert:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
};
type IconName = keyof typeof ICONS;

function svg(name: IconName, size = 15): string {
  return `<svg class="yasqe_shareIcon" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Older browsers and non-secure contexts
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  document.body.appendChild(textArea);
  textArea.select();
  try {
    if (!document.execCommand("copy")) throw new Error("Copy command not supported");
  } finally {
    textArea.remove();
  }
}

/** Options of the share link that the popup lets the user pick */
export interface ShareLinkOptions {
  /** Open the link with the query editor hidden, showing only the results */
  hideQuery?: boolean;
}

let openPopup: { close: () => void; trigger: HTMLElement } | undefined;

/**
 * The popup of the Share button: the link to the query (with a Copy button, an optional
 * "query hidden" option and an optional shortener) and the query as a cURL, PowerShell or
 * wget command.
 */
export function showSharePopup(yasqe: Yasqe, anchor: HTMLElement, trigger: HTMLElement) {
  // A second click on the Share button closes the popup
  if (openPopup && openPopup.trigger === trigger) {
    openPopup.close();
    return undefined;
  }
  openPopup?.close();
  const config = yasqe.config;
  const createLink = config.createShareableLink;

  const popup = el("div", "yasqe_sharePopup");
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "Share query");
  anchor.appendChild(popup);

  const resetTimers: number[] = [];
  const close = (returnFocus = false) => {
    popup.remove();
    resetTimers.forEach((t) => clearTimeout(t));
    document.removeEventListener("mousedown", onOutside, true);
    document.removeEventListener("keydown", onKeydown, true);
    trigger.setAttribute("aria-expanded", "false");
    if (openPopup === handle) openPopup = undefined;
    if (returnFocus) trigger.focus();
  };
  const handle = { close: () => close(), trigger };
  openPopup = handle;
  const onOutside = (event: MouseEvent) => {
    const target = event.target as Node | null;
    if (target && (popup.contains(target) || trigger.contains(target))) return;
    close();
  };
  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    close(true);
  };
  document.addEventListener("mousedown", onOutside, true);
  document.addEventListener("keydown", onKeydown, true);
  trigger.setAttribute("aria-expanded", "true");

  // Header
  const header = el("div", "yasqe_sharePopup_header");
  header.appendChild(el("div", "yasqe_sharePopup_title", "Share query"));
  const closeBtn = el("button", "yasqe_sharePopup_close");
  closeBtn.type = "button";
  closeBtn.title = "Close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.innerHTML = svg("x", 16);
  closeBtn.addEventListener("click", () => close(true));
  header.appendChild(closeBtn);
  popup.appendChild(header);

  const status = el("div", "yasqe_sharePopup_status");
  status.setAttribute("role", "status");
  status.hidden = true;
  const showError = (message: string) => {
    status.textContent = message;
    status.hidden = false;
  };

  /** Copy the text and show "Copied" on the button for a moment */
  const copyFrom = async (button: HTMLButtonElement, text: string) => {
    status.hidden = true;
    try {
      await writeClipboard(text);
    } catch (err) {
      console.error("Failed to copy to clipboard:", err);
      showError("Could not copy to the clipboard. Select the text and copy it yourself.");
      return;
    }
    const label = button.querySelector(".yasqe_sharePopup_copyLabel");
    if (!label) return;
    button.classList.add("copied");
    button.querySelector(".yasqe_shareIcon")?.remove();
    button.insertAdjacentHTML("afterbegin", svg("check", 14));
    label.textContent = "Copied";
    resetTimers.push(
      window.setTimeout(() => {
        button.classList.remove("copied");
        button.querySelector(".yasqe_shareIcon")?.remove();
        button.insertAdjacentHTML("afterbegin", svg("copy", 14));
        label.textContent = "Copy";
      }, 1600),
    );
  };

  const copyButton = (className: string, title: string) => {
    const button = el("button", `yasqe_sharePopup_copy ${className}`);
    button.type = "button";
    button.title = title;
    button.innerHTML = `${svg("copy", 14)}<span class="yasqe_sharePopup_copyLabel">Copy</span>`;
    return button;
  };

  // Link
  if (createLink) {
    const section = el("div", "yasqe_sharePopup_section");
    section.appendChild(el("div", "yasqe_sharePopup_label", "Link"));

    const options: ShareLinkOptions = {};
    const hideQueryDefault = config.shareHideQueryOption;
    if (hideQueryDefault) options.hideQuery = !!hideQueryDefault(yasqe);
    const linkFor = () => createLink(yasqe, options);

    const row = el("div", "yasqe_sharePopup_linkRow");
    const linkIcon = el("span", "yasqe_sharePopup_linkIcon");
    linkIcon.innerHTML = svg("link", 14);
    row.appendChild(linkIcon);
    const input = el("input", "yasqe_sharePopup_url");
    input.type = "text";
    input.readOnly = true;
    input.value = linkFor();
    input.setAttribute("aria-label", "Link to this query");
    input.addEventListener("focus", () => input.select());
    row.appendChild(input);
    const copyLink = copyButton("yasqe_sharePopup_copyLink", "Copy the link");
    copyLink.addEventListener("click", () => copyFrom(copyLink, input.value));
    row.appendChild(copyLink);
    section.appendChild(row);

    if (hideQueryDefault) {
      const option = el("label", "yasqe_sharePopup_option");
      const checkbox = el("input", "yasqe_sharePopup_hideQuery");
      checkbox.type = "checkbox";
      checkbox.checked = !!options.hideQuery;
      checkbox.addEventListener("change", () => {
        options.hideQuery = checkbox.checked;
        input.value = linkFor();
      });
      option.appendChild(checkbox);
      const text = el("span");
      text.appendChild(el("span", "yasqe_sharePopup_optionTitle", "Show only the results"));
      text.appendChild(el("span", "yasqe_sharePopup_optionHint", "The link opens with the query hidden"));
      option.appendChild(text);
      section.appendChild(option);
    }

    const createShortLink = config.createShortLink;
    if (createShortLink) {
      const shorten = el("button", "yasqe_sharePopup_action yasqe_sharePopup_shorten");
      shorten.type = "button";
      shorten.innerHTML = `${svg("scissors", 14)}<span>Shorten link</span>`;
      shorten.addEventListener("click", async () => {
        const label = shorten.querySelector("span")!;
        shorten.disabled = true;
        label.textContent = "Shortening…";
        status.hidden = true;
        try {
          input.value = await createShortLink(yasqe, linkFor());
          label.textContent = "Shortened";
          await copyFrom(copyLink, input.value);
        } catch (err) {
          label.textContent = "Shorten link";
          shorten.disabled = false;
          const message =
            typeof err === "string" && err ? err : (err as Error)?.message ? (err as Error).message : undefined;
          showError(message || "Failed to shorten the link");
        }
      });
      section.appendChild(shorten);
    }
    popup.appendChild(section);
  }

  // Command line
  const section = el("div", "yasqe_sharePopup_section");
  section.appendChild(el("div", "yasqe_sharePopup_label", "Command line"));
  const commands: Array<[string, string, () => string]> = [
    ["cURL", "curl", () => yasqe.getAsCurlString()],
    ["PowerShell", "powershell", () => yasqe.getAsPowerShellString()],
    ["wget", "wget", () => yasqe.getAsWgetString()],
  ];
  const list = el("div", "yasqe_sharePopup_commands");
  for (const [label, id, build] of commands) {
    const button = el("button", `yasqe_sharePopup_command yasqe_sharePopup_${id}`);
    button.type = "button";
    button.title = `Copy the query as a ${label} command`;
    button.innerHTML = `${svg("terminal", 14)}<span class="yasqe_sharePopup_commandName"></span><span class="yasqe_sharePopup_copyHint">${svg("copy", 13)}<span class="yasqe_sharePopup_copyLabel">Copy</span></span>`;
    button.querySelector(".yasqe_sharePopup_commandName")!.textContent = label;
    const hint = button.querySelector<HTMLElement>(".yasqe_sharePopup_copyHint")!;
    button.addEventListener("click", async () => {
      let text: string;
      try {
        text = build();
      } catch (err) {
        showError((err as Error)?.message || `Could not create the ${label} command`);
        return;
      }
      // The check mark and "Copied" go on the hint at the right of the row
      status.hidden = true;
      try {
        await writeClipboard(text);
      } catch (err) {
        console.error("Failed to copy to clipboard:", err);
        showError("Could not copy to the clipboard.");
        return;
      }
      button.classList.add("copied");
      hint.innerHTML = `${svg("check", 13)}<span class="yasqe_sharePopup_copyLabel">Copied</span>`;
      resetTimers.push(
        window.setTimeout(() => {
          button.classList.remove("copied");
          hint.innerHTML = `${svg("copy", 13)}<span class="yasqe_sharePopup_copyLabel">Copy</span>`;
        }, 1600),
      );
    });
    list.appendChild(button);
  }
  section.appendChild(list);
  if (yasqe.hasAuthenticationCredentials()) {
    const note = el("div", "yasqe_sharePopup_warning");
    note.innerHTML = svg("alert", 14);
    note.appendChild(el("span", undefined, "The commands include the credentials of this endpoint."));
    section.appendChild(note);
  }
  popup.appendChild(section);
  popup.appendChild(status);

  // Below the button when there is room, otherwise above it
  const place = () => {
    if (!popup.isConnected) return;
    const anchorRect = anchor.getBoundingClientRect();
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const height = popup.offsetHeight;
    if (spaceBelow < height + 16 && anchorRect.top > spaceBelow) {
      popup.classList.add("above");
    } else {
      popup.classList.remove("above");
    }
    // On a narrow screen the popup would stick out on the left: span the viewport instead
    if (popup.getBoundingClientRect().left < 8) {
      popup.classList.remove("above");
      popup.style.position = "fixed";
      popup.style.left = "12px";
      popup.style.right = "12px";
      popup.style.width = "auto";
      popup.style.top = `${Math.max(8, anchorRect.bottom + 6)}px`;
    }
  };
  if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(place);
  else setTimeout(place, 0);

  (popup.querySelector<HTMLElement>(".yasqe_sharePopup_copyLink") || closeBtn).focus();
  return handle;
}
