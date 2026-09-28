import { useEffect, useRef } from "preact/hooks";
import type { PlanView } from "../lib/domain/view";
import { menuTargets } from "./planner-logic";

interface Props {
  view: PlanView;
  code: string;
  onPlace: (term: number) => void;
  disabled?: boolean;
  // For a code that isn't (yet) in view.courses — a search result outside
  // the plan's tree — dropTargets can't look up its hardBlocked map from
  // the plan view, so the caller supplies it directly.
  hardBlockedOverride?: Record<number, string>;
  // Likewise for a search result: whether each option should name the two
  // semesters the course would take up.
  twoSemester?: boolean;
  // Controlled from Planner.tsx, keyed by course code, so opening one
  // menu anywhere on the page closes whichever other one was open.
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PlaceInMenu({
  view,
  code,
  onPlace,
  disabled = false,
  hardBlockedOverride,
  twoSemester,
  open,
  onOpenChange,
}: Props) {
  // Only offer terms that are actually reachable — the same rule a drag
  // enforces (a disallowed drop is refused) — rather than listing every
  // term with the blocked ones merely marked unusable.
  const { targets, blockedReasons } = menuTargets(view, code, { hardBlockedOverride, twoSemester });
  const rootRef = useRef<HTMLDivElement>(null);

  // Same as MoreOptions: any press outside closes it — including one on
  // the menu's own card, since that's where a drag starts and the open
  // list would otherwise be dragged along with the card.
  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePress(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open]);

  return (
    <div class="place-in-menu" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
      >
        Place in…
      </button>
      <ul hidden={!open} role="menu" aria-label={`Place ${code} in`}>
        {targets.length === 0 && (
          <li role="none">
            No available terms
            {blockedReasons.length > 0 && <> — {blockedReasons.join("; ")}</>}
          </li>
        )}
        {targets.map((target) => (
          <li key={target.term} role="none">
            <button
              type="button"
              role="menuitem"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                onPlace(target.term);
                onOpenChange(false);
              }}
            >
              {target.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
