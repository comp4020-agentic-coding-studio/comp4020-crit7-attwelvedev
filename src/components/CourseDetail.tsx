import { useEffect, useId, useRef, useState } from "preact/hooks";
import type { CheckAnswer } from "../lib/domain/types";
import type { CourseCard, PlanView } from "../lib/domain/view";
import { isError, setCheck, setPin } from "./api";
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
  const [pinPending, setPinPending] = useState(false);
  // The answer being saved, shown checked until the new view arrives —
  // otherwise the re-render for `disabled` snaps the radio back first.
  const [pendingCheck, setPendingCheck] = useState<{ item: string; value: CheckAnswer | null } | null>(null);
  // A placed course's dialog renders twice (its timeline card and its
  // sidebar entry): radios sharing a name across both would be one group.
  const radioPrefix = useId();

  useEffect(() => {
    if (open) dialogRef.current?.showModal();
    else dialogRef.current?.close();
  }, [open]);

  if (!course) return null;

  async function pin(groupId: string) {
    setPinPending(true);
    try {
      const result = await setPin(planId, code, groupId || null);
      if (isError(result)) onAnnounce(result.error);
      else onChanged(result);
    } finally {
      setPinPending(false);
    }
  }

  async function answer(item: string, value: CheckAnswer | null) {
    setPendingCheck({ item, value });
    try {
      const result = await setCheck(planId, code, item, value);
      if (isError(result)) onAnnounce(result.error);
      else onChanged(result);
    } finally {
      setPendingCheck(null);
    }
  }

  const answerOptions: [CheckAnswer | null, string][] = [
    ["met", "Met"],
    ["not-met", "Not met"],
    [null, "Not sure"],
  ];

  const pinnedValue = placement?.pinned ? (placement.countsToward ?? "") : "";

  return (
    <dialog ref={dialogRef} aria-label={`${code} details`} onClose={onClose}>
      <button type="button" onClick={() => dialogRef.current?.close()}>
        Close
      </button>
      <h2>
        {code} <span class="course-detail-title">{course.title}</span>
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
      {placement && placement.checks.length > 0 && (
        <>
          <h3>Your checks</h3>
          <small>
            The planner can't check these itself. Mark each one for yourself: your answers decide whether this course
            shows as Available. Or leave it on Not sure to confirm with P&amp;C later.
          </small>
          {placement.checks.map((check, i) => (
            <fieldset key={check.item} class="verify-check" disabled={readOnly || pendingCheck !== null}>
              <legend>{check.label}</legend>
              {answerOptions.map(([value, text]) => (
                <label key={text}>
                  <input
                    type="radio"
                    name={`${radioPrefix}-check-${code}-${i}`}
                    checked={(pendingCheck?.item === check.item ? pendingCheck.value : check.answer) === value}
                    onChange={() => answer(check.item, value)}
                  />{" "}
                  {text}
                </label>
              ))}
            </fieldset>
          ))}
        </>
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
              disabled={readOnly || pinPending}
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
          <br />
          <small>
            This course can count toward more than one requirement. "Automatic" lets the plan choose whichever fits
            best overall; pin it here only if you want it to count toward a specific one instead.
          </small>
        </p>
      )}
    </dialog>
  );
}
