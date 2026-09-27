import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ComponentChildren;
}

// A disclosure, not an ARIA menu: the prerequisite toggle stays a native
// checkbox, and nothing here needs arrow-key handling. Planner owns whether
// it's open (the same value the course menus use), so opening a course's
// "Move to…" closes this and vice versa.
export default function MoreOptions({ open, onOpenChange, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePress(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open]);

  return (
    <div
      class="more-options"
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
        aria-label="More options"
        aria-expanded={open}
        aria-controls="more-options-panel"
        onClick={() => onOpenChange(!open)}
      >
        <svg class="more-options-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="5" cy="12" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="19" cy="12" r="1.75" />
        </svg>
      </button>
      <div id="more-options-panel" class="more-options-panel" hidden={!open}>
        {children}
      </div>
    </div>
  );
}
