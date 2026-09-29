import { useRef } from "preact/hooks";
import type { ReqsState, SplitStop } from "./panel-state";
import { type Panels, panelsFor, snapSplit, splitLabel, splitSizeOf, stepSplit } from "./split-resize";

interface Props {
  reqs: ReqsState;
  split: SplitStop;
  onChange: (next: Panels, commit: boolean) => void;
}

// The stacked layout's separator, between the timeline and the
// requirements: it snaps their split. Side by side, WorkspaceDivider
// resizes the regions instead.
export default function ReqsResizeHandle({ reqs, split, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const latest = useRef<Panels>({ reqs, split });
  if (!dragging.current) latest.current = { reqs, split };

  const splitSize = splitSizeOf({ reqs, split });

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
    const panes = ref.current?.parentElement;
    if (!panes) return;
    const rect = panes.getBoundingClientRect();
    const next = snapSplit(((event.clientY - rect.top) / rect.height) * 100);
    if (next === splitSizeOf(latest.current)) return;
    latest.current = panelsFor(next, latest.current);
    onChange(latest.current, false);
  }

  // A cancelled drag commits what's showing, so what you see is what's saved.
  function endDrag() {
    if (!dragging.current) return;
    dragging.current = false;
    onChange(latest.current, true);
  }

  function onKeyDown(event: KeyboardEvent) {
    const next = stepSplit(splitSize, event.key);
    if (next === null) return;
    event.preventDefault();
    onChange(panelsFor(next, { reqs, split }), true);
  }

  return (
    <div
      ref={ref}
      class="reqs-resize"
      role="separator"
      tabIndex={0}
      aria-orientation="horizontal"
      aria-controls="requirements"
      aria-label="Resize requirements"
      aria-valuemin={30}
      aria-valuemax={100}
      aria-valuenow={splitSize}
      aria-valuetext={splitLabel(splitSize)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onKeyDown={onKeyDown}
    />
  );
}
