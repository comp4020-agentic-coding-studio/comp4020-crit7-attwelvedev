import { progressSegments } from "./planner-logic";

interface Props {
  label: string;
  completed: number;
  planned: number;
  required: number;
}

export default function ProgressBar({ label, completed, planned, required }: Props) {
  const { completedPct, plannedPct } = progressSegments(completed, planned, required);
  const text = `${completed} completed, ${planned} planned of ${required}`;
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
