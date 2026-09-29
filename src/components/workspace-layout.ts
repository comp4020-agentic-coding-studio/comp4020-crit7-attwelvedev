// Every width in the side-by-side workspace, decided in one place from the
// planner's own width and the saved preferences. The fold order is the
// rule: the timeline keeps room for one year, Requirements steps down by
// whole card columns and then folds to its rail, only then does the
// details sidebar shrink, and when even that can't fit, details become a
// drawer over the timeline. The dividers' drags and keys go through here
// too, so what they preview is exactly what the layout will do. Pure, so
// it runs in node without a DOM.

export interface LayoutPrefs {
  reqsWidthPx: number | null; // null = three card columns (or as many as fit)
  reqsFolded: boolean;
  detailsWidthPx: number;
}

export interface LayoutInput {
  containerPx: number;
  remPx: number;
  detailsOpen: boolean;
  prefs: LayoutPrefs;
  gridOverheadPx: number;
}

export interface LayoutResult {
  mode: "side-by-side" | "stacked";
  reqsPx: number | "rail";
  // "sheet" whenever mode is "stacked" and details are open. Phase 06
  // renders it as the interim fixed drawer; Phase 07 styles it as the sheet.
  details: { mode: "docked"; px: number } | { mode: "drawer"; px: number } | { mode: "sheet" } | { mode: "closed" };
  autoFolded: boolean;
  timelinePx: number;
}

export interface SnapTarget {
  px: number;
  label: string;
}

// In px, not rem: the details sidebar is sized for its reading measure,
// which doesn't follow the card grid.
export const DETAILS_MIN = 360;
export const DETAILS_DEFAULT = 440;
export const DETAILS_TWO_COLUMN = 680;
export const DETAILS_WIDE = 760;
export const DETAILS_MAX = 960;
export const SNAP_THRESHOLD = 16;

export const DETAILS_SNAPS: SnapTarget[] = [
  { px: DETAILS_DEFAULT, label: "Default width" },
  { px: DETAILS_TWO_COLUMN, label: "Two-column details" },
];

// How far past a minimum a drag has to go before releasing folds or
// closes, so a drag toward the edge can't come to rest partway there.
const FOLD_ZONE = 60;
const CLOSE_ZONE = 70;
// How far past the maximum a drag goes before the size label says why it
// stopped.
const WARN_PAST = 8;
const EPS = 1e-6;

function sizes(remPx: number) {
  return {
    divider: remPx,
    timelineMin: 31 * remPx,
    rail: 3 * remPx,
    reqsMin: 17.5 * remPx,
    card: 13 * remPx,
    gap: 0.6 * remPx,
    phone: 49.5 * remPx,
  };
}

// n cards and their gaps, plus the groups' padding, borders, nesting and
// scrollbar gutter around the grid.
function columnWidths(remPx: number, gridOverheadPx: number): number[] {
  const s = sizes(remPx);
  return [1, 2, 3].map((n) => gridOverheadPx + n * s.card + (n - 1) * s.gap);
}

export function reqsSnapTargets(remPx: number, gridOverheadPx: number): SnapTarget[] {
  const [one, two, three] = columnWidths(remPx, gridOverheadPx);
  return [
    { px: one, label: "One card column" },
    { px: two, label: "Two card columns" },
    { px: three, label: "Three card columns" },
  ];
}

