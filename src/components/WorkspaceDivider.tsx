import { useRef, useState } from "preact/hooks";
import {
  dividerValue,
  type DragOutcome,
  dragPrefs,
  keyPrefs,
  type LayoutInput,
  type LayoutPrefs,
  type LayoutResult,
  type SnapTarget,
} from "./workspace-layout";

interface Props {
  which: "reqs" | "details";
  layout: LayoutResult;
  input: LayoutInput;
  targets: SnapTarget[];
  onPreview: (prefs: LayoutPrefs) => void;
  onCommit: (prefs: LayoutPrefs, release: "fold" | "close" | null) => void;
  onToggle: () => void;
  onReset: () => void;
  // Just before a drag's first move, so the caller can measure what the
  // drag's snap targets depend on.
  onDragStart?: () => void;
}

const NAMES = { reqs: "Resize requirements", details: "Resize course details" };
const CONTROLS = { reqs: "requirements", details: "course-details" };

// The line between two workspace regions. A drag resizes freely, snapping
// softly near the widths worth landing on, and says what it'll land on in
// a frosted label while the pointer is down; the width is saved once, on
// release. Every rule lives in workspace-layout.ts, so this only routes
// pointer and key events there.
export default function WorkspaceDivider({
  which,
  layout,
  input,
  targets,
  onPreview,
  onCommit,
  onToggle,
  onReset,
  onDragStart,
}: Props) {
  // Everything the drag measures from is fixed when it starts, so a
  // preview re-render doesn't move the drag's origin.
  const drag = useRef<{ x: number; prefs: LayoutPrefs; layout: LayoutResult; input: LayoutInput } | null>(null);
  const last = useRef<DragOutcome | null>(null);
  const [tip, setTip] = useState<{ label: string; warn: boolean } | null>(null);
  const value = dividerValue(which, layout, input, targets);

  // No transitions while dragging: the region should follow the pointer.
  function setResizing(el: HTMLElement, on: boolean) {
    el.closest(".planner-panes")?.classList.toggle("resizing", on);
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    const el = event.currentTarget as HTMLElement;
    el.setPointerCapture(event.pointerId);
    onDragStart?.();
    drag.current = { x: event.clientX, prefs: input.prefs, layout, input };
    last.current = null;
    setResizing(el, true);
    setTip({ label: value.text, warn: false });
  }

  function onPointerMove(event: PointerEvent) {
    const start = drag.current;
    if (!start) return;
    const outcome = dragPrefs(which, start.prefs, start.layout, event.clientX - start.x, targets, start.input);
    last.current = outcome;
    onPreview(outcome.prefs);
    setTip({ label: outcome.label, warn: outcome.warn });
  }

  // A cancelled drag commits what's showing, so what you see is what's saved.
  function endDrag(event: PointerEvent) {
    const start = drag.current;
    if (!start) return;
    drag.current = null;
    setResizing(event.currentTarget as HTMLElement, false);
    setTip(null);
    const outcome = last.current;
    if (outcome) onCommit(outcome.prefs, outcome.release);
    else onCommit(start.prefs, null);
  }

  function onKeyDown(event: KeyboardEvent) {
    const next = keyPrefs(which, event.key, event.shiftKey, layout, input.prefs, input);
    if (next === null) return;
    event.preventDefault();
    if (next === "toggle") onToggle();
    else onCommit(next, null);
  }

  return (
    <div
      class={`workspace-divider workspace-divider-${which}`}
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-controls={CONTROLS[which]}
      aria-label={NAMES[which]}
      aria-valuemin={value.min}
      aria-valuemax={value.max}
      aria-valuenow={value.now}
      aria-valuetext={value.text}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onDblClick={onReset}
      onKeyDown={onKeyDown}
    >
      {tip && (
        <span class="size-tip glass" data-warn={tip.warn || undefined} aria-hidden="true">
          {tip.label}
        </span>
      )}
    </div>
  );
}
