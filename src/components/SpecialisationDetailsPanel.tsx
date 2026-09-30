import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { SPEC_CHOICE_GROUP, specialisationByGroup, type SpecialisationInfo } from "../data/specialisations";
import type { PlanView } from "../lib/domain/view";
import DetailsFrame, { dateLabel, ExternalLink } from "./DetailsFrame";
import type { DetailsState } from "./details-state";
import type { PlanAction } from "./plan-actions";
import ProgressBar from "./ProgressBar";
import { placedStatus, unitsLabel } from "./planner-logic";
import { chosenSpecGroup, courseLineStatus, fitFigures, fitSummary, linkCodes, shortfallText } from "./spec-logic";
import { useWhatIf } from "./use-what-if";
import type { LayoutResult } from "./workspace-layout";

interface Props {
  view: PlanView;
  details: DetailsState; // subject.kind === "spec"
  spec: SpecialisationInfo;
  onOpenCourse: (code: string) => void;
  onBack: () => void;
  onForward: () => void;
  onClose: () => void;
  onShowInSidebar: (groupId: string) => void;
  onAction: (action: PlanAction) => Promise<void>;
  mode: LayoutResult["details"]["mode"];
  wide: boolean;
  onToggleWide: () => void;
}

// Choose or Switch, applied straight away through the plan's own choice
// action (so it gets the undo toast), whatever state the what-if is in.
function ChooseButton({ spec, switching, onAction }: { spec: SpecialisationInfo; switching: boolean; onAction: Props["onAction"] }) {
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      class={switching ? undefined : "details-choose"}
      disabled={pending}
      onClick={() => {
        setPending(true);
        void onAction({ kind: "choice", groupId: SPEC_CHOICE_GROUP, childId: spec.groupId }).finally(() => setPending(false));
      }}
    >
      {switching ? "Switch to this specialisation" : "Choose this specialisation"}
    </button>
  );
}

