import { useEffect, useRef } from "preact/hooks";
import type { CourseCard, PlanView } from "../lib/domain/view";
import { isError, setPin } from "./api";
import { groupLabel } from "./planner-logic";
import RequisiteTree from "./RequisiteTree";

interface Props {
  view: PlanView;
  code: string;
  // For a code that isn't (yet) in view.courses — a search result outside
  // the plan's tree — the card the search API already returned is passed
  // directly, rather than the (missing) view.courses[code] lookup.
  course?: CourseCard;
  planId: string;
  open: boolean;
  onChanged: (view: PlanView) => void;
  onAnnounce: (message: string) => void;
  onClose: () => void;
}

// Always rendered (so its content — the P&C link, the requisite tree — is
// present in the server-rendered HTML for spec/planner.test.ts to check),
// but with no `open` attribute by default, which the browser (and the
// invariants suite's jsdom, which never runs client JS) render as closed.
// Client-side, `open` toggles the imperative showModal()/close() calls that
// give it focus-trapping and Esc-to-close.
export default function CourseDetail({ view, code, course: courseOverride, planId, open, onChanged, onAnnounce, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const course = courseOverride ?? view.courses[code];
  const placement = view.placements.find((p) => p.code === code);
  const readOnly = view.plan.readOnly;

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [open]);

  if (!course) return null;

  async function pin(groupId: string) {
    const result = await setPin(planId, code, groupId || null);
    if (isError(result)) onAnnounce(result.error);
    else onChanged(result);
  }

  const pinnedValue = placement?.pinned ? (placement.countsToward ?? "") : "";

  return (
    <dialog ref={dialogRef} aria-label={`${code} details`} onClose={onClose}>
      <button type="button" onClick={() => dialogRef.current?.close()}>
        Close
      </button>
      <h2>
        {code} — {course.title}
      </h2>
      <p>{course.description}</p>
      <p>
        <a href={course.url} target="_blank" rel="noreferrer">
          View on Programs &amp; Courses
        </a>
      </p>
      <h3>Requisites</h3>
      {placement?.requisiteStatus ? (
        <ul>
          <RequisiteTree node={placement.requisiteStatus} />
        </ul>
      ) : (
        <p>No prerequisites, or not currently placed.</p>
      )}
      {course.incompatible.length > 0 && <p>Incompatible with: {course.incompatible.join(", ")}</p>}
      {course.otherPrograms.length > 0 && (
        <ul>
          {course.otherPrograms.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      )}
      {placement && (
        <p>
          <label>
            Pin to
            <select
              disabled={readOnly}
              value={pinnedValue}
              onChange={(event) => pin((event.target as HTMLSelectElement).value)}
            >
              <option value="">Automatic</option>
              {course.eligibleGroups.map((groupId) => (
                <option key={groupId} value={groupId}>
                  {groupLabel(view, groupId)}
                </option>
              ))}
            </select>
          </label>
        </p>
      )}
    </dialog>
  );
}
