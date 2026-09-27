import type { OverlayEdgeKind } from "./planner-logic";

// A key for the prerequisite overlay, shown above the timeline while the
// links are on — not in the More options menu that turns them on, which
// closes the moment you look back at the lines it would explain. Each
// sample is a real <line> with the overlay's own kind class, so it's drawn
// by the same CSS rules and can't drift from what it describes. Hidden
// from assistive tech along with the overlay itself: both are visual only.
const ITEMS: { kind: OverlayEdgeKind; label: string }[] = [
  { kind: "required", label: "Required" },
  { kind: "option", label: "One of several options" },
];

export default function PrereqLegend() {
  return (
    <div class="prereq-legend" aria-hidden="true">
      {ITEMS.map(({ kind, label }) => (
        <span key={kind} class="prereq-legend-item">
          <svg class="prereq-legend-sample" viewBox="0 0 28 8" width="28" height="8">
            <line class={`prereq-${kind}`} x1="0" y1="4" x2="28" y2="4" />
          </svg>
          {label}
        </span>
      ))}
      <span class="prereq-legend-hint">Hover a course to pick out its links</span>
    </div>
  );
}
