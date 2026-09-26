import type { PlacementView, PlanView } from "../lib/domain/view";
import { isError, placeCourse } from "./api";
import CourseCard from "./CourseCard";
import { dropTargets } from "./planner-logic";
import PrereqOverlay from "./PrereqOverlay";

interface Props {
  view: PlanView;
  planId: string;
  draggingCode: string | null;
  onChanged: (view: PlanView) => void;
  onAnnounce: (message: string) => void;
  onDragStart: (code: string) => void;
  onDragEnd: () => void;
  showPrereqLinks: boolean;
  openMenuCode: string | null;
  onMenuOpenChange: (code: string, open: boolean) => void;
}

export default function Timeline({
  view,
  planId,
  draggingCode,
  onChanged,
  onAnnounce,
  onDragStart,
  onDragEnd,
  showPrereqLinks,
  openMenuCode,
  onMenuOpenChange,
}: Props) {
  const placementsByTerm = new Map<number, PlacementView[]>();
  for (const placement of view.placements) {
    const list = placementsByTerm.get(placement.term) ?? [];
    list.push(placement);
    placementsByTerm.set(placement.term, list);
  }

  const dragTargets = draggingCode ? dropTargets(view, draggingCode) : null;

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
      <div class="timeline-scroll">
        <PrereqOverlay view={view} show={showPrereqLinks} />
        {view.terms.map((term) => {
          const target = dragTargets?.find((t) => t.term === term.index) ?? null;
          const greyed = draggingCode !== null && target !== null && !target.allowed;
          return (
            <section
              key={term.index}
              data-term={term.index}
              aria-label={term.label}
              class={greyed ? "term term-disallowed" : "term"}
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
              <h2>{term.label}</h2>
              {term.overload && <p role="status">Overload: {term.units} units</p>}
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
