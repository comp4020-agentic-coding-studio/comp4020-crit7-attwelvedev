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
  // For a code that isn't (yet) in view.courses — a search result outside
  // the plan's tree — dropTargets can't look up its hardBlocked map from
  // the plan view, so the caller supplies it directly.
  hardBlockedOverride?: Record<number, string>;
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
  hardBlockedOverride,
  open,
  onOpenChange,
}: Props) {
  // Only offer terms that are actually reachable — the same rule a drag
  // enforces (a disallowed drop is refused) — rather than listing every
  // term with the blocked ones merely marked unusable.
  const allTargets = dropTargets(view, code, hardBlockedOverride).filter((target) => target.term !== currentTerm);
  const targets = allTargets.filter((target) => target.allowed);
  const buttonLabel = placed ? "Move to…" : "Place in…";
  const menuLabel = placed ? `Move ${code} to` : `Place ${code} in`;
  // When nothing's available, say why rather than leaving a dead end — the
  // same reason a drag onto a greyed-out term already shows, deduplicated
  // since several terms often share one (e.g. "not offered this semester").
  const blockedReasons = Array.from(
    new Set(allTargets.filter((target) => !target.allowed && target.reason).map((target) => target.reason as string)),
  );

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
              {view.terms[target.term].label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
