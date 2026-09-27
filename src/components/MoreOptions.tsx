import type { ComponentChildren } from "preact";
import { useEffect, useId, useLayoutEffect, useRef } from "preact/hooks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Each course card has its own, so the toggle names which one it opens.
  label?: string;
  class?: string;
  // Float the panel over the page, placed from the toggle, instead of
  // hanging it off the toggle: a panel inside the timeline's horizontal
  // scroller is otherwise clipped at the column's content height.
  fixed?: boolean;
  children: ComponentChildren;
}

const GUTTER = 8;
const GAP = 4;

// A disclosure, not an ARIA menu: the prerequisite toggle stays a native
// checkbox, and nothing here needs arrow-key handling. Planner owns whether
// it's open (the same value the course menus use), so opening a course's
// menu closes this and vice versa.
export default function MoreOptions({ open, onOpenChange, label, class: className, fixed = false, children }: Props) {
  // One per instance: every timeline card renders its own panel.
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePress(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open]);

  // Placed before paint, written straight onto the element so it never
  // shows at the wrong spot: below the toggle, flipped above when there's
  // no room, else pinned to the bottom; end-aligned to the toggle and kept
  // inside the viewport. A scroll would leave it behind while its toggle
  // moves, so any scroll outside it (or a resize) closes it instead.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const toggle = toggleRef.current;
    if (!fixed || !open || !panel || !toggle) return;
    panel.style.maxHeight = `${window.innerHeight - 2 * GUTTER}px`;
    const t = toggle.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    let top: number;
    if (window.innerHeight - t.bottom - GUTTER >= height + GAP) top = t.bottom + GAP;
    else if (t.top - GUTTER >= height + GAP) top = t.top - GAP - height;
    else top = Math.max(GUTTER, window.innerHeight - GUTTER - height);
    const left = Math.min(Math.max(GUTTER, t.right - width), window.innerWidth - GUTTER - width);
    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;

    function closeOnScroll(event: Event) {
      if (!panel!.contains(event.target as Node)) onOpenChange(false);
    }
    function close() {
      onOpenChange(false);
    }
    window.addEventListener("scroll", closeOnScroll, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", closeOnScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open, fixed]);

  return (
    <div
      class={`more-options${className ? ` ${className}` : ""}`}
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        onOpenChange(false);
        toggleRef.current?.focus();
      }}
    >
      <button
        type="button"
        class="more-options-toggle"
        ref={toggleRef}
        aria-label={label ?? "More options"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
      >
        <svg class="more-options-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="5" cy="12" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="19" cy="12" r="1.75" />
        </svg>
      </button>
      <div
        id={panelId}
        ref={panelRef}
        class={`more-options-panel${fixed ? " more-options-panel-fixed" : ""}`}
        hidden={!open}
      >
        {children}
      </div>
    </div>
  );
}
