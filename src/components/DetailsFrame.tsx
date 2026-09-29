import { useEffect, useRef, useState } from "preact/hooks";
import type { ComponentChildren, JSX, RefObject } from "preact";
import type { DetailsState } from "./details-state";
import { type Detent, nearestDetent, nextDetent } from "./sheet-detent";
import type { LayoutResult } from "./workspace-layout";

export interface DetailsFrameProps {
  label: "Course details" | "Specialisation details";
  details: DetailsState;
  // Docked beside the timeline, a drawer over it, or (stacked) a sheet.
  mode: LayoutResult["details"]["mode"];
  // Whether the panel is wide enough for its two-column body.
  wide: boolean;
  onToggleWide: () => void;
  onBack: () => void;
  onForward: () => void;
  onClose: () => void;
  headingRef: RefObject<HTMLHeadingElement>;
  heading: ComponentChildren; // the h2's contents
  pills: ComponentChildren; // the <li>s of ul.details-pills
  footer: ComponentChildren | null; // null renders no <footer>
  children: (sheet: { peek: () => void }) => ComponentChildren; // .details-body's contents
}

// Every P&C link opens a new tab, and says so.
export function ExternalLink({ href, children }: { href: string; children: ComponentChildren }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
      <svg class="external-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 17 17 7M9 7h8v8" />
      </svg>
      <span class="visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "28 Sep 2026", in UTC so the server render and the browser agree.
export function dateLabel(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

const DETENT_ORDER: Detent[] = ["peek", "half", "full"];
const DETENT_TEXT: Record<Detent, string> = { peek: "Peek", half: "Half height", full: "Full height" };

// How far a press has to travel before it's a drag, not a tap.
const DRAG_SLOP_PX = 6;

// The phone sheet's grabber (WR44). A slider, since it has a value: a tap
// (or Enter, Space) steps to the next height and wraps, the arrow keys
// step without wrapping, and a drag follows the finger, settling at the
// nearest height on release.
function SheetHandle({
  detent,
  onDetent,
  onDrag,
}: {
  detent: Detent;
  onDetent: (next: Detent) => void;
  // The sheet's height while a drag previews one, then null.
  onDrag: (heightPx: number | null) => void;
}) {
  const drag = useRef<{ pointerId: number; startY: number; startHeight: number; moved: boolean } | null>(null);
  // A drag's release is followed by a click on the handle; it isn't a tap.
  const skipClick = useRef(false);

  const heightAt = (clientY: number) => {
    const d = drag.current!;
    return Math.min(Math.max(d.startHeight + d.startY - clientY, 0), innerHeight - 16);
  };

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    const sheet = (event.currentTarget as HTMLElement).closest(".details-panel")!;
    drag.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: sheet.getBoundingClientRect().height,
      moved: false,
    };
    skipClick.current = false;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent) {
    const d = drag.current;
    if (!d || event.pointerId !== d.pointerId) return;
    if (!d.moved && Math.abs(event.clientY - d.startY) < DRAG_SLOP_PX) return;
    d.moved = true;
    onDrag(heightAt(event.clientY));
  }

  function onPointerUp(event: PointerEvent) {
    const d = drag.current;
    if (!d || event.pointerId !== d.pointerId) return;
    if (d.moved) {
      skipClick.current = true;
      onDetent(nearestDetent(heightAt(event.clientY), innerHeight));
      onDrag(null);
    }
    drag.current = null;
  }

  // A cancelled drag goes back to where it started.
  function onPointerCancel() {
    if (drag.current?.moved) onDrag(null);
    drag.current = null;
  }

  function onKeyDown(event: KeyboardEvent) {
    const i = DETENT_ORDER.indexOf(detent);
    const step: Record<string, number> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 };
    const next =
      event.key === "Home" ? 0 : event.key === "End" ? 2 : event.key in step ? i + step[event.key] : null;
    if (next === null) return;
    event.preventDefault();
    onDetent(DETENT_ORDER[Math.min(Math.max(next, 0), 2)]);
  }

  return (
    <button
      type="button"
      class="sheet-handle"
      role="slider"
      aria-label="Resize details"
      aria-orientation="vertical"
      aria-valuemin={0}
      aria-valuemax={2}
      aria-valuenow={DETENT_ORDER.indexOf(detent)}
      aria-valuetext={DETENT_TEXT[detent]}
      onClick={() => {
        if (skipClick.current) skipClick.current = false;
        else onDetent(nextDetent(detent));
      }}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    />
  );
}

