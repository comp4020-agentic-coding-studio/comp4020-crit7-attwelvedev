import { useEffect, useRef, useState } from "preact/hooks";
import { TERMS } from "../lib/domain/terms";
import { NORMAL_TERM_UNITS, type PlacementView, type PlanView, type TermView } from "../lib/domain/view";
import CourseCard from "./CourseCard";
import type { DetailsFocus } from "./details-state";
import PartTwoStub from "./PartTwoStub";
import { actionFor, type PlanAction } from "./plan-actions";
import {
  dropTargets,
  familyOf,
  groupLeafIds,
  type LinkedHighlights,
  partTwoPlacements,
  placedStatus,
  termBarLabel,
  termBarWidths,
  termFamilyUnits,
} from "./planner-logic";
import PrereqLegend from "./PrereqLegend";
import PrereqOverlay from "./PrereqOverlay";

// Set from the sidebar's "Placed in <term>" badge, to scroll to and flash
// the matching card; a token so clicking the same badge twice in a row
// re-triggers the effect even though the code didn't change. A row's part 2
// button asks for the stub with `part: 2`. Opening a course's details asks
// with `focus: false`: it shows where the card is while focus stays in the
// details sidebar.
export interface LocateRequest {
  code: string;
  token: number;
  part?: 2;
  focus?: boolean;
}

interface Props {
  view: PlanView;
  draggingCode: string | null;
  // The dragged course's hardBlocked map when view.courses may lack it (a
  // search result) — see dropTargets.
  draggingBlocked?: Record<number, string>;
  // Whether the dragged course is two-semester: it takes the hovered term
  // and the next, so the drop outline covers both.
  draggingTwoSemester: boolean;
  // A drop, and every card's own changes, go through Planner's runAction.
  onAction: (action: PlanAction) => Promise<void>;
  onDragStart: (code: string) => void;
  onDragEnd: () => void;
  showPrereqLinks: boolean;
  openMenuCode: string | null;
  onMenuOpenChange: (code: string, open: boolean) => void;
  locateRequest: LocateRequest | null;
  // A part 2 stub's button asks for its part 1 through this, the same way
  // the sidebar's badge does; part 1's marker asks for the stub with
  // `part` 2.
  onLocateCourse: (code: string, part?: 2) => void;
  // Opens a card's "Counts toward" group in the requirements sidebar.
  onShowGroup: (groupId: string) => void;
  // A sidebar group under hover or focus: cards outside it recede.
  focusGroupId: string | null;
  // Opens this course in the details sidebar.
  onOpenDetails: (code: string, focus?: DetailsFocus) => void;
  // The course open in the details sidebar, whose titles say so.
  openCode: string | null;
  // What the open course links to, for the cards' chips and ring.
  linked: LinkedHighlights | null;
}

