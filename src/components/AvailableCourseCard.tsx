import { useState } from "preact/hooks";
import type { PlacementView, PlanView } from "../lib/domain/view";
import { isError, placeCourse } from "./api";
import CourseDetail from "./CourseDetail";
import PlaceInMenu from "./PlaceInMenu";

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
  if (!course) return null;

  const draggable = !readOnly && !placement;

  async function place(term: number) {
    const result = await placeCourse(planId, code, term);
    if (isError(result)) onAnnounce(result.error);
    else onChanged(result);
  }

  return (
    <li
      class={`course-card ${placement ? "course-card-sidebar-placed" : "course-card-unplaced"}`}
      draggable={draggable}
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
          disabled={readOnly}
          open={openMenuCode === code}
          onOpenChange={(open) => onMenuOpenChange(code, open)}
        />
      )}
      <button type="button" onClick={() => setDetailsOpen(true)}>
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
