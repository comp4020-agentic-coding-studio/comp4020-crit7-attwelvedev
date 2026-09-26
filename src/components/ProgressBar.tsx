import { progressSegments } from "./planner-logic";

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
}

export default function ProgressBar({ label, completed, planned, required, bound = "min" }: Props) {
  const { completedPct, plannedPct } = progressSegments(completed, planned, required);
  const over = completed + planned - required;
  const overNote =
    required > 0 && over > 0
      ? bound === "max"
        ? ` — ${over} unit${over === 1 ? "" : "s"} over the ${required}-unit limit`
        : ` — ${over} unit${over === 1 ? "" : "s"} more than the ${required}-unit minimum, already covered`
      : "";
  const text = `${completed} completed, ${planned} planned of ${required}${overNote}`;
  return (
    <div class="progress-bar">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={required}
        aria-valuenow={completed + planned}
        aria-valuetext={text}
        class="progress-bar-track"
      >
        <span class="progress-bar-completed" style={{ width: `${completedPct}%` }} />
        <span class="progress-bar-planned" style={{ width: `${plannedPct}%`, insetInlineStart: `${completedPct}%` }} />
      </div>
      <p class="progress-bar-text">{text}</p>
    </div>
  );
}
