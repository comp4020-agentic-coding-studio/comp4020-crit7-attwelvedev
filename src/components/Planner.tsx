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
  const readOnly = view.plan.readOnly;

  async function moveCutoff(delta: 1 | -1) {
    const next = view.plan.cutoff + delta;
    if (next < 0 || next > 8) return;
    const result = await setCutoff(view.plan.id, next);
    if (isError(result)) setAnnouncement(result.error);
    else setView(result);
  }

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
        </div>
        <Timeline
          view={view}
          planId={view.plan.id}
          draggingCode={draggingCode}
          onChanged={setView}
          onAnnounce={setAnnouncement}
          onDragStart={setDraggingCode}
          onDragEnd={() => setDraggingCode(null)}
        />
      </div>
      <Sidebar
        view={view}
        planId={view.plan.id}
        onChanged={setView}
        onAnnounce={setAnnouncement}
        onDragStart={setDraggingCode}
        onDragEnd={() => setDraggingCode(null)}
      />
    </div>
  );
}
