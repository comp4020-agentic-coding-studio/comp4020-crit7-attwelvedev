import type { ComponentChildren } from "preact";
import type { Family } from "../lib/domain/types";

interface Props {
  id: string;
  label: string;
  compact: boolean;
  onToggle: () => void;
  class?: string;
  // Stays visible either way — the one line a student scans the sidebar for
  // (a group's progress bar, the search box). Compacting hides only `children`.
  summary?: ComponentChildren;
  // Shown only while compact, for sections whose expanded body *is* their
  // summary (the outstanding list), so compacting still leaves a signal.
  compactSummary?: ComponentChildren;
  children?: ComponentChildren;
  // A requirement group's colour family, shown as a dot before its label.
  family?: Family;
  // The group's id, for anything that needs to find its section.
  groupId?: string;
}

// The heading's own text is the toggle (the WAI-ARIA disclosure pattern), so
// the heading keeps its accessible name and the whole title is the click
// target, not a small icon beside it.
export default function SidebarSection({
  id,
  label,
  compact,
  onToggle,
  class: className,
  summary,
  compactSummary,
  children,
  family,
  groupId,
}: Props) {
  const bodyId = `sidebar-section-${id}`;
  return (
    <li
      class={`requirement-group${className ? ` ${className}` : ""}${compact ? " requirement-group-compact" : ""}`}
      data-group={groupId}
    >
      <h2>
        <button type="button" class="section-toggle" aria-expanded={!compact} aria-controls={bodyId} onClick={onToggle}>
          <svg class="section-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m6 9 6 6 6-6" />
          </svg>
          {family && family !== "neutral" && <span class="family-dot" data-family={family} aria-hidden="true" />}
          {label}
        </button>
      </h2>
      {summary}
      {compact && compactSummary}
      <div id={bodyId} hidden={compact}>
        {children}
      </div>
    </li>
  );
}