// A specialisation's P&C page in the details panel, verbatim, with the
// plan's own status on each course line. Everything comes from the static
// spec data and the plan's view, so nothing here loads.
export default function SpecialisationDetailsPanel({
  view,
  details,
  spec,
  onOpenCourse,
  onBack,
  onForward,
  onClose,
  onShowInSidebar,
  onAction,
  mode,
  wide,
  onToggleWide,
}: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const aboutRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  // Only an introduction the clamp actually cuts gets the toggle, and only
  // the browser can say whether it does.
  const [clamped, setClamped] = useState(false);
  const chosenGroup = chosenSpecGroup(view);
  const chosen = chosenGroup === spec.groupId;
  const current = chosenGroup && !chosen ? specialisationByGroup(chosenGroup) : null;
  const canOpen = (code: string) => code in view.courses;
  const whatIf = useWhatIf(view.plan.id, SPEC_CHOICE_GROUP, chosen ? null : spec.groupId, view);

  useEffect(() => {
    if (details.token === 0) return;
    headingRef.current?.focus();
  }, [details.token]);

  useEffect(() => setExpanded(false), [spec.code]);

  useEffect(() => {
    const el = aboutRef.current;
    if (el && !expanded) setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [spec.code, expanded]);

  const prose = (text: string) =>
    linkCodes(text, canOpen).map((segment, i) =>
      typeof segment === "string" ? (
        segment
      ) : (
        <button key={i} type="button" class="requisite-code" onClick={() => onOpenCourse(segment.code)}>
          {segment.code}
        </button>
      ),
    );

  // A course line, drawn like the requisite tree's: code, title and units,
  // then where it stands (and, for a move, where it would go).
  const courseLine = (code: string, where: string, extra?: ComponentChildren) => {
    const course = view.courses[code];
    return (
      <li key={code}>
        <span class="requisite-line">
          <span class="mark-dot" aria-hidden="true" />
          <span>
            <span class="spec-course-name">
              {canOpen(code) ? (
                <button type="button" class="requisite-code" onClick={() => onOpenCourse(code)}>
                  {code}
                </button>
              ) : (
                <strong>{code}</strong>
              )}
              {course && ` ${course.title}`}
            </span>
            {course && <span class="spec-units">{unitsLabel(course).full}</span>}
            <span class="requisite-where">{where}</span>
            {extra}
          </span>
        </span>
      </li>
    );
  };
  const placedWhere = (code: string) => {
    const placement = view.placements.find((p) => p.code === code);
    if (!placement) return "";
    const status = placedStatus(view, placement);
    return `${status.word} ${status.parts[0].termLabel}`;
  };
  const shortLabel = (groupId: string, label: string) => spec.lists.find((l) => l.groupId === groupId)?.shortLabel ?? label;

  // lists[k] is the k-th list block. Worked out up front rather than
  // counted while rendering: the body is a render prop the frame re-runs on
  // its own (a sheet height change), without re-running this.
  const listOf = spec.requirements.map((_, i) => spec.requirements.slice(0, i).filter((b) => b.type === "list").length);
  const updated = dateLabel(spec.scrapedAt);

  return (
    <DetailsFrame
      label="Specialisation details"
      details={details}
      mode={mode}
      wide={wide}
      onToggleWide={onToggleWide}
      onBack={onBack}
      onForward={onForward}
      onClose={onClose}
      headingRef={headingRef}
      heading={
        <>
          <span class="details-code">{spec.code}</span>{" "}
          <span class="details-meta">{spec.minUnits} units, Specialisation</span>{" "}
          <span class="details-title">{spec.title}</span>
        </>
      }
      pills={
        chosen ? (
          <li>
            <span class="family-dot" data-family="specialisation" aria-hidden="true" />
            Chosen
          </li>
        ) : (
          <li>Not chosen</li>
        )
      }
      footer={
        <>
          <ExternalLink href={spec.url}>Open {spec.code} on Programs &amp; Courses</ExternalLink>
          <p class="details-note">
            Details from Programs &amp; Courses {spec.year}
            {updated && `, updated ${updated}`}
          </p>
        </>
      }
    >
      {(sheet) => (
        <>
          {chosen && (
            <section class="details-section">
              <h3>In your plan</h3>
              <p>You chose this specialisation.</p>
              <button
                type="button"
                class="details-progress-jump"
                onClick={() => {
                  onShowInSidebar(spec.groupId);
                  // On a phone the sidebar is behind the sheet; drop it out of the way.
                  if (mode === "sheet") sheet.peek();
                }}
              >
                See your progress in Requirements
              </button>
            </section>
          )}

          {!chosen && (
            <section class="details-section spec-fit">
              <h3>Fit with your plan</h3>
              {whatIf.data ? (
                <>
                  <ProgressBar
                    label="If you chose this"
                    completed={whatIf.data.completed}
                    planned={whatIf.data.planned}
                    required={whatIf.data.required}
                    family="specialisation"
                  />
                  {whatIf.data.moves.length > 0 && <p>{fitFigures(whatIf.data)}</p>}
                  <p>{fitSummary(whatIf.data)}</p>
                  {whatIf.data.shortfalls.map((s) => (
                    <p key={s.groupId} class="details-warning">
                      {shortfallText(s)}.
                    </p>
                  ))}
                </>
              ) : (
                <div class="spec-fit-status">
                  {whatIf.status === "loading" && (
                    <p class="details-loading">Working out how this would fit your plan…</p>
                  )}
                  {whatIf.status === "error" && (
                    <>
                      <p>Couldn't work out how this fits your plan.</p>
                      <button type="button" onClick={whatIf.retry}>
                        Try again
                      </button>
                    </>
                  )}
                </div>
              )}
              {!view.plan.readOnly && <ChooseButton spec={spec} switching={chosenGroup !== null} onAction={onAction} />}
              {whatIf.data && whatIf.data.moves.length > 0 && (
                <>
                  <h4 class="spec-list-heading">Your courses that would count</h4>
                  <ul class="requisite-tree spec-courses">
                    {whatIf.data.moves.map((m) => {
                      const from = m.from ? m.from.label : "not counting toward anything now";
                      const to = shortLabel(m.to.id, m.to.label);
                      return courseLine(
                        m.code,
                        placedWhere(m.code),
                        <span class="spec-move">
                          <span aria-hidden="true" class="spec-move-parts">
                            {m.from && <span class="family-dot" data-family={m.from.family} />}
                            {from}
                            <svg class="details-icon" viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M9 5l7 7-7 7" />
                            </svg>
                            <span class="family-dot" data-family={m.to.family} />
                            {to}
                          </span>
                          <span class="visually-hidden">
                            moves from {from} to {to}
                          </span>
                        </span>,
                      );
                    })}
                  </ul>
                </>
              )}
              {whatIf.data && current && whatIf.data.leaving.length > 0 && (
                <>
                  <h4 class="spec-list-heading">Would stop counting toward {current.label}</h4>
                  <ul class="requisite-tree spec-courses">
                    {whatIf.data.leaving.map((l) =>
                      courseLine(l.code, l.to ? `now counts toward ${l.to.label}` : "wouldn't count toward anything"),
                    )}
                  </ul>
                </>
              )}
            </section>
          )}

          <section class="details-section">
            <h3>Requirements</h3>
            {spec.requirements.map((block, i) => {
              if (block.type === "text") return <p key={i}>{prose(block.content)}</p>;
              if (block.type === "heading")
                return (
                  <h4 key={i} class="spec-list-heading">
                    {block.content}
                  </h4>
                );
              if (block.type === "and")
                return (
                  <p key={i} class="spec-and">
                    AND
                  </p>
                );
              const list = spec.lists[listOf[i]];
              return (
                <div key={i}>
                  <h4 class="spec-list-heading">{block.heading}</h4>
                  <p class="spec-group-tag">
                    <span class="family-dot" data-family="specialisation" aria-hidden="true" />
                    {chosen ? (
                      <button type="button" class="requisite-code" onClick={() => onShowInSidebar(list.groupId)}>
                        {list.shortLabel}
                      </button>
                    ) : (
                      list.shortLabel
                    )}
                  </p>
                  <ul class="requisite-tree spec-courses">
                    {block.courses.map((code) =>
                      courseLine(code, courseLineStatus(view, code, spec, list.groupId, chosen ? null : whatIf.data)),
                    )}
                  </ul>
                </div>
              );
            })}
          </section>

          <section class="details-section">
            <h3>About the specialisation</h3>
            <div ref={aboutRef} class={expanded ? "spec-about" : "spec-about details-clamped"}>
              {spec.introduction.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
              {spec.topics.length > 0 && (
                <ul class="spec-topics">
                  {spec.topics.map((topic, i) => (
                    <li key={i}>{topic}</li>
                  ))}
                </ul>
              )}
            </div>
            {(clamped || expanded) && (
              <button type="button" class="details-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                {expanded ? "Show less" : "Read the full description"}
              </button>
            )}
            <h3>Learning outcomes</h3>
            <ol class="details-outcomes">
              {spec.learningOutcomes.map((outcome, i) => (
                <li key={i}>{outcome}</li>
              ))}
            </ol>
          </section>

          <section class="details-section">
            <h3>Other information</h3>
            {spec.otherInformation.map((paragraph, i) => (
              <p key={i}>{prose(paragraph)}</p>
            ))}
          </section>

          <section class="details-section">
            <h3>Relevant degrees</h3>
            <div class="details-related">
              <ul>
                {spec.relevantDegrees.map((degree) => (
                  <li key={degree}>
                    {degree}
                    {degree.includes("(AACOM)") && ", your degree"}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}
    </DetailsFrame>
  );
}
