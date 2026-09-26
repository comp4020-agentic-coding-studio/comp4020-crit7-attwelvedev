import { useState } from "preact/hooks";
import type { PlanView } from "../lib/domain/view";
import { isError, setCutoff } from "./api";
import Sidebar from "./Sidebar";
import Timeline from "./Timeline";

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
  const readOnly = view.plan.readOnly;

  async function moveCutoff(delta: 1 | -1) {
    const next = view.plan.cutoff + delta;
    if (next < 0 || next > 8) return;
    const result = await setCutoff(view.plan.id, next);
    if (isError(result)) setAnnouncement(result.error);
    else setView(result);
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
        <div class="cutoff-controls">
          <button type="button" disabled={readOnly || view.plan.cutoff <= 0} onClick={() => moveCutoff(-1)}>
            Move cutoff earlier
          </button>
          <button type="button" disabled={readOnly || view.plan.cutoff >= 8} onClick={() => moveCutoff(1)}>
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
          locateRequest={locateRequest}
        />
      </div>
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
