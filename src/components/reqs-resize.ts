// The requirements sidebar's resize handle only ever lands on one of four
// sizes: the collapsed rail or 1, 2 or 3 card columns. A drag snaps to
// whichever of those widths is nearest the pointer, so these widths mirror
// the --reqs-w-* tokens in src/styles.css (reqs-resize.test.ts checks they
// match). Everything here is pure, so it runs in node without a DOM.

import type { ReqsColumns, ReqsState } from "./panel-state";

export type ReqsSize = 0 | ReqsColumns; // 0 = collapsed rail

export const REQS_WIDTH_REM: Readonly<Record<ReqsSize, number>> = { 0: 3, 1: 17.5, 2: 31.1, 3: 44.7 };

// The CSS tiers publish how many columns fit as --reqs-fit on the panes;
// anything but 1–3 means the stacked layout, where nothing is resizable.
export function parseFit(raw: string): 0 | ReqsColumns {
  const fit = raw.trim();
  return fit === "1" ? 1 : fit === "2" ? 2 : fit === "3" ? 3 : 0;
}

export function sizeOf(state: ReqsState, fit: ReqsColumns): ReqsSize {
  return state.collapsed ? 0 : (Math.min(state.columns, fit) as ReqsColumns);
}

// Collapsing keeps the preferred columns, so expanding from the rail
// restores them.
export function stateFor(size: ReqsSize, prev: ReqsState): ReqsState {
  return size === 0 ? { ...prev, collapsed: true } : { collapsed: false, columns: size };
}

export function snapSize(widthRem: number, fit: ReqsColumns): ReqsSize {
  let best: ReqsSize = 0;
  for (let size = 1 as ReqsSize; size <= fit; size++) {
    const gap = Math.abs(widthRem - REQS_WIDTH_REM[size]) - Math.abs(widthRem - REQS_WIDTH_REM[best]);
    // The widths are tenths of a rem, so their midpoints aren't exact in
    // floating point; a pointer on a midpoint (within 1e-9) goes to the
    // larger size.
    if (gap <= 1e-9) best = size;
  }
  return best;
}

export function stepSize(size: ReqsSize, key: string, fit: ReqsColumns): ReqsSize | null {
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return Math.max(0, size - 1) as ReqsSize;
    case "ArrowRight":
    case "ArrowUp":
      return Math.min(fit, size + 1) as ReqsSize;
    case "Home":
      return 0;
    case "End":
      return fit;
    default:
      return null;
  }
}

export function sizeLabel(size: ReqsSize): string {
  return size === 0 ? "Collapsed" : size === 1 ? "1 column" : `${size} columns`;
}
