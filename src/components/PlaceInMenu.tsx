import { useState } from "preact/hooks";
import type { PlanView } from "../lib/domain/view";
import { dropTargets } from "./planner-logic";

interface Props {
  view: PlanView;
  code: string;
  onPlace: (term: number) => void;
  disabled?: boolean;
}

export default function PlaceInMenu({ view, code, onPlace, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  // Only offer terms that are actually reachable — the same rule a drag
  // enforces (a disallowed drop is refused) — rather than listing every
  // term with the blocked ones merely marked unusable.
  const targets = dropTargets(view, code).filter((target) => target.allowed);

  return (
    <div class="place-in-menu">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
      >
        Place in…
      </button>
      <ul hidden={!open} role="menu" aria-label={`Place ${code} in`}>
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
