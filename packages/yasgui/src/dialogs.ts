/**
 * In-app replacements for window.alert, window.confirm and window.prompt, plus toasts.
 *
 * Native dialogs block the page, can't follow the theme, and are suppressed in sandboxed iframes (where
 * `confirm()` silently returns false). These render inside the Yasgui root, so they get the theme tokens.
 */
import { addClass } from "@matdata/yasgui-utils";
import { icon } from "./icons";
import "./dialogs.scss";

let defaultHost: HTMLElement | undefined;

/** The Yasgui root that dialogs open in when a call doesn't name one (the last Yasgui instance created) */
export function setDialogHost(host: HTMLElement) {
  defaultHost = host;
}

function resolveHost(host?: HTMLElement): HTMLElement {
  if (host && host.isConnected) {
    return (host.closest(".yasgui") as HTMLElement | null) || host;
  }
  if (defaultHost && defaultHost.isConnected) return defaultHost;
  return (document.querySelector(".yasgui") as HTMLElement | null) || document.body;
}

export interface DialogOptions {
  /** Element inside the Yasgui instance the dialog belongs to (defaults to the last Yasgui instance) */
  host?: HTMLElement;
  title?: string;
}

export interface ConfirmOptions extends DialogOptions {
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive */
  danger?: boolean;
}

interface DialogButton {
  label: string;
  value: string;
  kind?: "primary" | "danger" | "secondary";
}

let dialogCounter = 0;

function openDialog(
  message: string,
  buttons: DialogButton[],
  options: DialogOptions & { cancelValue: string; extra?: HTMLElement; focus?: HTMLElement },
): Promise<string> {
  const host = resolveHost(options.host);
  const previouslyFocused = document.activeElement as HTMLElement | null;
  const id = `yasgui-dialog-${++dialogCounter}`;

  const overlay = document.createElement("div");
  addClass(overlay, "yasgui-dialog");

  const dialog = document.createElement("div");
  addClass(dialog, "yasgui-dialog__box");
  dialog.setAttribute("role", buttons.length > 1 ? "alertdialog" : "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-describedby", `${id}-message`);

  if (options.title) {
    const title = document.createElement("h2");
    addClass(title, "yasgui-dialog__title");
    title.id = `${id}-title`;
    title.textContent = options.title;
    dialog.setAttribute("aria-labelledby", title.id);
    dialog.appendChild(title);
  }

  const body = document.createElement("p");
  addClass(body, "yasgui-dialog__message");
  body.id = `${id}-message`;
  body.textContent = message;
  dialog.appendChild(body);

  if (options.extra) dialog.appendChild(options.extra);

  const actions = document.createElement("div");
  addClass(actions, "yasgui-dialog__actions");
  dialog.appendChild(actions);
  overlay.appendChild(dialog);

  return new Promise<string>((resolve) => {
    let done = false;
    const finish = (value: string) => {
      if (done) return;
      done = true;
      document.removeEventListener("keydown", onKeydown, true);
      overlay.remove();
      if (previouslyFocused && previouslyFocused.isConnected && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
      resolve(value);
    };

    const buttonEls: HTMLButtonElement[] = [];
    for (const button of buttons) {
      const el = document.createElement("button");
      el.type = "button";
      addClass(el, "yasgui-dialog__button", `yasgui-dialog__button--${button.kind || "secondary"}`);
      el.textContent = button.label;
      el.addEventListener("click", () => finish(button.value));
      actions.appendChild(el);
      buttonEls.push(el);
    }

    const focusables = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          "button, input, textarea, select, a[href], [tabindex]:not([tabindex='-1'])",
        ),
      );

    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        finish(options.cancelValue);
      } else if (event.key === "Tab") {
        // Keep focus inside the dialog
        const items = focusables();
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeydown, true);
    overlay.addEventListener("mousedown", (event) => {
      if (event.target === overlay) finish(options.cancelValue);
    });

    host.appendChild(overlay);
    const primary = buttonEls.find((_el, i) => buttons[i].kind === "primary" || buttons[i].kind === "danger");
    (options.focus || primary || buttonEls[buttonEls.length - 1])?.focus();
  });
}

/** Replacement for window.alert */
export function showAlert(message: string, options: DialogOptions = {}): Promise<void> {
  return openDialog(message, [{ label: "OK", value: "ok", kind: "primary" }], {
    ...options,
    cancelValue: "ok",
  }).then(() => undefined);
}

