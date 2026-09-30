import { useEffect, useRef, useState } from "preact/hooks";
import type { SpecialisationInfo } from "../data/specialisations";
import type { PlanView } from "../lib/domain/view";
import DetailsFrame, { dateLabel, ExternalLink } from "./DetailsFrame";
import type { DetailsState } from "./details-state";
import type { PlanAction } from "./plan-actions";
import { unitsLabel } from "./planner-logic";
import { chosenSpecGroup, courseLineStatus, linkCodes } from "./spec-logic";
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
  onAction: (action: PlanAction) => Promise<void>; // unused until Phase 03
  mode: LayoutResult["details"]["mode"];
  wide: boolean;
  onToggleWide: () => void;
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
  const chosen = chosenSpecGroup(view) === spec.groupId;
  const canOpen = (code: string) => code in view.courses;

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
                    {block.courses.map((code) => {
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
                              <span class="requisite-where">{courseLineStatus(view, code, spec, list.groupId)}</span>
                            </span>
                          </span>
                        </li>
                      );
                    })}
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
