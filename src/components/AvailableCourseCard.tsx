import { useState } from "preact/hooks";
import type { CourseCard, PlanView } from "../lib/domain/view";
import CourseCardHeader from "./CourseCardHeader";
import type { DetailsFocus } from "./details-state";
import { actionFor, type PlanAction } from "./plan-actions";
import PlaceInMenu from "./PlaceInMenu";
import { dropTargets } from "./planner-logic";

interface Props {
  view: PlanView;
  code: string;
  // Given for a search result, which usually isn't (yet) part of the plan's
  // tree and so has no view.courses entry of its own.
  course?: CourseCard;
  // Place in… goes through Planner's runAction.
  onAction: (action: PlanAction) => Promise<void>;
  onDragStart?: (code: string) => void;
  onDragEnd?: () => void;
  openMenuCode: string | null;
  onMenuOpenChange: (code: string, open: boolean) => void;
  // Opens this course in the details sidebar.
  onOpenDetails: (code: string, focus?: DetailsFocus) => void;
  // This course is the one open in the details sidebar.
  current: boolean;
}

export default function AvailableCourseCard({
  view,
  code,
  course: courseOverride,
  onAction,
  onDragStart,
  onDragEnd,
  openMenuCode,
  onMenuOpenChange,
  onOpenDetails,
  current,
}: Props) {
  const course = courseOverride ?? view.courses[code];
  const readOnly = view.plan.readOnly;
  const [pending, setPending] = useState(false);
  if (!course) return null;

  const draggable = !readOnly;

  // A course still has to be actively discovered as a dead end today (open
  // its Place in… menu, read "No available terms"), rather than the sidebar
  // just telling you up front — checked here the same way that menu already
  // does, so the two never disagree. Doesn't apply on a read-only plan —
  // there, dropTargets reports every term as disallowed for every course
  // (the plan itself, not this course, is why), which would flag the entire
  // sidebar as "Blocked" and say nothing useful.
  const targets = readOnly ? [] : dropTargets(view, code, courseOverride?.hardBlocked);
  const allBlocked = !readOnly && targets.length > 0 && targets.every((t) => !t.allowed);
  const blockedReason = allBlocked
    ? Array.from(new Set(targets.map((t) => t.reason).filter((r): r is string => !!r))).join("; ")
    : null;

  async function place(term: number) {
    setPending(true);
    try {
      await onAction(actionFor(view, code, term));
    } finally {
      setPending(false);
    }
  }

  return (
    <li
      class={`course-card ${allBlocked ? "course-card-hard" : "course-card-unplaced"}`}
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
      <CourseCardHeader
        code={code}
        title={course.title}
        units={course}
        grip={draggable}
        onOpenDetails={() => onOpenDetails(code)}
        current={current}
      />
      <p class="course-card-offered">{course.offeredLabel}</p>
      {allBlocked && <p class="badge badge-state-hard">Blocked</p>}
      {allBlocked && blockedReason && <p class="badge badge-reason">{blockedReason}</p>}
      {!readOnly && (
        <div class="course-card-actions">
          <PlaceInMenu
            view={view}
            code={code}
            onPlace={place}
            disabled={pending}
            hardBlockedOverride={courseOverride?.hardBlocked}
            twoSemester={course.twoSemester}
            open={openMenuCode === code}
            onOpenChange={(open) => onMenuOpenChange(code, open)}
          />
        </div>
      )}
    </li>
  );
}