/** Replacement for window.confirm: resolves true when the user confirms */
export function showConfirm(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  return openDialog(
    message,
    [
      { label: options.cancelLabel || "Cancel", value: "cancel" },
      { label: options.confirmLabel || "OK", value: "confirm", kind: options.danger ? "danger" : "primary" },
    ],
    { ...options, cancelValue: "cancel" },
  ).then((value) => value === "confirm");
}

/**
 * A choice between more than two buttons, such as "Save", "Discard" and "Cancel". Resolves with the value of
 * the button that was clicked, or `cancelValue` on Escape.
 */
export function showChoice<V extends string>(
  message: string,
  choices: Array<{ label: string; value: V; kind?: "primary" | "danger" | "secondary" }>,
  cancelValue: V,
  options: DialogOptions = {},
): Promise<V> {
  return openDialog(message, choices, { ...options, cancelValue }) as Promise<V>;
}

/** Replacement for `window.prompt("Copy this:", value)`: shows the value selected, with a Copy button */
export function showCopyValue(message: string, value: string, options: DialogOptions = {}): Promise<void> {
  const field = document.createElement("input");
  field.type = "text";
  field.readOnly = true;
  field.value = value;
  addClass(field, "yasgui-dialog__field");
  field.setAttribute("aria-label", message);
  field.addEventListener("focus", () => field.select());
  const copy = () =>
    navigator.clipboard
      ?.writeText(value)
      .then(() => showToast("Copied to clipboard", { kind: "success", host: options.host }))
      .catch(() => field.select());
  const promise = openDialog(
    message,
    [
      { label: "Close", value: "close" },
      { label: "Copy", value: "copy", kind: "primary" },
    ],
    { ...options, cancelValue: "close", extra: field, focus: field },
  ).then((result) => {
    if (result === "copy") void copy();
  });
  return promise;
}

export type ToastKind = "info" | "success" | "warning" | "error";

export interface ToastOptions {
  host?: HTMLElement;
  kind?: ToastKind;
  /** Milliseconds before it hides; 0 keeps it until closed (default: 4000, or 0 when there is an action) */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

const TOAST_ICONS: Record<ToastKind, Parameters<typeof icon>[0]> = {
  info: "help",
  success: "check",
  warning: "alert",
  error: "alert",
};

function toastStack(host: HTMLElement): HTMLElement {
  let stack = host.querySelector<HTMLElement>(":scope > .yasgui-toasts");
  if (!stack) {
    stack = document.createElement("div");
    addClass(stack, "yasgui-toasts");
    stack.setAttribute("role", "region");
    stack.setAttribute("aria-label", "Notifications");
    host.appendChild(stack);
  }
  return stack;
}

/** A short message at the bottom of the screen, optionally with one action button */
export function showToast(message: string, options: ToastOptions = {}): { close: () => void } {
  const host = resolveHost(options.host);
  const kind = options.kind || "info";
  const toast = document.createElement("div");
  addClass(toast, "yasgui-toast", `yasgui-toast--${kind}`);
  toast.setAttribute("role", kind === "error" || kind === "warning" ? "alert" : "status");

  const iconEl = document.createElement("span");
  addClass(iconEl, "yasgui-toast__icon");
  iconEl.innerHTML = icon(TOAST_ICONS[kind], 16);
  toast.appendChild(iconEl);

  const text = document.createElement("span");
  addClass(text, "yasgui-toast__message");
  text.textContent = message;
  toast.appendChild(text);

  let timer: number | undefined;
  const close = () => {
    if (timer !== undefined) window.clearTimeout(timer);
    toast.remove();
  };

  if (options.action) {
    const action = document.createElement("button");
    action.type = "button";
    addClass(action, "yasgui-toast__action");
    action.textContent = options.action.label;
    const onClick = options.action.onClick;
    action.addEventListener("click", () => {
      close();
      onClick();
    });
    toast.appendChild(action);
  }

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  addClass(closeBtn, "yasgui-toast__close");
  closeBtn.setAttribute("aria-label", "Dismiss");
  closeBtn.innerHTML = icon("x", 14);
  closeBtn.addEventListener("click", close);
  toast.appendChild(closeBtn);

  toastStack(host).appendChild(toast);
  const duration = options.duration ?? (options.action ? 0 : 4000);
  if (duration > 0) timer = window.setTimeout(close, duration);
  return { close };
}
