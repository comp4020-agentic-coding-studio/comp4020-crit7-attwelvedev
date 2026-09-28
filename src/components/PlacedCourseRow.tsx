import { useState } from "preact/hooks";
import type { CourseCard, PlacementView, PlanView } from "../lib/domain/view";
import CourseDetail from "./CourseDetail";
import { placedStatus, type PlacedPart } from "./planner-logic";

interface Props {
  view: PlanView;
  code: string;
  // Given for a search result, which may have no view.courses entry.
  course?: CourseCard;
  placement: PlacementView;
  planId: string;
  onChanged: (view: PlanView) => void;
  onAnnounce: (message: string) => void;
  onLocateCourse: (code: string, part?: 2) => void;
}

// A course already on the timeline, in one or two lines instead of a full
// card: its card on the timeline carries its real state, so the sidebar only
// needs to say which course it is and where to find it. Not draggable — the
// timeline card is the one to move.
export default function PlacedCourseRow({
  view,
  code,
  course: courseOverride,
  placement,
  planId,
  onChanged,
  onAnnounce,
  onLocateCourse,
}: Props) {
  const course = courseOverride ?? view.courses[code];
  const [detailsOpen, setDetailsOpen] = useState(false);
  if (!course) return null;

  const { word, parts, joiner } = placedStatus(view, placement);
  const locate = (part: PlacedPart, which?: 2) => (
    <button
      type="button"
      class="course-card-term-link"
      onClick={() => onLocateCourse(code, which)}
      aria-label={`${code} ${part.spoken} — locate it on the timeline`}
    >
      {part.termLabel}
    </button>
  );

  return (
    <li class="placed-row">
      <strong class="placed-row-code">{code}</strong>
      {/* Named with aria-label, not a visually-hidden span, for the same
          reason as CourseCardHeader's title. `title` shows the full name
          when the ellipsis cuts it off. */}
      <button
        type="button"
        class="placed-row-title"
        title={course.title}
        aria-label={`${course.title}, details`}
        onClick={() => setDetailsOpen(true)}
      >
        {course.title}
      </button>
      <p class="placed-row-status">
        {word}{" "}
        {locate(parts[0])}
        {parts[1] && (
          <>
            {" "}
            {joiner}{" "}
            {locate(parts[1], 2)}
          </>
        )}
      </p>
      <CourseDetail
        view={view}
        code={code}
        course={courseOverride}
        planId={planId}
        open={detailsOpen}
        onChanged={onChanged}
        onAnnounce={onAnnounce}
        onClose={() => setDetailsOpen(false)}
      />
    </li>
  );
}
