import { useEffect, useId, useRef, useState } from "preact/hooks";
import type { CheckAnswer } from "../lib/domain/types";
import type { CourseCard, CourseDetailsView, PlanView } from "../lib/domain/view";
import { isError, setCheck, setPin } from "./api";
import { CardGrip } from "./CourseCardHeader";
import type { DetailsState } from "./details-state";
import { familyOf, groupLabel, placedStatus, unitsLabel } from "./planner-logic";
import RequisiteTree from "./RequisiteTree";

interface Props {
  view: PlanView;
  details: DetailsState;
  card: CourseCard | null;
  fetched: { status: "idle" | "loading" | "ready" | "error"; data: CourseDetailsView | null };
  onOpen: (code: string) => void;
  onBack: () => void;
  onForward: () => void;
  onClose: () => void;
  onPlace: (term: number) => void;
  onRemove: () => void;
  onChanged: (view: PlanView) => void;
  onAnnounce: (message: string) => void;
}

const REQUISITE_STATE = {
  available: "Requisites met",
  check: "Requisites need your check",
  soft: "Needs prerequisites",
  hard: "Blocked",
} as const;

// P&C gives weights as bare numbers ("30"); anything else ("Hurdle") is
// shown as written.
const weightLabel = (weight: string) => (/^\d+(\.\d+)?$/.test(weight) ? `${weight}%` : weight);

function Icon({ path }: { path: string }) {
  return (
    <svg class="details-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={path} />
    </svg>
  );
}

