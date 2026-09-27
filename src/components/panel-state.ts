// The single owner of the collapsible panels' storage keys and <html> data
// attributes. The inline head script in src/layouts/Base.astro can't import
// this (it runs before any bundle loads, so saved state applies before first
// paint), so it mirrors the keys by hand; panel-state.test.ts checks the two
// stay in step. Everything here works on any object with a `dataset` and an
// injected storage, so it runs in node without a DOM.

export const NAV_KEY = "panel-nav";
export const REQS_KEY = "panel-reqs";
export const REQS_COLS_KEY = "panel-reqs-cols";

export type ReqsColumns = 1 | 2 | 3;
export interface ReqsState {
  collapsed: boolean;
  columns: ReqsColumns;
}
export const DEFAULT_REQS: ReqsState = { collapsed: false, columns: 3 };

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

export function parseColumns(raw: string | null | undefined): ReqsColumns {
  return raw === "1" ? 1 : raw === "2" ? 2 : 3;
}

export function reqsStateFromDataset(dataset: DOMStringMap): ReqsState {
  return { collapsed: dataset.reqs === "collapsed", columns: parseColumns(dataset.reqsCols) };
}

// The defaults are the absence of an attribute, so CSS only has to key off
// the states that differ from them.
export function applyReqsState(root: DatasetHost, state: ReqsState): void {
  if (state.collapsed) root.dataset.reqs = "collapsed";
  else delete root.dataset.reqs;
  if (state.columns === 3) delete root.dataset.reqsCols;
  else root.dataset.reqsCols = String(state.columns);
}

export function saveReqsState(state: ReqsState, storage: StorageLike | null = safeStorage()): void {
  try {
    if (state.collapsed) storage?.setItem(REQS_KEY, "collapsed");
    else storage?.removeItem(REQS_KEY);
    storage?.setItem(REQS_COLS_KEY, String(state.columns));
  } catch {
    // Not persisting is fine — the sidebar still resizes for this page view.
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
