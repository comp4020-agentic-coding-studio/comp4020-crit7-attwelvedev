import type { PlanView } from "../lib/domain/view";
import { dropTargets } from "./planner-logic";

interface Props {
  view: PlanView;
  code: string;
  onPlace: (term: number) => void;
  disabled?: boolean;
  // A course already on the timeline is being relocated, not placed for
  // the first time — "Move to…" reads clearer than "Place in…" there.
  placed?: boolean;
  // The term the course is already sitting in, so the menu doesn't offer
  // it as a destination.
  currentTerm?: number;
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
  placed = false,
  currentTerm,
  open,
  onOpenChange,
}: Props) {
  // Only offer terms that are actually reachable — the same rule a drag
  // enforces (a disallowed drop is refused) — rather than listing every
  // term with the blocked ones merely marked unusable.
  const targets = dropTargets(view, code).filter((target) => target.allowed && target.term !== currentTerm);
  const buttonLabel = placed ? "Move to…" : "Place in…";
  const menuLabel = placed ? `Move ${code} to` : `Place ${code} in`;

  return (
    <div class="place-in-menu">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
      >
        {buttonLabel}
      </button>
      <ul hidden={!open} role="menu" aria-label={menuLabel}>
        {targets.length === 0 && <li role="none">No available terms</li>}
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
              {view.terms[target.term].label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
