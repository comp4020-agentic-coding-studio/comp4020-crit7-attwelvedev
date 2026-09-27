import { useRef } from "preact/hooks";
import type { ReqsColumns, ReqsState, SplitStop } from "./panel-state";
import { sizeLabel, sizeOf, snapSize, stateFor, stepSize } from "./reqs-resize";
import { type Panels, panelsFor, snapSplit, splitLabel, splitSizeOf, stepSplit } from "./split-resize";

interface Props {
  reqs: ReqsState;
  split: SplitStop;
  fit: 0 | ReqsColumns;
  onChange: (next: Panels, commit: boolean) => void;
}

// One separator sits between the two panes in every layout, and the layout
// decides which axis it resizes: the sidebar's width side by side (fit 1–3),
// or the timeline/requirements split when stacked (fit 0).
export default function ReqsResizeHandle({ reqs, split, fit, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const latest = useRef<Panels>({ reqs, split });
  if (!dragging.current) latest.current = { reqs, split };

  const stacked = fit === 0;
  const fitCols: ReqsColumns = fit === 0 ? 1 : fit;
  const splitSize = splitSizeOf({ reqs, split });
  const reqsSize = sizeOf(reqs, fitCols);

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    dragging.current = true;
  }

  // Moves only preview the snapped size; the preference is saved once, on
  // release, so a drag that passes through every size doesn't write each one.
  function onPointerMove(event: PointerEvent) {
    if (!dragging.current) return;
    if (stacked) {
      const panes = ref.current?.parentElement;
      if (!panes) return;
      const rect = panes.getBoundingClientRect();
      const next = snapSplit(((event.clientY - rect.top) / rect.height) * 100);
      if (next === splitSizeOf(latest.current)) return;
      latest.current = panelsFor(next, latest.current);
      onChange(latest.current, false);
      return;
    }
    const aside = document.getElementById("requirements");
    if (!aside) return;
    const rootFontPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const next = snapSize((event.clientX - aside.getBoundingClientRect().left) / rootFontPx, fitCols);
    if (next === sizeOf(latest.current.reqs, fitCols)) return;
    latest.current = { ...latest.current, reqs: stateFor(next, latest.current.reqs) };
    onChange(latest.current, false);
  }

  // A cancelled drag commits what's showing, so what you see is what's saved.
  function endDrag() {
    if (!dragging.current) return;
    dragging.current = false;
    onChange(latest.current, true);
  }

  function onKeyDown(event: KeyboardEvent) {
    if (stacked) {
      const next = stepSplit(splitSize, event.key);
      if (next === null) return;
      event.preventDefault();
      onChange(panelsFor(next, { reqs, split }), true);
      return;
    }
    const next = stepSize(reqsSize, event.key, fitCols);
    if (next === null) return;
    event.preventDefault();
    onChange({ reqs: stateFor(next, reqs), split }, true);
  }

  return (
    <div
      ref={ref}
      class="reqs-resize"
      role="separator"
      tabIndex={0}
      aria-orientation={stacked ? "horizontal" : "vertical"}
      aria-controls="requirements"
      aria-label="Resize requirements"
      aria-valuemin={stacked ? 30 : 0}
      aria-valuemax={stacked ? 100 : fitCols}
      aria-valuenow={stacked ? splitSize : reqsSize}
      aria-valuetext={stacked ? splitLabel(splitSize) : sizeLabel(reqsSize)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    />
  );
}
