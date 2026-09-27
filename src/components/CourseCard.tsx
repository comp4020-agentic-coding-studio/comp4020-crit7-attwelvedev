import { useState } from "preact/hooks";
import type { PlacementView, PlanView } from "../lib/domain/view";
import { isError, placeCourse, removeCourse } from "./api";
import CourseCardHeader from "./CourseCardHeader";
import CourseDetail from "./CourseDetail";
import PlaceInMenu from "./PlaceInMenu";
import { groupLabel, unplacedCount } from "./planner-logic";

// What removing this exact placement needs to undo it: not just the code
// and term, but whether it was pinned — placeCourse always inserts a fresh,
// unpinned placement, so restoring the pin (if there was one) takes a
// separate setPin call the undo handler makes only when this is non-null.
export interface RemovedPlacement {
  code: string;
  term: number;
  pinnedGroupId: string | null;
  label: string;
}

interface Props {
  view: PlanView;
  placement: PlacementView;
  planId: string;
  onChanged: (view: PlanView) => void;
  onAnnounce: (message: string) => void;
  onDragStart?: (code: string) => void;
  onDragEnd?: () => void;
  openMenuCode: string | null;
  onMenuOpenChange: (code: string, open: boolean) => void;
  onRemoved: (removed: RemovedPlacement) => void;
}

export default function CourseCard({
  view,
  placement,
  planId,
  onChanged,
  onAnnounce,
  onDragStart,
  onDragEnd,
  openMenuCode,
  onMenuOpenChange,
  onRemoved,
}: Props) {
  const course = view.courses[placement.code];
  const readOnly = view.plan.readOnly;
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Guards this card's own buttons for the duration of its own in-flight
  // request — not a global lock, so moving one card doesn't freeze others,
  // but does stop a slow connection from inviting a double-click that
  // fires the same move/remove twice.
  const [pending, setPending] = useState(false);

  async function move(term: number) {
    setPending(true);
    try {
      const result = await placeCourse(planId, placement.code, term);
      if (isError(result)) onAnnounce(result.error);
      else onChanged(result);
    } finally {
      setPending(false);
    }
  }

  async function applySuggestion(code: string, term: number) {
    setPending(true);
    try {
      const result = await placeCourse(planId, code, term);
      if (isError(result)) onAnnounce(result.error);
      else onChanged(result);
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    const removed: RemovedPlacement = {
      code: placement.code,
      term: placement.term,
      pinnedGroupId: placement.pinned ? (placement.countsToward ?? null) : null,
      label: course ? `${placement.code} — ${course.title}` : placement.code,
    };
    setPending(true);
    try {
      const result = await removeCourse(planId, placement.code);
      if (isError(result)) onAnnounce(result.error);
      else {
        onChanged(result);
        onRemoved(removed);
      }
    } finally {
      setPending(false);
    }
  }

  const stateText = {
    hard: "Blocked",
    soft: "Needs prerequisites",
    check: "Check requirements",
    available: "Available",
  }[placement.state];

  return (
    <li
      class={`course-card course-card-${placement.state}`}
      data-placed={placement.code}
      aria-busy={pending}
      // Not in the tab order (no ordinary reason to tab onto a card), but
      // focusable programmatically so the sidebar's "locate on timeline"
      // badge can move focus here, not just scroll it into view.
      tabIndex={-1}
      draggable={!readOnly}
      // Native HTML5 drag never fires from a touch gesture on any mobile
      // browser (it's mouse-only) — Planner's touch-drag effect finds
      // draggable cards through this attribute instead, delegated from the
      // planner root so touch dragging works without a second copy of
      // per-card listeners.
      data-drag-code={readOnly ? undefined : placement.code}
      title={placement.reasons.join("; ") || undefined}
      onDragStart={(event) => {
        if (readOnly) {
          event.preventDefault();
          return;
        }
        event.dataTransfer?.setData("text/plain", placement.code);
        onDragStart?.(placement.code);
      }}
      onDragEnd={() => onDragEnd?.()}
    >
      <CourseCardHeader
        code={placement.code}
        title={course?.title ?? placement.code}
        units={course ?? { units: 0, twoSemester: false }}
        grip={!readOnly}
        onOpenDetails={() => setDetailsOpen(true)}
      />
      <p
        class={`badge badge-state-${placement.state}${placement.state === "available" ? " visually-hidden" : ""}`}
      >
        {stateText}
      </p>
      {placement.reasons.length > 0 && (
        <p class="badge badge-reason">{placement.reasons.join("; ")}</p>
      )}
      {placement.verify.length > 0 && (
        <p class="badge badge-verify">Verify on P&C: {placement.verify.join("; ")}</p>
      )}
      {placement.conflictWith.length > 0 && (
        <p class="badge badge-conflict">
          {placement.loser ? "Excluded — conflicts with " : "Conflicts with "}
          {placement.conflictWith.join(", ")}
        </p>
      )}
      {course?.offeringUnknown && <p class="badge badge-unknown">No published offering — verify on P&C</p>}
      {course?.projectedTerms.includes(placement.term) && <p class="badge badge-projected">Projected offering</p>}
      <p class="course-card-allocation">
        {placement.countsToward
          ? `Counts toward ${groupLabel(view, placement.countsToward)}`
          : "Not counting toward any requirement"}
      </p>
      {placement.state === "soft" && unplacedCount(view, placement.code) > 0 && (
        <p class="badge badge-unplaced-prereqs">
          {unplacedCount(view, placement.code)} prerequisite{unplacedCount(view, placement.code) === 1 ? "" : "s"} not
          placed
        </p>
      )}
      {placement.state === "soft" && placement.suggestions.length > 0 && (
        <ul class="course-card-suggestions">
          {placement.suggestions.map((suggestion) => (
            <li key={`${suggestion.action}-${suggestion.code}-${suggestion.term}`}>
              <button
                type="button"
                disabled={readOnly || pending}
                onClick={() => applySuggestion(suggestion.code, suggestion.term)}
              >
                {suggestion.text}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div class="course-card-actions">
        <PlaceInMenu
          view={view}
          code={placement.code}
          onPlace={move}
          disabled={readOnly || pending}
          placed
          currentTerm={placement.term}
          open={openMenuCode === placement.code}
          onOpenChange={(open) => onMenuOpenChange(placement.code, open)}
        />
        <button type="button" disabled={pending} onClick={() => setDetailsOpen(true)}>
          Details
        </button>
        <button type="button" disabled={readOnly || pending} onClick={remove}>
          {pending ? "Removing…" : "Remove"}
        </button>
      </div>
      <CourseDetail
        view={view}
        code={placement.code}
        planId={planId}
        open={detailsOpen}
        onChanged={onChanged}
        onAnnounce={onAnnounce}
        onClose={() => setDetailsOpen(false)}
      />
    </li>
  );
}
