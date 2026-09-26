import { useState } from "preact/hooks";
import type { PlacementView, PlanView } from "../lib/domain/view";
import { isError, placeCourse } from "./api";
import CourseDetail from "./CourseDetail";
import PlaceInMenu from "./PlaceInMenu";
import { dropTargets } from "./planner-logic";

interface Props {
  view: PlanView;
  code: string;
  // Present when this course is already on the timeline — the card then
  // shows placed status instead of a "Place in…" menu and stops being
  // draggable, but stays in the list so it can be compared against the
  // group's still-unplaced courses.
  placement: PlacementView | null;
  planId: string;
  onChanged: (view: PlanView) => void;
  onAnnounce: (message: string) => void;
  onDragStart?: (code: string) => void;
  onDragEnd?: () => void;
  openMenuCode: string | null;
  onMenuOpenChange: (code: string, open: boolean) => void;
  onLocateCourse: (code: string) => void;
}

export default function AvailableCourseCard({
  view,
  code,
  placement,
  planId,
  onChanged,
  onAnnounce,
  onDragStart,
  onDragEnd,
  openMenuCode,
  onMenuOpenChange,
  onLocateCourse,
}: Props) {
  const course = view.courses[code];
  const readOnly = view.plan.readOnly;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  if (!course) return null;

  const draggable = !readOnly && !placement;

  // A course still has to be actively discovered as a dead end today (open
  // its Place in… menu, read "No available terms"), rather than the sidebar
  // just telling you up front — checked here the same way that menu already
  // does, so the two never disagree. Doesn't apply once it's placed (that
  // course's own card already carries its real state), or on a read-only
  // plan — there, dropTargets reports every term as disallowed for every
  // course (the plan itself, not this course, is why), which would flag the
  // entire sidebar as "Blocked" and say nothing useful.
  const targets = placement || readOnly ? [] : dropTargets(view, code);
  const allBlocked = !placement && !readOnly && targets.length > 0 && targets.every((t) => !t.allowed);
  const blockedReason = allBlocked
    ? Array.from(new Set(targets.map((t) => t.reason).filter((r): r is string => !!r))).join("; ")
    : null;

  async function place(term: number) {
    setPending(true);
    try {
      const result = await placeCourse(planId, code, term);
      if (isError(result)) onAnnounce(result.error);
      else onChanged(result);
    } finally {
      setPending(false);
    }
  }

  return (
    <li
      class={`course-card ${placement ? "course-card-sidebar-placed" : allBlocked ? "course-card-hard" : "course-card-unplaced"}`}
      draggable={draggable}
      // See CourseCard's identical attribute: native drag doesn't work from
      // touch, so Planner's touch-drag effect looks for this instead.
      data-drag-code={draggable ? code : undefined}
      aria-busy={pending}
      title={blockedReason ?? undefined}
      onDragStart={(event) => {
        if (!draggable) {
          event.preventDefault();
          return;
        }
        event.dataTransfer?.setData("text/plain", code);
        onDragStart?.(code);
      }}
      onDragEnd={() => onDragEnd?.()}
    >
      <strong>{code}</strong>
      <span> — {course.title}</span>
      <p class="course-card-units">
        {course.units} units, {course.offeredLabel}
      </p>
      {allBlocked && <p class="badge badge-state-hard">Blocked</p>}
      {allBlocked && blockedReason && <p class="badge badge-reason">{blockedReason}</p>}
      {placement ? (
        <p class="course-card-placed-status">
          <span class="course-card-tick" aria-hidden="true">
            ✓
          </span>
          <button
            type="button"
            class="badge badge-term-link"
            onClick={() => onLocateCourse(code)}
            aria-label={`${code} is placed in ${view.terms[placement.term].label} — locate it on the timeline`}
          >
            {view.terms[placement.term].label}
          </button>
        </p>
      ) : (
        <PlaceInMenu
          view={view}
          code={code}
          onPlace={place}
          disabled={readOnly || pending}
          open={openMenuCode === code}
          onOpenChange={(open) => onMenuOpenChange(code, open)}
        />
      )}
      <button type="button" disabled={pending} onClick={() => setDetailsOpen(true)}>
        Details
      </button>
      <CourseDetail
        view={view}
        code={code}
        planId={planId}
        open={detailsOpen}
        onChanged={onChanged}
        onAnnounce={onAnnounce}
        onClose={() => setDetailsOpen(false)}
      />
    </li>
  );
}
