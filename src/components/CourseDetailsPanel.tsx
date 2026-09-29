import { useEffect, useId, useRef, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { CheckAnswer } from "../lib/domain/types";
import { type CourseCard, type CourseDetailsView, NORMAL_TERM_UNITS, type PlanView } from "../lib/domain/view";
import ChoiceMenu from "./ChoiceMenu";
import type { DetailsState } from "./details-state";
import type { PlanAction } from "./plan-actions";
import {
  dependentsOf,
  familyOf,
  groupLabel,
  placedStatus,
  postgradLabel,
  type StripCell,
  stripCells,
  unitsLabel,
  unmarkedStatus,
  weightLabel,
} from "./planner-logic";
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
  onAction: (action: PlanAction) => Promise<void>;
}

const STATE_WORD: Record<StripCell["state"], string> = {
  here: "In your plan",
  part2: "Part 2",
  offered: "Offered",
  projected: "Projected",
  "not-offered": "Not offered",
  // Short enough to stay on one line in a cell; the legend spells it out.
  "needs-prereqs": "Needs prereqs",
  "cant-start": "Can't start",
  unknown: "Unknown",
};

// The legend's order, and its longer wording where a cell's word is terse.
// Part 2 has no entry: it looks like "In your plan" and says "Part 2" itself.
const LEGEND: [StripCell["state"], string][] = [
  ["here", "In your plan"],
  ["offered", "Offered"],
  ["projected", "Projected from past years"],
  ["needs-prereqs", "Offered, but its prerequisites can't be met by then"],
  ["cant-start", "Can't start here (runs over two semesters)"],
  ["not-offered", "Not offered"],
  ["unknown", "No published offering"],
];

// P&C names semesters in full; everywhere else in the planner they're "S1".
const SESSION_SHORT: Record<string, string> = { "First Semester": "S1", "Second Semester": "S2" };

