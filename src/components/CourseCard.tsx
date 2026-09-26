import type { PlacementView, PlanView } from "../lib/domain/view";
import { isError, placeCourse, removeCourse } from "./api";
import PlaceInMenu from "./PlaceInMenu";

interface Props {
  view: PlanView;
  placement: PlacementView;
  planId: string;
  onChanged: (view: PlanView) => void;
  onAnnounce: (message: string) => void;
  onDragStart?: (code: string) => void;
  onDragEnd?: () => void;
}

export default function CourseCard({
  view,
  placement,
  planId,
  onChanged,
  onAnnounce,
  onDragStart,
  onDragEnd,
}: Props) {
  const course = view.courses[placement.code];
  const readOnly = view.plan.readOnly;

  async function move(term: number) {
    const result = await placeCourse(planId, placement.code, term);
    if (isError(result)) onAnnounce(result.error);
    else onChanged(result);
  }

  async function applySuggestion(code: string, term: number) {
    const result = await placeCourse(planId, code, term);
    if (isError(result)) onAnnounce(result.error);
    else onChanged(result);
  }

  async function remove() {
    const result = await removeCourse(planId, placement.code);
    if (isError(result)) onAnnounce(result.error);
    else onChanged(result);
  }

  const stateText =
    placement.state === "hard" ? "Blocked" : placement.state === "soft" ? "Needs prerequisites" : "Available";

  return (
    <li
      class={`course-card course-card-${placement.state}`}
      data-placed={placement.code}
      draggable={!readOnly}
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
      <strong>{placement.code}</strong>
      {course && <span> — {course.title}</span>}
      <p class="course-card-state">{stateText}</p>
      {placement.reasons.length > 0 && <p class="course-card-reason">{placement.reasons.join("; ")}</p>}
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
        {placement.countsToward ? `Counts toward ${placement.countsToward}` : "Not counting toward any requirement"}
      </p>
      {placement.state === "soft" && placement.suggestions.length > 0 && (
        <ul class="course-card-suggestions">
          {placement.suggestions.map((suggestion) => (
            <li key={`${suggestion.action}-${suggestion.code}-${suggestion.term}`}>
              <button
                type="button"
                disabled={readOnly}
                onClick={() => applySuggestion(suggestion.code, suggestion.term)}
              >
                {suggestion.text}
              </button>
            </li>
          ))}
        </ul>
      )}
      <PlaceInMenu view={view} code={placement.code} onPlace={move} disabled={readOnly} />
      <button type="button" disabled={readOnly} onClick={remove}>
        Remove
      </button>
    </li>
  );
}
