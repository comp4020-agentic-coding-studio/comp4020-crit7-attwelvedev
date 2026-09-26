import { useRef, useState } from "preact/hooks";
import type { PlanView } from "../lib/domain/view";
import { isError, placeCourse, setCutoff, setPin } from "./api";
import type { RemovedPlacement } from "./CourseCard";
import Sidebar from "./Sidebar";
import Timeline from "./Timeline";

// How long "Undo" stays offered after a Remove — long enough to notice and
// act on without thinking, short enough that it isn't still sitting there
// (offering to restore a now-stale course) minutes into unrelated work.
const UNDO_TIMEOUT_MS = 8000;

interface Props {
  view: PlanView;
}

export default function Planner({ view: initialView }: Props) {
  const [view, setView] = useState(initialView);
  const [announcement, setAnnouncement] = useState("");
  const [draggingCode, setDraggingCode] = useState<string | null>(null);
  const [showPrereqLinks, setShowPrereqLinks] = useState(false);
  const [openMenuCode, setOpenMenuCode] = useState<string | null>(null);
  const [locateRequest, setLocateRequest] = useState<{ code: string; token: number } | null>(null);
  const [removed, setRemoved] = useState<RemovedPlacement | null>(null);
  const [cutoffPending, setCutoffPending] = useState(false);
  const [undoPending, setUndoPending] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readOnly = view.plan.readOnly;

  async function moveCutoff(delta: 1 | -1) {
    const next = view.plan.cutoff + delta;
    if (next < 0 || next > 8) return;
    setCutoffPending(true);
    try {
      const result = await setCutoff(view.plan.id, next);
      if (isError(result)) setAnnouncement(result.error);
      else setView(result);
    } finally {
      setCutoffPending(false);
    }
  }

  function handleRemoved(info: RemovedPlacement) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setRemoved(info);
    undoTimer.current = setTimeout(() => setRemoved(null), UNDO_TIMEOUT_MS);
  }

  // Re-placing a course always lands it unpinned (placeCourse's insert
  // always does) — restoring the pin it had, if any, is a deliberate
  // second call, not a side effect of the first.
  async function handleUndo() {
    if (!removed || undoPending) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const { code, term, pinnedGroupId, label } = removed;
    setUndoPending(true);
    setRemoved(null);
    try {
      const placed = await placeCourse(view.plan.id, code, term);
      if (isError(placed)) {
        setAnnouncement(placed.error);
        return;
      }
      if (!pinnedGroupId) {
        setView(placed);
      } else {
        const pinned = await setPin(view.plan.id, code, pinnedGroupId);
        setView(isError(pinned) ? placed : pinned);
      }
      setAnnouncement(`Restored ${label}`);
    } finally {
      setUndoPending(false);
    }
  }

  const cutoff = view.plan.cutoff;
  const cutoffReadout =
    cutoff <= 0
      ? "Nothing on the timeline counts as completed yet."
      : cutoff >= view.terms.length
        ? "Every semester on the timeline counts as completed."
        : `Completed through ${view.terms[cutoff - 1].label} — planned from ${view.terms[cutoff].label} onward.`;

  return (
    <div class="planner" data-cutoff={view.plan.cutoff}>
      <p aria-live="polite" class="visually-hidden">
        {announcement}
      </p>
      <div class="planner-timeline-area">
        <div class="cutoff-controls" aria-busy={cutoffPending}>
          <button
            type="button"
            disabled={readOnly || cutoffPending || view.plan.cutoff <= 0}
            onClick={() => moveCutoff(-1)}
          >
            Move cutoff earlier
          </button>
          <button
            type="button"
            disabled={readOnly || cutoffPending || view.plan.cutoff >= 8}
            onClick={() => moveCutoff(1)}
          >
            Move cutoff later
          </button>
          <label class="show-links-toggle">
            <input
              type="checkbox"
              checked={showPrereqLinks}
              onChange={(event) => setShowPrereqLinks((event.target as HTMLInputElement).checked)}
            />
            Show prerequisite links
          </label>
        </div>
        <p class="cutoff-readout">{cutoffReadout} The gold line on the timeline marks that boundary.</p>
        <Timeline
          view={view}
          planId={view.plan.id}
          draggingCode={draggingCode}
          onChanged={setView}
          onAnnounce={setAnnouncement}
          onDragStart={setDraggingCode}
          onDragEnd={() => setDraggingCode(null)}
          showPrereqLinks={showPrereqLinks}
          openMenuCode={openMenuCode}
          onMenuOpenChange={(code, next) => setOpenMenuCode(next ? code : null)}
          onRemoved={handleRemoved}
          locateRequest={locateRequest}
        />
      </div>
      {removed && (
        <div class="undo-toast" role="status">
          <span>Removed {removed.label}.</span>
          <button type="button" disabled={undoPending} onClick={handleUndo}>
            {undoPending ? "Restoring…" : "Undo"}
          </button>
        </div>
      )}
      <Sidebar
        view={view}
        planId={view.plan.id}
        onChanged={setView}
        onAnnounce={setAnnouncement}
        onDragStart={setDraggingCode}
        onDragEnd={() => setDraggingCode(null)}
        openMenuCode={openMenuCode}
        onMenuOpenChange={(code, next) => setOpenMenuCode(next ? code : null)}
        onLocateCourse={(code) => setLocateRequest({ code, token: Date.now() })}
      />
    </div>
  );
}