// The one place a course's details show: every Details entry point opens
// it. Everything above About reads from the plan's own view, so it follows
// every plan change and still works when the extras fail to load.
export default function CourseDetailsPanel({
  view,
  details,
  card,
  fetched,
  onBack,
  onForward,
  onClose,
  onRemove,
  onChanged,
  onAnnounce,
}: Props) {
  const code = details.code!;
  const placement = view.placements.find((p) => p.code === code) ?? null;
  const readOnly = view.plan.readOnly;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const requisitesRef = useRef<HTMLHeadingElement>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const [pinPending, setPinPending] = useState(false);
  // The answer being saved, shown checked until the new view arrives —
  // otherwise the re-render for `disabled` snaps the radio back first.
  const [pendingCheck, setPendingCheck] = useState<{ item: string; value: CheckAnswer | null } | null>(null);
  const [expanded, setExpanded] = useState(false);
  // Only a description the clamp actually cuts gets the toggle, and only
  // the browser can say whether it does.
  const [clamped, setClamped] = useState(false);
  const radioPrefix = useId();

  useEffect(() => {
    if (details.token === 0) return;
    (details.focus === "requisites" ? requisitesRef : headingRef).current?.focus();
  }, [details.token]);

  useEffect(() => setExpanded(false), [code]);

  useEffect(() => {
    const el = descriptionRef.current;
    if (el && !expanded) setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [code, card?.description, expanded]);

  async function pin(groupId: string) {
    setPinPending(true);
    try {
      const result = await setPin(view.plan.id, code, groupId || null);
      if (isError(result)) onAnnounce(result.error);
      else onChanged(result);
    } finally {
      setPinPending(false);
    }
  }

  async function answer(item: string, value: CheckAnswer | null) {
    setPendingCheck({ item, value });
    try {
      const result = await setCheck(view.plan.id, code, item, value);
      if (isError(result)) onAnnounce(result.error);
      else onChanged(result);
    } finally {
      setPendingCheck(null);
    }
  }

  const status = placement ? placedStatus(view, placement) : null;
  const semester = status
    ? [status.parts[0].termLabel, status.parts[1] && `${status.joiner} ${status.parts[1].termLabel}`]
        .filter(Boolean)
        .join(" ")
    : null;
  const family = placement?.countsToward ? familyOf(view, placement.countsToward) : null;
  const pinnedValue = placement?.pinned ? (placement.countsToward ?? "") : "";
  const extras = fetched.data?.extras ?? null;
  const url = card?.url ?? null;
  const pandc = url ? (
    <a href={url} target="_blank" rel="noreferrer">
      Programs &amp; Courses
    </a>
  ) : (
    "Programs & Courses"
  );
  const answerOptions: [CheckAnswer | null, string][] = [
    ["met", "Met"],
    ["not-met", "Not met"],
    [null, "Not sure"],
  ];

  return (
    <aside class="details-panel" aria-label="Course details">
      <div class="details-head">
        <div class="details-nav">
          <button
            type="button"
            class="details-icon-button"
            aria-label="Previous course"
            disabled={details.index <= 0}
            onClick={onBack}
          >
            <Icon path="M15 5l-7 7 7 7" />
          </button>
          <button
            type="button"
            class="details-icon-button"
            aria-label="Next course"
            disabled={details.index >= details.history.length - 1}
            onClick={onForward}
          >
            <Icon path="M9 5l7 7-7 7" />
          </button>
          {/* Shows where the course can be dragged from; like a card's, it's
              decorative. */}
          {!readOnly && !placement?.completed && <CardGrip />}
          <button type="button" class="details-icon-button details-close" aria-label="Close details" onClick={onClose}>
            <Icon path="M6 6l12 12M18 6L6 18" />
          </button>
        </div>
        <h2 ref={headingRef} tabIndex={-1}>
          <span class="details-code">{code}</span>
          {card && (
            <>
              {" "}
              <span class="details-meta">
                {unitsLabel(card).full}, Level {card.level}
              </span>{" "}
              <span class="details-title">{card.title}</span>
            </>
          )}
        </h2>
        <ul class="details-pills">
          <li>{status ? `${status.word} ${status.parts[0].termLabel}` : "Not in your plan"}</li>
          {placement?.countsToward && (
            <li>
              {family && family !== "neutral" && <span class="family-dot" data-family={family} aria-hidden="true" />}
              Counts toward {groupLabel(view, placement.countsToward)}
            </li>
          )}
          {placement && <li>{REQUISITE_STATE[placement.state]}</li>}
        </ul>
      </div>

      <section class="details-section">
        <h3>In your plan</h3>
        <p class="details-semester">{status ? `${status.word} ${semester}` : "Not planned"}</p>
        {placement && card && (
          <div class="details-pin">
            <label>
              Counts toward
              <select
                disabled={readOnly || pinPending}
                value={pinnedValue}
                onChange={(event) => pin((event.target as HTMLSelectElement).value)}
              >
                <option value="">Automatic</option>
                {card.eligibleGroups.map((groupId) => (
                  <option key={groupId} value={groupId}>
                    {groupLabel(view, groupId)}
                  </option>
                ))}
              </select>
            </label>
            <small>
              This course can count toward more than one requirement. "Automatic" lets the plan choose whichever fits
              best overall; pin it here only if you want it to count toward a specific one instead.
            </small>
          </div>
        )}
        {placement && !readOnly && !placement.completed && (
          <button type="button" class="details-remove" onClick={onRemove}>
            Remove from plan
          </button>
        )}
      </section>

      <section class="details-section">
        <h3 ref={requisitesRef} tabIndex={-1}>
          Requisites
        </h3>
        {placement?.requisiteStatus ? (
          <ul>
            <RequisiteTree node={placement.requisiteStatus} />
          </ul>
        ) : (
          <p>No prerequisites, or not currently placed.</p>
        )}
        {placement && placement.checks.length > 0 && (
          <>
            <h4>Your checks</h4>
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
        {card && card.incompatible.length > 0 && <p>Incompatible with: {card.incompatible.join(", ")}</p>}
        {card && card.otherPrograms.length > 0 && (
          <ul>
            {card.otherPrograms.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        )}
      </section>

      <section class="details-section">
        <h3>About the course</h3>
        {card?.description && (
          <>
            <p ref={descriptionRef} class={expanded ? "details-description" : "details-description details-clamped"}>
              {card.description}
            </p>
            {(clamped || expanded) && (
              <button type="button" class="details-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                {expanded ? "Show less" : "Read the full description"}
              </button>
            )}
          </>
        )}
        {fetched.status === "loading" && <p class="details-loading">Loading course details…</p>}
        {fetched.status === "error" && (
          <p>Couldn't load the full details. See this course on {pandc}.</p>
        )}
        {fetched.status === "ready" && !extras && (
          <p>Only basic details are available for this course. See {pandc} for outcomes and assessment.</p>
        )}
        {extras && extras.learningOutcomes.length > 0 && (
          <>
            <h3>Learning outcomes</h3>
            <ol class="details-outcomes">
              {extras.learningOutcomes.map((outcome, i) => (
                <li key={i}>{outcome}</li>
              ))}
            </ol>
          </>
        )}
        {extras && extras.assessment.length > 0 && (
          <div class="details-assessment">
            <h3>Assessment</h3>
            <p class="details-note">Indicative, may change</p>
            <div class="assess-bar" aria-hidden="true">
              {extras.assessment.map((item, i) => {
                const weight = Number(item.weight);
                return Number.isFinite(weight) && weight > 0 ? <span key={i} style={{ flexGrow: weight }} /> : null;
              })}
            </div>
            <ul class="details-assessment-list">
              {extras.assessment.map((item, i) => (
                <li key={i}>
                  <span>{item.task}</span> <span>{weightLabel(item.weight)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {url && (
        <footer class="details-footer">
          <a href={url} target="_blank" rel="noreferrer">
            Open {code} on Programs &amp; Courses
          </a>
        </footer>
      )}
    </aside>
  );
}