// Every P&C link opens a new tab, and says so.
function ExternalLink({ href, children }: { href: string; children: ComponentChildren }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
      <svg class="external-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 17 17 7M9 7h8v8" />
      </svg>
      <span class="visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "28 Sep 2026", in UTC so the server render and the browser agree.
function dateLabel(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

const REQUISITE_STATE = {
  available: "Requisites met",
  check: "Requisites need your check",
  soft: "Needs prerequisites",
  hard: "Blocked",
} as const;

// Which bar segment (and so which colour) an assessment item gets: only
// items with a positive numeric weight have one, numbered in order.
function segmentIndex(items: { weight: string }[], i: number): number | null {
  const hasSegment = (w: string) => Number(w) > 0;
  if (!hasSegment(items[i].weight)) return null;
  return items.slice(0, i).filter((item) => hasSegment(item.weight)).length % 5;
}

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
  onOpen,
  onBack,
  onForward,
  onClose,
  onPlace,
  onRemove,
  onAction,
}: Props) {
  const code = details.code!;
  const placement = view.placements.find((p) => p.code === code) ?? null;
  const readOnly = view.plan.readOnly;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const requisitesRef = useRef<HTMLHeadingElement>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const [pinPending, setPinPending] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  // The answer being saved, shown checked until the new view arrives —
  // otherwise the re-render for `disabled` snaps the pressed button back first.
  const [pendingCheck, setPendingCheck] = useState<{ item: string; value: CheckAnswer | null } | null>(null);
  const [expanded, setExpanded] = useState(false);
  // Only a description the clamp actually cuts gets the toggle, and only
  // the browser can say whether it does.
  const [clamped, setClamped] = useState(false);
  const idPrefix = useId();

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
      await onAction({ kind: "pin", code, groupId: groupId || null });
    } finally {
      setPinPending(false);
    }
  }

  async function answer(item: string, value: CheckAnswer | null) {
    setPendingCheck({ item, value });
    try {
      await onAction({ kind: "check", code, item, answer: value });
    } finally {
      setPendingCheck(null);
    }
  }

  const status = placement ? placedStatus(view, placement) : null;
  const family = placement?.countsToward ? familyOf(view, placement.countsToward) : null;
  const pinnedValue = placement?.pinned ? (placement.countsToward ?? "") : "";
  const pinOptions = [
    { value: "", label: "Automatic" },
    ...(card?.eligibleGroups ?? []).map((groupId) => ({ value: groupId, label: groupLabel(view, groupId) })),
  ];
  const extras = fetched.data?.extras ?? null;
  const url = card?.url ?? null;
  const pandc = url ? (
    <ExternalLink href={url}>Programs &amp; Courses</ExternalLink>
  ) : (
    "Programs & Courses"
  );
  // A placed course's tree is evaluated against the plan; any other course
  // only has its rule to show.
  const tree = placement ? placement.requisiteStatus : card?.prereq ? unmarkedStatus(card.prereq) : null;
  const placedCodes = new Set(view.placements.map((p) => p.code));
  const clashes = card?.incompatible.filter((c) => placedCodes.has(c)) ?? [];
  const cotaught = extras?.cotaught ?? [];
  const dependents = dependentsOf(view, code);
  const cells = card ? stripCells(view, code, card) : [];
  const years = [...new Set(cells.map((c) => c.year))];
  const shownStates = new Set(cells.map((c) => c.state));
  const classes = extras?.classes ?? [];
  const edition = url?.match(/\/(\d{4})\/course\//)?.[1] ?? null;
  const updated = fetched.data ? dateLabel(fetched.data.scrapedAt) : null;

  return (
    <aside
      class="details-panel region"
      aria-label="Course details"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div class="details-head glass">
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

      {/* Only a placed course has anything to pin or remove; the pills
          above already say when it's planned. */}
      {placement && (
        <section class="details-section">
          <h3>In your plan</h3>
          {card && (
            <div class="details-pin">
              <ChoiceMenu
                name="pin"
                options={pinOptions}
                value={pinnedValue}
                open={pinOpen}
                onOpenChange={setPinOpen}
                onChoose={(groupId) => void pin(groupId)}
                disabled={readOnly || pinPending}
                pending={pinPending}
                toggle={
                  <span>
                    Counts toward: {pinOptions.find((o) => o.value === pinnedValue)?.label ?? "Automatic"}
                  </span>
                }
              />
              <small>
                This course can count toward more than one requirement. "Automatic" lets the plan choose whichever
                fits best overall; pin it here only if you want it to count toward a specific one instead.
              </small>
            </div>
          )}
          {/* Completed courses too, as the card menu and dragging allow. */}
          {!readOnly && (
            <button type="button" class="details-remove" onClick={onRemove}>
              Remove from plan
            </button>
          )}
        </section>
      )}

      {card && (
        <section class="details-section">
          <h3>When it runs</h3>
          {/* One column per year, so a year's two semesters sit together. */}
          <div class="details-strip">
            {years.map((year) => (
              <div key={year} class="strip-year">
                <p class="strip-year-label">{year}</p>
                {cells
                  .filter((cell) => cell.year === year)
                  .map((cell) => {
                    const noteId = `${idPrefix}-strip-${cell.term}`;
                    return (
                      <button
                        key={cell.term}
                        type="button"
                        class="strip-cell"
                        data-state={cell.state}
                        disabled={readOnly || !cell.allowed}
                        aria-label={cell.actionLabel}
                        aria-describedby={noteId}
                        onClick={() => onPlace(cell.term)}
                      >
                        <span class="strip-session">{cell.session}</span>
                        <span class="strip-state">{STATE_WORD[cell.state]}</span>
                        <span class="strip-units">
                          {cell.units} of {NORMAL_TERM_UNITS}u
                        </span>
                        {/* The refusal's reason when there is one, else what the cell shows. */}
                        <span id={noteId} class="visually-hidden">
                          {cell.reason ?? `${STATE_WORD[cell.state]}, ${cell.units} of ${NORMAL_TERM_UNITS} units`}
                        </span>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
          <ul class="strip-legend">
            {LEGEND.filter(([state]) => shownStates.has(state)).map(([state, text]) => (
              <li key={state}>
                <span class="strip-swatch" data-state={state} aria-hidden="true" />
                {text}
              </li>
            ))}
          </ul>
          {card.twoSemester && (
            <p class="details-note">
              Runs over two semesters in a row: {card.units} units in each, {card.units * 2} in total.
            </p>
          )}
          {classes.length > 0 && (
            <table class="details-offerings">
              <thead>
                <tr>
                  <th scope="col">Semester</th>
                  <th scope="col">Delivery</th>
                  <th scope="col">Class number</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c, i) => (
                  <tr key={i}>
                    <td>
                      {SESSION_SHORT[c.session] ?? c.session} {c.year}
                    </td>
                    <td>{c.mode}</td>
                    <td>{c.classNumber ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      <section class="details-section">
        <h3 ref={requisitesRef} tabIndex={-1}>
          Requisites
        </h3>
        {tree ? (
          <RequisiteTree
            node={tree}
            marks={placement !== null}
            checks={placement?.checks ?? []}
            disabled={readOnly || pendingCheck !== null}
            pending={pendingCheck}
            onAnswer={answer}
            onOpen={onOpen}
            canOpen={(c) => c in view.courses}
            courseInfo={(c) => {
              const at = view.placements.find((p) => p.code === c);
              const where = at ? placedStatus(view, at) : null;
              return {
                title: view.courses[c]?.title ?? null,
                where: where ? `${where.word} ${where.parts[0].termLabel}` : "Not in your plan",
              };
            }}
          />
        ) : (
          <p>No prerequisites.</p>
        )}
        {card && card.otherPrograms.length > 0 && (
          <ul class="details-other-programs">
            {card.otherPrograms.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        )}
        {card?.requisiteRaw && (
          <div class="details-raw">
            <h4>As written on Programs &amp; Courses</h4>
            <p>{card.requisiteRaw}</p>
          </div>
        )}
        {card && card.incompatible.length > 0 && (
          <div class="details-related">
            <h4>Can't take with</h4>
            <ul>
              {card.incompatible.map((c) => (
                <li key={c}>{postgradLabel(c)}</li>
              ))}
            </ul>
            {clashes.map((c) => (
              <p key={c} class="details-warning">
                {c} is also in your plan
              </p>
            ))}
          </div>
        )}
        {cotaught.length > 0 && (
          <div class="details-related">
            <h4>Taught with</h4>
            <ul>
              {cotaught.map((c) => (
                <li key={c}>{postgradLabel(c)}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section class="details-section">
        <h3>Courses in your plan that need it</h3>
        {dependents.length > 0 ? (
          <ul class="details-dependents">
            {dependents.map((c) => (
              <li key={c}>
                <button type="button" onClick={() => onOpen(c)}>
                  <strong>{c}</strong> {view.courses[c]?.title}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No course in your plan lists it as a prerequisite.</p>
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
                const segment = segmentIndex(extras.assessment, i);
                return segment === null ? null : (
                  <span key={i} data-segment={segment} style={{ flexGrow: Number(item.weight) }} />
                );
              })}
            </div>
            <ul class="details-assessment-list">
              {extras.assessment.map((item, i) => (
                <li key={i}>
                  {/* Keyed to its bar segment by colour; an item with no
                      numeric weight has no segment, so no dot. */}
                  <span class="assess-task">
                    {segmentIndex(extras.assessment, i) !== null && (
                      <span class="assess-dot" data-segment={segmentIndex(extras.assessment, i)} aria-hidden="true" />
                    )}
                    {item.task}
                  </span>{" "}
                  <span>{weightLabel(item.weight)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {url && (
        <footer class="details-footer">
          <ExternalLink href={url}>Open {code} on Programs &amp; Courses</ExternalLink>
          {edition && (
            <p class="details-note">
              Details from Programs &amp; Courses {edition}
              {updated && `, updated ${updated}`}
            </p>
          )}
        </footer>
      )}
    </aside>
  );
}