export default function Timeline({
  view,
  draggingCode,
  draggingBlocked,
  draggingTwoSemester,
  onAction,
  onDragStart,
  onDragEnd,
  showPrereqLinks,
  openMenuCode,
  onMenuOpenChange,
  locateRequest,
  onLocateCourse,
  onShowGroup,
  focusGroupId,
  onOpenDetails,
  openCode,
  linked,
}: Props) {
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
  // Whether there are semesters off either end of the scroller: drives the
  // edge fades and disables the ‹ › buttons at the ends.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    function update() {
      const el = scrollRef.current!;
      const left = el.scrollLeft > 1;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
    }
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  function scrollByPage(dir: -1 | 1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({
      left: dir * el.clientWidth * 0.8,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }
  // The term a mouse drag is currently over — the same gold outline
  // touch-drag.ts paints for a finger, since the browser's native drag
  // shows no drop-target feedback of its own. Read off document-level
  // dragover rather than per-term dragenter/dragleave: dragleave fires on
  // every move between a term's own children, and Chromium leaves its
  // relatedTarget null, so there's no telling "left the column" from
  // "moved onto a card inside it".
  const [dragOverTerm, setDragOverTerm] = useState<number | null>(null);
  useEffect(() => {
    if (draggingCode === null) {
      setDragOverTerm(null);
      return;
    }
    function onDragOver(event: DragEvent) {
      const term = (event.target as Element | null)?.closest?.("[data-term]")?.getAttribute("data-term");
      setDragOverTerm(term == null ? null : Number(term));
    }
    document.addEventListener("dragover", onDragOver);
    return () => document.removeEventListener("dragover", onDragOver);
  }, [draggingCode]);

  useEffect(() => {
    if (!locateRequest) return;
    const el = document.querySelector(`[data-placed="${locateRequest.code}"]`);
    if (!(el instanceof HTMLElement)) return;
    // A two-semester course's part 2 stub flashes with it.
    const part2 = document.querySelector(`[data-part-two="${locateRequest.code}"]`);
    // Part 2 goes to the stub's button; without a stub (the final term) it
    // falls back to part 1.
    const target: HTMLElement = (locateRequest.part === 2 && part2?.querySelector("button")) || el;
    target.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    // preventScroll: the smooth scrollIntoView above is already under way;
    // focus()'s own default jump-to-element would fight it.
    if (locateRequest.focus !== false) target.focus({ preventScroll: true });
    el.classList.add("course-card-highlighted");
    part2?.classList.add("course-card-highlighted");
    const timer = setTimeout(() => {
      el.classList.remove("course-card-highlighted");
      part2?.classList.remove("course-card-highlighted");
    }, 2000);
    // A newer locate cancels this timer, so it has to unhighlight this card
    // itself — otherwise the card keeps the class for good.
    return () => {
      clearTimeout(timer);
      el.classList.remove("course-card-highlighted");
      part2?.classList.remove("course-card-highlighted");
    };
  }, [locateRequest]);
  const placementsByTerm = new Map<number, PlacementView[]>();
  for (const placement of view.placements) {
    const list = placementsByTerm.get(placement.term) ?? [];
    list.push(placement);
    placementsByTerm.set(placement.term, list);
  }

  const focusLeafIds = focusGroupId ? groupLeafIds(view, focusGroupId) : null;
  // One rule for part 1 and its stub, so the two parts always recede together.
  const recededFor = (p: PlacementView) =>
    focusLeafIds !== null && !(p.countsToward && focusLeafIds.has(p.countsToward));

  const dragTargets = draggingCode ? dropTargets(view, draggingCode, draggingBlocked) : null;

  // runAction refuses a disallowed term, with its reason, as it does for
  // every other way in.
  function handleDrop(term: number, code: string) {
    onDragEnd();
    void onAction(actionFor(view, code, term));
  }

  // Terms in pairs by calendar year, each pair under one sticky head.
  const years: { year: number; terms: TermView[] }[] = [];
  for (const term of view.terms) {
    const year = TERMS[term.index].year;
    const last = years[years.length - 1];
    if (last?.year === year) last.terms.push(term);
    else years.push({ year, terms: [term] });
  }
  const hoverAllowed = dragOverTerm !== null && !dragTargets?.some((t) => t.term === dragOverTerm && !t.allowed);

  return (
    <div class="timeline">
      {view.placements.length === 0 && (
        <p class="timeline-hint">Drag a course onto a semester, or use Place in…</p>
      )}
      {showPrereqLinks && view.placements.length > 0 && <PrereqLegend />}
      <div
        class={["timeline-scroll-wrap", edges.left && "more-left", edges.right && "more-right"]
          .filter(Boolean)
          .join(" ")}
      >
        {/* Over the right end of the year band, rather than a row of its
            own above it: the budget tests hold the timeline's head to one
            band (Phase 05 review, 2026-09-29). */}
        <div class="timeline-toolbar">
          <button
            type="button"
            class="timeline-scroll-button"
            aria-label="Scroll to earlier semesters"
            title="Scroll to earlier semesters"
            disabled={!edges.left}
            onClick={() => scrollByPage(-1)}
          >
            <svg class="section-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="m15 6-6 6 6 6" />
            </svg>
          </button>
          <button
            type="button"
            class="timeline-scroll-button"
            aria-label="Scroll to later semesters"
            title="Scroll to later semesters"
            disabled={!edges.right}
            onClick={() => scrollByPage(1)}
          >
            <svg class="section-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        </div>
        <div
          class="timeline-scroll"
          ref={scrollRef}
          onMouseOver={(event) => {
            const card = (event.target as Element).closest("[data-placed]");
            if (card) setHoveredCode(card.getAttribute("data-placed"));
          }}
          onMouseOut={(event) => {
            const related = event.relatedTarget as Element | null;
            if (!related?.closest("[data-placed]")) setHoveredCode(null);
          }}
        >
          <PrereqOverlay view={view} show={showPrereqLinks} hoveredCode={hoveredCode} />
          {years.map(({ year, terms }) => (
            <div key={year} class="timeline-year" data-year={year}>
              {/* The term headings already say the year, so this is for the eye only. */}
              <div class="timeline-year-head glass">
                <span class="timeline-year-label" aria-hidden="true">
                  {year}
                </span>
              </div>
              {terms.map((term) => {
                const target = dragTargets?.find((t) => t.term === term.index) ?? null;
                const greyed = draggingCode !== null && target !== null && !target.allowed;
                const dragOver = draggingCode !== null && dragOverTerm === term.index;
                // A two-semester course takes the hovered term and the next, so
                // the drop outline covers both, whichever year each is in.
                const dragNext =
                  draggingCode !== null && draggingTwoSemester && hoverAllowed && dragOverTerm === term.index - 1;
                const segments = termFamilyUnits(view, term.index);
                const widths = termBarWidths(segments, term.units);
                return (
                  <section
                    key={term.index}
                    data-term={term.index}
                    aria-label={term.label}
                    class={[
                      "term",
                      term.index >= view.plan.cutoff && "term-planned",
                      greyed && "term-disallowed",
                      dragOver && "drag-hover-target",
                      dragNext && "drag-hover-next",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onDragOver={(event) => {
                      if (draggingCode === null) return;
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      const code = event.dataTransfer?.getData("text/plain") || draggingCode;
                      if (code) handleDrop(term.index, code);
                    }}
                  >
                    {/* Sticks under the year label while the cards scroll, so a
                        column scrolled down still says which semester it is. The
                        year band's glass runs down behind it. */}
                    <div class="term-top">
                      <div class="term-head">
                        {/* The year band shows the year, so the heading shows the
                          session; the year stays in its name. */}
                        <h2>
                          {TERMS[term.index].session}
                          <span class="visually-hidden"> {TERMS[term.index].year}</span>
                        </h2>
                        {/* Abbreviated like the cards' "6u", which leaves room for "Completed" beside the heading in a term's column. */}
                        <p class="term-units">
                          <span aria-hidden="true">
                            {term.units}/{NORMAL_TERM_UNITS}u
                          </span>
                          <span class="visually-hidden">
                            {term.units} of {NORMAL_TERM_UNITS} units
                          </span>
                          {term.index < view.plan.cutoff && <span class="term-completed">Completed</span>}
                        </p>
                      </div>
                      <div class="term-bar" role="img" aria-label={termBarLabel(segments)}>
                        {segments.map((s, i) => (
                          <span
                            key={s.key}
                            class="term-bar-segment"
                            data-family={s.key === "none" ? "neutral" : s.key}
                            style={{ width: `${widths[i]}%` }}
                          />
                        ))}
                      </div>
                    </div>
                    {term.overload && (
                      <p role="status" class="badge badge-overload">
                        Heavier load than usual for one semester
                      </p>
                    )}
                    {greyed && target?.reason && <p class="term-reason">{target.reason}</p>}
                    <ul class="term-cards">
                      {(placementsByTerm.get(term.index) ?? []).map((placement) => (
                        <CourseCard
                          key={placement.code}
                          view={view}
                          placement={placement}
                          onAction={onAction}
                          onDragStart={onDragStart}
                          onDragEnd={onDragEnd}
                          openMenuCode={openMenuCode}
                          onMenuOpenChange={onMenuOpenChange}
                          onShowGroup={onShowGroup}
                          onLocateCourse={onLocateCourse}
                          receded={recededFor(placement)}
                          onOpenDetails={onOpenDetails}
                          current={openCode === placement.code}
                          linked={linked}
                        />
                      ))}
                      {partTwoPlacements(view, term.index).map((p) => (
                        <PartTwoStub
                          key={`${p.code}-2`}
                          code={p.code}
                          part1={placedStatus(view, p).parts[0]}
                          units={view.courses[p.code]?.units ?? 0}
                          family={p.countsToward ? familyOf(view, p.countsToward) : null}
                          receded={recededFor(p)}
                          onLocate={() => onLocateCourse(p.code)}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
