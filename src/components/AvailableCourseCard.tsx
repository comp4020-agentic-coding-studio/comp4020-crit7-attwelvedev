import { useState } from "preact/hooks";
import type { PlanView } from "../lib/domain/view";
import { isError, placeCourse } from "./api";
import CourseDetail from "./CourseDetail";
import PlaceInMenu from "./PlaceInMenu";

interface Props {
  view: PlanView;
  code: string;
  planId: string;
  onChanged: (view: PlanView) => void;
  onAnnounce: (message: string) => void;
  onDragStart?: (code: string) => void;
  onDragEnd?: () => void;
}

export default function AvailableCourseCard({
  view,
  code,
  planId,
  onChanged,
  onAnnounce,
  onDragStart,
  onDragEnd,
}: Props) {
  const course = view.courses[code];
  const readOnly = view.plan.readOnly;
  const [detailsOpen, setDetailsOpen] = useState(false);
  if (!course) return null;

  async function place(term: number) {
    const result = await placeCourse(planId, code, term);
    if (isError(result)) onAnnounce(result.error);
    else onChanged(result);
  }

  return (
    <li
      class="course-card course-card-unplaced"
      draggable={!readOnly}
      onDragStart={(event) => {
        if (readOnly) {
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
      <PlaceInMenu view={view} code={code} onPlace={place} disabled={readOnly} />
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
