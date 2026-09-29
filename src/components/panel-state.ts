// The single owner of the collapsible panels' storage keys and <html> data
// attributes. The inline head script in src/layouts/Base.astro can't import
// this (it runs before any bundle loads, so saved state applies before first
// paint), so it mirrors the keys by hand; panel-state.test.ts checks the two
// stay in step. Everything here works on any object with a `dataset` and an
// injected storage, so it runs in node without a DOM.

import { DETAILS_DEFAULT, type LayoutPrefs } from "./workspace-layout";

export const NAV_KEY = "panel-nav";
export const REQS_KEY = "panel-reqs";

// The stacked split handle's view of the fold (LayoutPrefs.reqsFolded).
export interface ReqsState {
  collapsed: boolean;
}

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export interface DatasetHost {
  dataset: DOMStringMap;
}

// Merely touching `window.localStorage` throws when site data is blocked.
export function safeStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

// The side-by-side workspace's widths, in whole px. The fold shares
// REQS_KEY with ReqsState.collapsed, so the stacked layout's collapse and
// the side-by-side rail stay one preference.
export const REQS_W_KEY = "panel-reqs-w";
export const DETAILS_W_KEY = "panel-details-w";

export const DEFAULT_LAYOUT_PREFS: LayoutPrefs = { reqsWidthPx: null, reqsFolded: false, detailsWidthPx: DETAILS_DEFAULT };

// Anything else is a hand-edited or stale value; the layout clamps a valid
// one to what fits, so only the range a screen could plausibly use counts.
function parseWidth(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const px = Number(raw);
  return px >= 48 && px <= 4000 ? px : null;
}

export function loadLayoutPrefs(storage: StorageLike | null = safeStorage()): LayoutPrefs {
  try {
    if (!storage) return DEFAULT_LAYOUT_PREFS;
    return {
      reqsWidthPx: parseWidth(storage.getItem(REQS_W_KEY)),
      reqsFolded: storage.getItem(REQS_KEY) === "collapsed",
      detailsWidthPx: parseWidth(storage.getItem(DETAILS_W_KEY)) ?? DETAILS_DEFAULT,
    };
  } catch {
    return DEFAULT_LAYOUT_PREFS;
  }
}

export function saveLayoutPrefs(prefs: LayoutPrefs, storage: StorageLike | null = safeStorage()): void {
  try {
    if (prefs.reqsWidthPx === null) storage?.removeItem(REQS_W_KEY);
    else storage?.setItem(REQS_W_KEY, String(Math.round(prefs.reqsWidthPx)));
    storage?.setItem(DETAILS_W_KEY, String(Math.round(prefs.detailsWidthPx)));
    if (prefs.reqsFolded) storage?.setItem(REQS_KEY, "collapsed");
    else storage?.removeItem(REQS_KEY);
  } catch {
    // Not persisting is fine — the widths still apply for this page view.
  }
}

// What the head script sets before first paint, so CSS can lay the panes
// out from the saved widths before Planner has measured anything.
export function applyLayoutPrefs(
  root: DatasetHost & { style: { setProperty(n: string, v: string): void; removeProperty(n: string): void } },
  prefs: LayoutPrefs,
): void {
  if (prefs.reqsWidthPx === null) root.style.removeProperty("--reqs-pref");
  else root.style.setProperty("--reqs-pref", `${prefs.reqsWidthPx}px`);
  root.style.setProperty("--details-pref", `${prefs.detailsWidthPx}px`);
  if (prefs.reqsFolded) root.dataset.reqs = "collapsed";
  else delete root.dataset.reqs;
}

export const SPLIT_KEY = "panel-split";
export type SplitStop = 30 | 50 | 70; // the timeline's share of the stacked planner, in %
export const DEFAULT_SPLIT: SplitStop = 50;

export function parseSplit(raw: string | null | undefined): SplitStop {
  return raw === "30" ? 30 : raw === "70" ? 70 : 50;
}

export function applySplit(root: DatasetHost, split: SplitStop): void {
  if (split === DEFAULT_SPLIT) delete root.dataset.split;
  else root.dataset.split = String(split);
}

export function saveSplit(split: SplitStop, storage: StorageLike | null = safeStorage()): void {
  try {
    if (split === DEFAULT_SPLIT) storage?.removeItem(SPLIT_KEY);
    else storage?.setItem(SPLIT_KEY, String(split));
  } catch {
    // Not persisting is fine — the split still applies for this page view.
  }
}

export function setNavHidden(root: DatasetHost, hidden: boolean, storage: StorageLike | null = safeStorage()): void {
  if (hidden) root.dataset.nav = "hidden";
  else delete root.dataset.nav;
  try {
    if (hidden) storage?.setItem(NAV_KEY, "hidden");
    else storage?.removeItem(NAV_KEY);
  } catch {
    // Not persisting is fine — the nav still hides for this page view.
  }
}
