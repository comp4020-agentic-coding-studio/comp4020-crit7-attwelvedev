import { useEffect, useState } from "preact/hooks";
import { NORMAL_TERM_UNITS, type PlacementView, type PlanView } from "../lib/domain/view";
import { isError, placeCourse } from "./api";
import CourseCard, { type RemovedPlacement } from "./CourseCard";
import { dropTargets, termBarLabel, termBarWidths, termFamilyUnits } from "./planner-logic";
import PrereqLegend from "./PrereqLegend";
import PrereqOverlay from "./PrereqOverlay";

interface Props {
  view: PlanView;
  planId: string;
  draggingCode: string | null;
  // The dragged course's hardBlocked map when view.courses may lack it (a
  // search result) — see dropTargets.
  draggingBlocked?: Record<number, string>;
  onChanged: (view: PlanView) => void;
  onAnnounce: (message: string) => void;
  onDragStart: (code: string) => void;
  onDragEnd: () => void;
  showPrereqLinks: boolean;
  openMenuCode: string | null;
  onMenuOpenChange: (code: string, open: boolean) => void;
  onRemoved: (removed: RemovedPlacement) => void;
  // Set from the sidebar's "Placed in <term>" badge, to scroll to and
  // flash the matching card; a token so clicking the same badge twice in a
  // row re-triggers the effect even though the code didn't change.
  locateRequest: { code: string; token: number } | null;
  // Opens a card's "Counts toward" group in the requirements sidebar.
  onShowGroup: (groupId: string) => void;
}

export default function Timeline({
  view,
  planId,
  draggingCode,
  draggingBlocked,
  onChanged,
  onAnnounce,
  onDragStart,
  onDragEnd,
  showPrereqLinks,
  openMenuCode,
  onMenuOpenChange,
  onRemoved,
  locateRequest,
  onShowGroup,
}: Props) {
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);
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
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    // preventScroll: the smooth scrollIntoView above is already under way;
    // focus()'s own default jump-to-element would fight it.
    el.focus({ preventScroll: true });
    el.classList.add("course-card-highlighted");
    const timer = setTimeout(() => el.classList.remove("course-card-highlighted"), 2000);
    // A newer locate cancels this timer, so it has to unhighlight this card
    // itself — otherwise the card keeps the class for good.
    return () => {
      clearTimeout(timer);
      el.classList.remove("course-card-highlighted");
    };
  }, [locateRequest]);
  const placementsByTerm = new Map<number, PlacementView[]>();
  for (const placement of view.placements) {
    const list = placementsByTerm.get(placement.term) ?? [];
    list.push(placement);
    placementsByTerm.set(placement.term, list);
  }

  const dragTargets = draggingCode ? dropTargets(view, draggingCode, draggingBlocked) : null;

  async function handleDrop(term: number, code: string) {
    onDragEnd();
    const target = dragTargets?.find((t) => t.term === term);
    if (target && !target.allowed) {
      if (target.reason) onAnnounce(target.reason);
      return;
    }
    const result = await placeCourse(planId, code, term);
    if (isError(result)) onAnnounce(result.error);
    else onChanged(result);
  }

  return (
    <div class="timeline">
      {view.placements.length === 0 && (
        <p class="timeline-hint">Drag a course onto a semester, or use Place in…</p>
      )}
      {showPrereqLinks && view.placements.length > 0 && <PrereqLegend />}
      <div
        class="timeline-scroll"
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
        {view.terms.map((term) => {
          const target = dragTargets?.find((t) => t.term === term.index) ?? null;
          const greyed = draggingCode !== null && target !== null && !target.allowed;
          const dragOver = draggingCode !== null && dragOverTerm === term.index;
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
                if (code) void handleDrop(term.index, code);
              }}
            >
              <div class="term-head">
                <h2>{term.label}</h2>
                <p class="term-units">
                  {term.units}/{NORMAL_TERM_UNITS} units
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
                    planId={planId}
                    onChanged={onChanged}
                    onAnnounce={onAnnounce}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    openMenuCode={openMenuCode}
                    onMenuOpenChange={onMenuOpenChange}
                    onRemoved={onRemoved}
                    onShowGroup={onShowGroup}
                  />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