export function snap(
  px: number,
  targets: SnapTarget[],
  threshold = SNAP_THRESHOLD,
): { px: number; target: SnapTarget | null } {
  let best: SnapTarget | null = null;
  for (const target of targets) {
    const distance = Math.abs(target.px - px);
    if (distance <= threshold && (!best || distance < Math.abs(best.px - px))) best = target;
  }
  return best ? { px: best.px, target: best } : { px, target: null };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function available(input: LayoutInput, docked: boolean): number {
  return input.containerPx - sizes(input.remPx).divider * (docked ? 2 : 1);
}

// Steps 3–5 for one assumption about whether details dock.
function fitSideBySide(input: LayoutInput, open: boolean) {
  const s = sizes(input.remPx);
  const { prefs } = input;
  const columns = columnWidths(input.remPx, input.gridOverheadPx);
  const avail = available(input, open);
  let reqs = prefs.reqsFolded ? s.rail : Math.max(s.reqsMin, prefs.reqsWidthPx ?? columns[2]);
  let details = open ? clamp(prefs.detailsWidthPx, DETAILS_MIN, DETAILS_MAX) : 0;
  let autoFolded = false;
  // Whole columns, so a free width between them drops to the one below.
  while (reqs + details + s.timelineMin > avail + EPS && reqs !== s.rail) {
    const below = columns.filter((w) => w >= s.reqsMin - EPS && w < reqs - EPS);
    if (below.length > 0) reqs = below[below.length - 1];
    else {
      reqs = s.rail;
      // Only details can force a fold: closed, one column always fits.
      autoFolded = open;
    }
  }
  if (open) details = Math.min(details, Math.max(DETAILS_MIN, avail - reqs - s.timelineMin));
  const fits = reqs + details + s.timelineMin <= avail + EPS;
  return { reqs, details, autoFolded, fits, avail };
}

export function computeLayout(input: LayoutInput): LayoutResult {
  const s = sizes(input.remPx);
  if (input.containerPx < s.phone) {
    return {
      mode: "stacked",
      reqsPx: input.prefs.reqsFolded ? "rail" : input.containerPx,
      details: input.detailsOpen ? { mode: "sheet" } : { mode: "closed" },
      autoFolded: false,
      timelinePx: input.containerPx,
    };
  }
  const reqsPx = (reqs: number) => (reqs === s.rail ? "rail" : reqs);
  if (input.detailsOpen) {
    const docked = fitSideBySide(input, true);
    if (docked.fits) {
      return {
        mode: "side-by-side",
        reqsPx: reqsPx(docked.reqs),
        details: { mode: "docked", px: docked.details },
        autoFolded: docked.autoFolded,
        timelinePx: docked.avail - docked.reqs - docked.details,
      };
    }
  }
  const closed = fitSideBySide(input, false);
  return {
    mode: "side-by-side",
    reqsPx: reqsPx(closed.reqs),
    details: input.detailsOpen
      ? { mode: "drawer", px: Math.min(DETAILS_DEFAULT, input.containerPx) }
      : { mode: "closed" },
    autoFolded: false,
    timelinePx: closed.avail - closed.reqs,
  };
}

// The widest Requirements can be: the timeline keeps its year, and docked
// details keep at least their minimum.
function reqsMax(input: LayoutInput, docked: boolean): number {
  const s = sizes(input.remPx);
  return available(input, docked) - (docked ? DETAILS_MIN : 0) - s.timelineMin;
}

function detailsMax(input: LayoutInput): number {
  const s = sizes(input.remPx);
  return Math.min(DETAILS_MAX, available(input, true) - s.rail - s.timelineMin);
}

// Saved widths are whole pixels. A snapped width rounds up, so the grid at
// a column target still has room for all its columns.
const whole = (px: number, snapped: boolean) => (snapped ? Math.ceil(px - EPS) : Math.round(px));

// Requirements at `width`. Beside docked details that would leave them
// less than their width, details give way (down to their minimum) rather
// than the engine stepping Requirements back down a column.
function reqsPrefs(prefs: LayoutPrefs, input: LayoutInput, docked: boolean, width: number): LayoutPrefs {
  const next = { ...prefs, reqsFolded: false, reqsWidthPx: width };
  if (!docked) return next;
  const room = Math.floor(available(input, true) - width - sizes(input.remPx).timelineMin);
  return room < prefs.detailsWidthPx ? { ...next, detailsWidthPx: Math.max(DETAILS_MIN, room) } : next;
}

const isDocked = (layout: LayoutResult) => layout.details.mode === "docked";
const reqsWidthOf = (layout: LayoutResult, remPx: number) =>
  layout.reqsPx === "rail" ? sizes(remPx).rail : layout.reqsPx;
const detailsWidthOf = (layout: LayoutResult, prefs: LayoutPrefs) =>
  layout.details.mode === "docked" || layout.details.mode === "drawer" ? layout.details.px : prefs.detailsWidthPx;

export interface DragOutcome {
  prefs: LayoutPrefs;
  label: string;
  warn: boolean;
  snapped: boolean;
  release: "fold" | "close" | null;
}

// `start` and `startLayout` are the preferences and layout when the drag
// began, and dx is how far the pointer has moved since. In the release
// zones, prefs hold the width at the minimum, which is what the drag shows
// until it's released.
export function dragPrefs(
  which: "reqs" | "details",
  start: LayoutPrefs,
  startLayout: LayoutResult,
  dxPx: number,
  targets: SnapTarget[],
  input: LayoutInput,
): DragOutcome {
  const s = sizes(input.remPx);
  const docked = isDocked(startLayout);
  if (which === "reqs") {
    const raw = reqsWidthOf(startLayout, input.remPx) + dxPx;
    if (raw < s.reqsMin - FOLD_ZONE) {
      return {
        prefs: reqsPrefs(start, input, docked, s.reqsMin),
        label: "Release to fold requirements",
        warn: false,
        snapped: false,
        release: "fold",
      };
    }
    const max = reqsMax(input, docked);
    const width = clamp(raw, s.reqsMin, max);
    const snapped = snap(
      width,
      targets.filter((t) => t.px >= s.reqsMin - EPS && t.px <= max + EPS),
    );
    const warn = raw > max + WARN_PAST;
    const prefs = reqsPrefs(start, input, docked, whole(snapped.px, snapped.target !== null));
    return {
      prefs,
      label: warn ? "The timeline needs room for one year" : sizeLabel(snapped, prefs.reqsWidthPx!, false),
      warn,
      snapped: snapped.target !== null,
      release: null,
    };
  }
  const raw = detailsWidthOf(startLayout, start) - dxPx;
  if (raw < DETAILS_MIN - CLOSE_ZONE) {
    return {
      prefs: { ...start, detailsWidthPx: DETAILS_MIN },
      label: "Release to close details",
      warn: false,
      snapped: false,
      release: "close",
    };
  }
  const max = detailsMax(input);
  const snapped = snap(
    clamp(raw, DETAILS_MIN, max),
    targets.filter((t) => t.px <= max + EPS),
  );
  const prefs = { ...start, detailsWidthPx: whole(snapped.px, snapped.target !== null) };
  const folds = computeLayout({ ...input, prefs }).autoFolded;
  return {
    prefs,
    label: sizeLabel(snapped, prefs.detailsWidthPx, folds),
    warn: false,
    snapped: snapped.target !== null,
    release: null,
  };
}

function sizeLabel(snapped: { target: SnapTarget | null }, px: number, folds: boolean): string {
  const base = snapped.target ? snapped.target.label : `${px} px`;
  return folds ? `${base}, requirements fold` : base;
}

// ← and → move the divider, so → widens Requirements and narrows details.
// Enter asks the caller to toggle: fold or unfold Requirements, or switch
// details between their default and wide widths.
export function keyPrefs(
  which: "reqs" | "details",
  key: string,
  shift: boolean,
  layout: LayoutResult,
  prefs: LayoutPrefs,
  input: LayoutInput,
): LayoutPrefs | "toggle" | null {
  if (key === "Enter") return "toggle";
  const s = sizes(input.remPx);
  const step = shift ? 64 : 16;
  const docked = isDocked(layout);
  if (which === "reqs") {
    const folded = layout.reqsPx === "rail";
    const width = reqsWidthOf(layout, input.remPx);
    const max = reqsMax(input, docked);
    switch (key) {
      case "ArrowLeft":
        if (folded) return null;
        // At the minimum the next step folds; above it, it stops there first.
        return width <= s.reqsMin + EPS
          ? { ...prefs, reqsFolded: true }
          : reqsPrefs(prefs, input, docked, Math.round(Math.max(s.reqsMin, width - step)));
      case "ArrowRight":
        return folded
          ? reqsPrefs(prefs, input, docked, s.reqsMin)
          : reqsPrefs(prefs, input, docked, Math.round(Math.min(max, width + step)));
      case "Home":
        return { ...prefs, reqsFolded: true };
      case "End":
        return reqsPrefs(prefs, input, docked, Math.floor(max));
      default:
        return null;
    }
  }
  const width = detailsWidthOf(layout, prefs);
  const max = detailsMax(input);
  switch (key) {
    case "ArrowLeft":
      return { ...prefs, detailsWidthPx: Math.round(Math.min(max, width + step)) };
    case "ArrowRight":
      return { ...prefs, detailsWidthPx: Math.round(Math.max(DETAILS_MIN, width - step)) };
    case "Home":
      return { ...prefs, detailsWidthPx: DETAILS_MIN };
    case "End":
      return { ...prefs, detailsWidthPx: Math.floor(max) };
    default:
      return null;
  }
}

// The rail while details forced the fold: unfold at the saved width if it
// fits beside the details minimum, else at one column, narrowing details
// to what's left either way.
export function unfoldPrefs(input: LayoutInput): { prefs: LayoutPrefs } | { error: string } {
  const s = sizes(input.remPx);
  const { prefs } = input;
  const avail = available(input, true);
  const saved = Math.max(s.reqsMin, prefs.reqsWidthPx ?? columnWidths(input.remPx, input.gridOverheadPx)[2]);
  for (const reqs of [saved, s.reqsMin]) {
    const room = Math.floor(avail - reqs - s.timelineMin);
    if (room >= DETAILS_MIN) {
      return {
        prefs: {
          reqsWidthPx: reqs === saved ? prefs.reqsWidthPx : reqs,
          reqsFolded: false,
          detailsWidthPx: Math.min(prefs.detailsWidthPx, room),
        },
      };
    }
  }
  return { error: "Not enough room for requirements and details together. Close details, or widen the window." };
}
