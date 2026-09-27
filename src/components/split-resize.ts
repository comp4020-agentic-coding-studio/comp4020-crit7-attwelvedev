// The stacked counterpart of reqs-resize.ts: the same snapping model on the
// other axis. The handle between the stacked timeline and requirements only
// ever lands on a 30%, 50% or 70% timeline share, or Collapsed, which counts
// as a 100% timeline so a drag snaps to it past the 85% midpoint. Everything
// here is pure, so it runs in node without a DOM.

import type { ReqsState, SplitStop } from "./panel-state";
import { nearestIndex } from "./reqs-resize";

export type SplitSize = SplitStop | 100; // 100 = requirements collapsed to the bar

export const SPLIT_SIZES: readonly SplitSize[] = [30, 50, 70, 100];

export interface Panels {
  reqs: ReqsState;
  split: SplitStop;
}

export function splitSizeOf(panels: Panels): SplitSize {
  return panels.reqs.collapsed ? 100 : panels.split;
}

// Collapsing keeps the split, so expanding from the bar restores it.
export function panelsFor(size: SplitSize, prev: Panels): Panels {
  return size === 100
    ? { ...prev, reqs: { ...prev.reqs, collapsed: true } }
    : { reqs: { ...prev.reqs, collapsed: false }, split: size };
}

export function snapSplit(sharePct: number): SplitSize {
  return SPLIT_SIZES[nearestIndex(sharePct, SPLIT_SIZES)];
}

export function stepSplit(size: SplitSize, key: string): SplitSize | null {
  const index = SPLIT_SIZES.indexOf(size);
  switch (key) {
    case "ArrowUp":
      return SPLIT_SIZES[Math.max(0, index - 1)];
    case "ArrowDown":
      return SPLIT_SIZES[Math.min(SPLIT_SIZES.length - 1, index + 1)];
    case "Home":
      return 30;
    case "End":
      return 100;
    default:
      return null;
  }
}

export function splitLabel(size: SplitSize): string {
  return size === 100 ? "Requirements hidden" : `Timeline ${size}%`;
}