function Icon({ path }: { path: string }) {
  return (
    <svg class="details-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={path} />
    </svg>
  );
}

// The shell both details panels share: the head with its trail, sheet and
// width controls, the body's peek-hiding, and the footer. What goes inside
// (and where focus lands on open) is each panel's own.
export default function DetailsFrame({
  label,
  details,
  mode,
  wide,
  onToggleWide,
  onBack,
  onForward,
  onClose,
  headingRef,
  heading,
  pills,
  footer,
  children,
}: DetailsFrameProps): JSX.Element {
  // The sheet's height on a phone. Not saved: each subject opens at half.
  const [detent, setDetent] = useState<Detent>("half");
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  useEffect(() => setDetent("half"), [details.token]);
  const sheet = mode === "sheet";

  return (
    // The id stays the same for both kinds: the details divider's
    // aria-controls names it.
    <aside
      id="course-details"
      class="details-panel region"
      data-mode={mode}
      data-detent={sheet ? detent : undefined}
      data-dragging={(sheet && dragHeight !== null) || undefined}
      style={sheet && dragHeight !== null ? { "--sheet-h": `${dragHeight}px` } : undefined}
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div class={sheet ? "details-head sheet-head glass" : "details-head glass"}>
        <div class="details-nav">
          <button
            type="button"
            class="details-icon-button"
            aria-label="Back"
            disabled={details.index <= 0}
            onClick={onBack}
          >
            <Icon path="M15 5l-7 7 7 7" />
          </button>
          <button
            type="button"
            class="details-icon-button"
            aria-label="Forward"
            disabled={details.index >= details.history.length - 1}
            onClick={onForward}
          >
            <Icon path="M9 5l7 7-7 7" />
          </button>
          {sheet && <SheetHandle detent={detent} onDetent={setDetent} onDrag={setDragHeight} />}
          {/* Only a docked panel's width is the student's to set. */}
          {mode === "docked" && (
            <button
              type="button"
              class="details-icon-button details-wide"
              aria-pressed={wide}
              aria-label={wide ? "Narrow details" : "Widen details"}
              title={wide ? "Narrow details" : "Widen details"}
              onClick={onToggleWide}
            >
              <Icon path={wide ? "M4 12h6m0 0-3-3m3 3-3 3M20 12h-6m0 0 3-3m-3 3 3 3" : "M10 12H4m0 0 3-3m-3 3 3 3M14 12h6m0 0-3-3m3 3-3 3"} />
            </button>
          )}
          <button type="button" class="details-icon-button details-close" aria-label="Close details" onClick={onClose}>
            <Icon path="M6 6l12 12M18 6L6 18" />
          </button>
        </div>
        <h2 ref={headingRef} tabIndex={-1}>
          {heading}
        </h2>
        <ul class="details-pills">{pills}</ul>
      </div>

      {/* Its own grid, so a wide panel can lay the sections out in two
          columns (a container query on the panel's width, in CSS). */}
      {/* At the peek the sheet is its header alone; a drag shows what's coming. */}
      <div class="details-body" hidden={sheet && detent === "peek" && dragHeight === null}>
        {children({ peek: () => setDetent("peek") })}
      </div>

      {footer !== null && <footer class="details-footer">{footer}</footer>}
    </aside>
  );
}
