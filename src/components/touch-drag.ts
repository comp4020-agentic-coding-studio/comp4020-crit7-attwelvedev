import { useEffect, useRef } from "preact/hooks";

export type TouchDropTarget = { kind: "term"; term: number } | { kind: "remove" };

interface TouchDragCallbacks {
  onDragStart: (code: string) => void;
  onDragEnd: () => void;
  onDrop: (target: TouchDropTarget, code: string) => void;
  // How many terms the dragged course takes. A two-semester course's
  // outline also covers the next term, which may sit in the next year's
  // group, so it's marked by class rather than by a sibling selector.
  spanOf?: (code: string) => 1 | 2;
}

// Native HTML5 drag-and-drop (`draggable`, dragstart/dragover/drop) never
// fires from a touch gesture on any mobile browser — it's a mouse-only API.
// On a phone, "drag a course onto a semester" wasn't a convenience next to
// Place in…, it was simply impossible: this is the only implementation of
// that interaction that exists for touch at all.
//
// Hold-then-drag, not drag-on-first-move: a touch column both scrolls
// (vertically in the aside, horizontally in the timeline) and hosts
// draggable cards, and there's no reliable way to tell a swipe-to-scroll
// from a drag-to-place from their first few pixels of movement. Waiting for
// a short stationary hold before arming the drag is the same trick most
// mobile reordering UIs use (press-and-hold, then drag) — a quick swipe
// still scrolls normally, and only a deliberate pause-then-move starts a
// drag.
const HOLD_MS = 300;
const MOVE_CANCEL_PX = 10;

interface DragState {
  code: string;
  pointerId: number;
  startX: number;
  startY: number;
  armed: boolean;
  holdTimer: ReturnType<typeof setTimeout>;
  ghost: HTMLElement | null;
  sourceCard: HTMLElement;
}

function positionGhost(ghost: HTMLElement, x: number, y: number) {
  // Offset so the ghost sits just below-right of the fingertip rather than
  // directly under it — centered-under-finger hides the exact drop point
  // this card would land on, which the finger itself is obscuring already.
  ghost.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
}

function findHoverTarget(x: number, y: number): Element | null {
  const el = document.elementFromPoint(x, y);
  return el?.closest("[data-term], aside[aria-label='requirements']") ?? null;
}

function resolveDrop(x: number, y: number): TouchDropTarget | null {
  const el = document.elementFromPoint(x, y);
  const termEl = el?.closest("[data-term]");
  if (termEl) {
    const term = Number(termEl.getAttribute("data-term"));
    return Number.isFinite(term) ? { kind: "term", term } : null;
  }
  if (el?.closest("aside[aria-label='requirements']")) return { kind: "remove" };
  return null;
}

// Delegated on the planner root rather than attached per-card: cards mount
// and unmount constantly as placements change, and a single set of
// listeners that finds its target via `closest("[data-drag-code]")` at
// pointerdown time never needs re-registering as the list underneath it
// changes.
export function useTouchDrag(rootRef: { current: HTMLElement | null }, callbacks: TouchDragCallbacks) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let state: DragState | null = null;

    function clearHoverHighlight() {
      root!.querySelectorAll(".drag-hover-target").forEach((el) => el.classList.remove("drag-hover-target"));
      root!.querySelectorAll(".drag-hover-next").forEach((el) => el.classList.remove("drag-hover-next"));
    }

    // A blocked term keeps its greying, not an outline, and so does the
    // term after it.
    function highlightHover(target: Element | null, code: string) {
      if (!target) return;
      target.classList.add("drag-hover-target");
      const term = target.getAttribute("data-term");
      if (term === null || target.classList.contains("term-disallowed")) return;
      if (callbacksRef.current.spanOf?.(code) !== 2) return;
      root!.querySelector(`[data-term="${Number(term) + 1}"]`)?.classList.add("drag-hover-next");
    }

    function cleanup() {
      state?.ghost?.remove();
      state?.sourceCard.classList.remove("drag-source-active");
      clearHoverHighlight();
    }

    function arm(s: DragState) {
      s.armed = true;
      const rect = s.sourceCard.getBoundingClientRect();
      const ghost = s.sourceCard.cloneNode(true) as HTMLElement;
      ghost.classList.add("drag-ghost", "glass");
      ghost.style.width = `${rect.width}px`;
      ghost.removeAttribute("data-drag-code");
      document.body.appendChild(ghost);
      s.ghost = ghost;
      s.sourceCard.classList.add("drag-source-active");
      positionGhost(ghost, s.startX, s.startY);
      callbacksRef.current.onDragStart(s.code);
    }

    function onPointerDown(event: PointerEvent) {
      if (event.pointerType !== "touch") return; // mouse/pen keep native HTML5 DnD
      const card = (event.target as Element | null)?.closest<HTMLElement>("[data-drag-code]");
      const code = card?.getAttribute("data-drag-code");
      if (!card || !code) return;
      const next: DragState = {
        code,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        armed: false,
        ghost: null,
        sourceCard: card,
        holdTimer: setTimeout(() => {
          if (state === next) arm(next);
        }, HOLD_MS),
      };
      state = next;
    }

    function onPointerMove(event: PointerEvent) {
      if (!state || event.pointerId !== state.pointerId) return;
      if (!state.armed) {
        const dx = Math.abs(event.clientX - state.startX);
        const dy = Math.abs(event.clientY - state.startY);
        // Moved before the hold fired: a scroll, not a drag. Let go and let
        // the browser's own touch scrolling handle it from here.
        if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
          clearTimeout(state.holdTimer);
          state = null;
        }
        return;
      }
      event.preventDefault();
      if (state.ghost) positionGhost(state.ghost, event.clientX, event.clientY);
      clearHoverHighlight();
      highlightHover(findHoverTarget(event.clientX, event.clientY), state.code);
    }

    function onPointerUp(event: PointerEvent) {
      if (!state || event.pointerId !== state.pointerId) return;
      clearTimeout(state.holdTimer);
      const { armed, code } = state;
      const { clientX, clientY } = event;
      cleanup();
      state = null;
      if (!armed) return;
      callbacksRef.current.onDragEnd();
      const target = resolveDrop(clientX, clientY);
      if (target) callbacksRef.current.onDrop(target, code);
    }

    function onPointerCancel(event: PointerEvent) {
      if (!state || event.pointerId !== state.pointerId) return;
      clearTimeout(state.holdTimer);
      const wasArmed = state.armed;
      cleanup();
      state = null;
      if (wasArmed) callbacksRef.current.onDragEnd();
    }

    root.addEventListener("pointerdown", onPointerDown, { passive: true });
    root.addEventListener("pointermove", onPointerMove, { passive: false });
    root.addEventListener("pointerup", onPointerUp);
    root.addEventListener("pointercancel", onPointerCancel);
    return () => {
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("pointerup", onPointerUp);
      root.removeEventListener("pointercancel", onPointerCancel);
      if (state) {
        clearTimeout(state.holdTimer);
        cleanup();
      }
    };
    // Registered once: the delegated listeners never need the current
    // code/view, only callbacksRef (always fresh — see above) and the DOM,
    // which they query live at the moment they need it.
  }, [rootRef]);
}
