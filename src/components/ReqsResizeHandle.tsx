import { useEffect, useRef, useState } from "preact/hooks";
import type { ReqsColumns, ReqsState } from "./panel-state";
import { parseFit, sizeLabel, sizeOf, snapSize, stateFor, stepSize } from "./reqs-resize";

interface Props {
  reqs: ReqsState;
  onChange: (next: ReqsState, commit: boolean) => void;
}

export default function ReqsResizeHandle({ reqs, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Starts at 3 so the server render and the first client render agree; the
  // observer below corrects it once the panes have a real width.
  const [fit, setFit] = useState<0 | ReqsColumns>(3);
  const dragging = useRef(false);
  const latest = useRef(reqs);
  if (!dragging.current) latest.current = reqs;

  // The CSS tiers already decide how many columns fit and publish it as
  // --reqs-fit on the panes, so reading it back keeps CSS the single source
  // of truth rather than repeating the tier thresholds here.
  useEffect(() => {
    const panes = ref.current?.parentElement;
    if (!panes) return;
    const read = () => setFit(parseFit(getComputedStyle(panes).getPropertyValue("--reqs-fit")));
    read();
    const observer = new ResizeObserver(read);
    observer.observe(panes);
    return () => observer.disconnect();
  }, []);

  // The handle is hidden by CSS in the stacked layout (fit 0), so this only
  // keeps the ARIA values in range there.
  const fitCols: ReqsColumns = fit === 0 ? 1 : fit;
  const size = sizeOf(reqs, fitCols);

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
    const aside = document.getElementById("requirements");
    if (!aside) return;
    const rootFontPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const next = snapSize((event.clientX - aside.getBoundingClientRect().left) / rootFontPx, fitCols);
    if (next === sizeOf(latest.current, fitCols)) return;
    latest.current = stateFor(next, latest.current);
    onChange(latest.current, false);
  }

  // A cancelled drag commits what's showing, so what you see is what's saved.
  function endDrag() {
    if (!dragging.current) return;
    dragging.current = false;
    onChange(latest.current, true);
  }

  function onKeyDown(event: KeyboardEvent) {
    const next = stepSize(size, event.key, fitCols);
    if (next === null) return;
    event.preventDefault();
    onChange(stateFor(next, reqs), true);
  }

  return (
    <div
      ref={ref}
      class="reqs-resize"
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-controls="requirements"
      aria-label="Resize requirements"
      aria-valuemin={0}
      aria-valuemax={fitCols}
      aria-valuenow={size}
      aria-valuetext={sizeLabel(size)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    />
  );
}
