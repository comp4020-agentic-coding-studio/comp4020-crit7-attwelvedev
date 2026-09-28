import { useEffect, useId, useRef } from "preact/hooks";
import type { PlanView } from "../lib/domain/view";
import { completedReadout, cutoffOptions } from "./planner-logic";

interface Props {
  view: PlanView;
  // Controlled from Planner.tsx through the same openMenuCode as More
  // options and the course menus, so only one of them is ever open.
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (cutoff: number) => void;
  pending: boolean;
}

// A disclosure in More options' design rather than a native <select>, which
// looked out of place beside it. Not a MoreOptions instance: the page's
// More options is found by its classes, and a second one earlier in the
// title row would be found first.
export default function CompletedMenu({ view, open, onOpenChange, onChoose, pending }: Props) {
  const panelId = useId();
  const descriptionId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const cutoff = view.plan.cutoff;

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
      class="completed-menu"
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        onOpenChange(false);
        toggleRef.current?.focus();
      }}
    >
      <button
        type="button"
        class="completed-toggle"
        ref={toggleRef}
        aria-expanded={open}
        aria-controls={panelId}
        aria-describedby={descriptionId}
        onClick={() => onOpenChange(!open)}
      >
        {/* Every possible label shares one grid cell, so the toggle is as wide
            as the longest and choosing a semester never shifts the row. */}
        <span class="completed-toggle-labels">
          {cutoffOptions(view.terms).map(({ value }) =>
            value === cutoff ? (
              <span key={value} data-current>
                {completedReadout(value, view.terms).short}
              </span>
            ) : (
              <span key={value} aria-hidden="true">
                {completedReadout(value, view.terms).short}
              </span>
            ),
          )}
        </span>
        <svg class="section-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div id={panelId} class="completed-panel" hidden={!open}>
        {cutoffOptions(view.terms).map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-current={value === cutoff ? "true" : undefined}
            disabled={pending}
            onClick={() => {
              onChoose(value);
              onOpenChange(false);
              toggleRef.current?.focus();
            }}
          >
            {value === cutoff && (
              <span class="completed-check" aria-hidden="true">
                ✓
              </span>
            )}
            {label}
          </button>
        ))}
      </div>
      <span id={descriptionId} class="visually-hidden">
        {completedReadout(cutoff, view.terms).full}
      </span>
    </div>
  );
}
