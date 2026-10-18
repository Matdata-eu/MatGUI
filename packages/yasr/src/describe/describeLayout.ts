/**
 * Size and placement of the describe panel: docked next to the results (with a resizable width),
 * floating as a movable window, or maximized over the page. The docked width and the floating
 * window are remembered in localStorage.
 */
export type DescribeMode = "docked" | "floating" | "maximized";

export interface DescribeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DescribeLayout {
  /** "docked" or "floating"; maximized is never restored after a reload. */
  mode: "docked" | "floating";
  /** Width of the docked panel in px. */
  width: number;
  /** Position and size of the floating panel, once it has been floated. */
  floating?: DescribeRect;
}

export const DEFAULT_DOCKED_WIDTH = 400;
export const MIN_PANEL_WIDTH = 280;
export const MIN_PANEL_HEIGHT = 240;
/** The docked panel always leaves this much of the results visible. */
export const MIN_RESULTS_WIDTH = 240;
/** Part of a floating panel that stays inside the window, so it can be grabbed again. */
const MIN_VISIBLE = 80;
const STORAGE_KEY = "yasr_describeLayout";

export function defaultLayout(): DescribeLayout {
  return { mode: "docked", width: DEFAULT_DOCKED_WIDTH };
}

/** Docked width within [MIN_PANEL_WIDTH, available - MIN_RESULTS_WIDTH]; the minimum wins on a narrow yasr. */
export function clampDockedWidth(width: number, available: number): number {
  const max = Math.max(MIN_PANEL_WIDTH, available - MIN_RESULTS_WIDTH);
  return Math.round(Math.min(Math.max(width, MIN_PANEL_WIDTH), max));
}

/** Keep a floating panel no larger than the window and with its title bar reachable. */
export function clampFloatingRect(rect: DescribeRect, viewport: { width: number; height: number }): DescribeRect {
  const width = Math.min(Math.max(rect.width, MIN_PANEL_WIDTH), Math.max(MIN_PANEL_WIDTH, viewport.width - 16));
  const height = Math.min(Math.max(rect.height, MIN_PANEL_HEIGHT), Math.max(MIN_PANEL_HEIGHT, viewport.height - 16));
  const x = Math.min(Math.max(rect.x, MIN_VISIBLE - width), viewport.width - MIN_VISIBLE);
  const y = Math.min(Math.max(rect.y, 0), viewport.height - 48);
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

/** Where a panel floats the first time: at the right of the window, two thirds of its height. */
export function defaultFloatingRect(viewport: { width: number; height: number }): DescribeRect {
  const width = Math.min(520, viewport.width - 48);
  const height = Math.round(viewport.height * 0.7);
  return clampFloatingRect(
    { x: viewport.width - width - 24, y: Math.round(viewport.height * 0.15), width, height },
    viewport,
  );
}

function isRect(value: any): value is DescribeRect {
  return !!value && ["x", "y", "width", "height"].every((k) => typeof value[k] === "number" && isFinite(value[k]));
}

export function loadLayout(storage: Pick<Storage, "getItem"> | undefined = safeStorage()): DescribeLayout {
  const layout = defaultLayout();
  try {
    const stored = JSON.parse(storage?.getItem(STORAGE_KEY) || "null");
    if (!stored || typeof stored !== "object") return layout;
    if (stored.mode === "floating") layout.mode = "floating";
    if (typeof stored.width === "number" && isFinite(stored.width))
      layout.width = Math.max(MIN_PANEL_WIDTH, stored.width);
    if (isRect(stored.floating)) layout.floating = stored.floating;
  } catch {
    // Unreadable storage: keep the defaults
  }
  return layout;
}

export function saveLayout(
  layout: DescribeLayout,
  storage: Pick<Storage, "setItem"> | undefined = safeStorage(),
): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Storage full or blocked: the layout just isn't remembered
  }
}

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage !== "undefined" ? localStorage : undefined;
  } catch {
    return undefined;
  }
}
