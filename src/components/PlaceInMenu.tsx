import { useState } from "preact/hooks";
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
}

export default function PlaceInMenu({ view, code, onPlace, disabled = false, placed = false }: Props) {
  const [open, setOpen] = useState(false);
  // Only offer terms that are actually reachable — the same rule a drag
  // enforces (a disallowed drop is refused) — rather than listing every
  // term with the blocked ones merely marked unusable.
  const targets = dropTargets(view, code).filter((target) => target.allowed);
  const buttonLabel = placed ? "Move to…" : "Place in…";
  const menuLabel = placed ? `Move ${code} to` : `Place ${code} in`;

  return (
    <div class="place-in-menu">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
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
                setOpen(false);
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
