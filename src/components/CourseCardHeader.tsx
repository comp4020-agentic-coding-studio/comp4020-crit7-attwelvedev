import { unitsLabel } from "./planner-logic";

interface Props {
  code: string;
  title: string;
  units: { units: number; twoSemester: boolean };
  // Only a card that can actually be dragged shows where to grab it.
  grip: boolean;
  onOpenDetails: () => void;
}

// A card's first line (code and units) and its title. Shared by timeline
// and sidebar cards so both read the same way. The title is the way into
// Details, so no separate button is needed for it.
export default function CourseCardHeader({ code, title, units, grip, onOpenDetails }: Props) {
  const label = unitsLabel(units);
  return (
    <>
      <div class="course-card-head">
        {grip && (
          // Decorative: the whole card is draggable and the keyboard route
          // is "Place in…"/"Move to", so the grip is neither announced nor
          // a tab stop.
          <span class="course-card-grip" aria-hidden="true">
            <svg viewBox="0 0 10 16" focusable="false">
              <circle cx="3" cy="3" r="1.4" />
              <circle cx="7" cy="3" r="1.4" />
              <circle cx="3" cy="8" r="1.4" />
              <circle cx="7" cy="8" r="1.4" />
              <circle cx="3" cy="13" r="1.4" />
              <circle cx="7" cy="13" r="1.4" />
            </svg>
          </span>
        )}
        <strong class="course-card-code">{code}</strong>
        <span class="course-card-unit-count">
          <span aria-hidden="true">{label.short}</span>
          <span class="visually-hidden">{label.full}</span>
        </span>
      </div>
      {/* Named with aria-label, not a visually-hidden span: that span is
          absolutely positioned, and Chromium then puts a space before its
          comma in the computed name. */}
      <button type="button" class="course-card-title" aria-label={`${title}, details`} onClick={onOpenDetails}>
        {title}
      </button>
    </>
  );
}
