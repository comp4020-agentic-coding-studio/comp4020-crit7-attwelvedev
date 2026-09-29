import type { Family } from "../lib/domain/types";
import { progressBarNumbers, progressSegments } from "./planner-logic";

interface Props {
  label: string;
  completed: number;
  planned: number;
  required: number;
  // "min" (the default — a group, or a check like "at least 48 units"):
  // going over is progress, not a problem. "max" (a check like "at most 60
  // units at 1000-level"): going over is the constraint actually failing.
  // The bar itself clamps at 100% either way, so once it's full this text
  // is the only place that distinction — and by how much — is visible.
  bound?: "min" | "max";
  // A requirement group's colour family. Without one (Total, the checks)
  // the bar stays gold.
  family?: Family;
  // Shows only the figures under the bar, for a bar with its own note
  // beside it (a program check). Its value text keeps the over note.
  figuresOnly?: boolean;
}

export default function ProgressBar({
  label,
  completed,
  planned,
  required,
  bound = "min",
  family,
  figuresOnly = false,
}: Props) {
  const { completedPct, plannedPct } = progressSegments(completed, planned, required);
  const { valueNow, valueMax, text, figures } = progressBarNumbers(completed, planned, required, bound);
  return (
    <div class="progress-bar" data-family={family}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={valueMax}
        aria-valuenow={valueNow}
        aria-valuetext={text}
        class="progress-bar-track"
      >
        <span class="progress-bar-completed" style={{ width: `${completedPct}%` }} />
        <span class="progress-bar-planned" style={{ width: `${plannedPct}%`, insetInlineStart: `${completedPct}%` }} />
      </div>
      <p class="progress-bar-text">{figuresOnly ? figures : text}</p>
    </div>
  );
}
