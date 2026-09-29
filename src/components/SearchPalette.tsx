import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { CourseCard as CourseCardData, PlanView } from "../lib/domain/view";
import AvailableCourseCard from "./AvailableCourseCard";
import { searchCourses } from "./api";
import type { PlanAction } from "./plan-actions";
import PlacedCourseRow from "./PlacedCourseRow";
import { outcomeMessage } from "./search-message";

interface Props {
  view: PlanView;
  planId: string;
  open: boolean;
  onClose: () => void;
  // A result outside the plan's tree has no view.courses entry, so the
  // timeline can only grey its blocked terms mid-drag if it hears about it.
  onResults: (courses: CourseCardData[]) => void;
  onOpenDetails: (code: string) => void;
  onAnnounce: (message: string) => void;
  onDragStart: (code: string) => void;
  onDragEnd: () => void;
  openMenuCode: string | null;
  onMenuOpenChange: (code: string, open: boolean) => void;
  onLocateCourse: (code: string, part?: 2) => void;
  onAction: (action: PlanAction) => Promise<void>;
  // The course open in the details sidebar, whose titles say so.
  openCode: string | null;
  // The planner is in its stacked (phone) layout, so the palette takes the
  // whole screen. Its container query can't reach out here: see Planner.
  stacked: boolean;
}

const TITLES = ".course-card-title, .placed-row-title";
const FOCUSABLE = "button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";

// The one sanctioned modal: a transient chooser. It stays mounted while
// closed, so the last search is still there when it's reopened.
export default function SearchPalette({
  view,
  planId,
  open,
  onClose,
  onResults,
  onOpenDetails,
  onAnnounce,
  onDragStart,
  onDragEnd,
  openMenuCode,
  onMenuOpenChange,
  onLocateCourse,
  onAction,
  openCode,
  stacked,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CourseCardData[]>([]);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ query: string; message: string } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // In the same commit that shows the palette, so a key pressed straight
  // after opening it (Escape, Tab, typing) already lands inside.
  useLayoutEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const placedOf = (code: string) => view.placements.find((p) => p.code === code) ?? null;
  const unplacedResults = results.filter((c) => !placedOf(c.code));
  const placedResults = results.filter((c) => placedOf(c.code));

  async function onSubmit(event: Event) {
    event.preventDefault();
    const q = query.trim();
    if (!q || pending) return;
    setPending(true);
    setStatus(null);
    try {
      const result = await searchCourses(q, planId);
      setResults(result.courses);
      onResults(result.courses);
      const message = outcomeMessage(result, q);
      setStatus({ query: q, message });
      onAnnounce(message);
    } finally {
      setPending(false);
    }
  }

  // Both leave the palette for something behind it, so it closes first:
  // focus goes back to the trigger, which the sidebar then remembers as
  // what to return to.
  function openDetails(code: string) {
    onClose();
    onOpenDetails(code);
  }
  function locate(code: string, part?: 2) {
    onClose();
    onLocateCourse(code, part);
  }

  function onKeyDown(event: KeyboardEvent) {
    const dialog = dialogRef.current!;
    const active = document.activeElement as HTMLElement | null;
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "Tab") {
      const focusable = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first?.focus();
      }
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const titles = [...dialog.querySelectorAll<HTMLElement>(TITLES)];
    if (active === inputRef.current) {
      if (event.key !== "ArrowDown" || titles.length === 0) return;
      event.preventDefault();
      titles[0].focus();
      return;
    }
    const index = titles.indexOf(active!);
    if (index < 0) return;
    event.preventDefault();
    const next = index + (event.key === "ArrowDown" ? 1 : -1);
    if (next < 0) inputRef.current?.focus();
    else titles[Math.min(next, titles.length - 1)].focus();
  }

  return (
    <div
      class="palette-backdrop"
      data-stacked={stacked || undefined}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        class="course-search palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search courses"
        ref={dialogRef}
        onKeyDown={onKeyDown}
      >
        <form onSubmit={onSubmit}>
          <label>
            Course code or title
            <span class="course-search-field">
              <svg class="course-search-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                placeholder="e.g. COMP1100"
                value={query}
                onInput={(event) => setQuery((event.target as HTMLInputElement).value)}
              />
            </span>
          </label>
          <button type="submit" disabled={pending}>
            Search
          </button>
          {/* Full screen on a phone there's no backdrop to tap and no Escape key. */}
          <button type="button" class="details-icon-button" aria-label="Close search" onClick={onClose}>
            <svg class="details-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </form>
        <div class="palette-results">
          {pending && <p class="course-search-status">Searching…</p>}
          {!pending && status && results.length === 0 && <p class="course-search-status">{status.message}</p>}
          {/* The requirement groups' own card and row, so a result — placed or not — looks and behaves exactly like one. */}
          {unplacedResults.length > 0 && (
            <ul class="available-courses course-search-results" data-columns={Math.min(unplacedResults.length, 3) || 1}>
              {unplacedResults.map((course) => (
                <AvailableCourseCard
                  key={course.code}
                  view={view}
                  code={course.code}
                  course={course}
                  onAction={onAction}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  openMenuCode={openMenuCode}
                  onMenuOpenChange={onMenuOpenChange}
                  onOpenDetails={openDetails}
                  current={openCode === course.code}
                />
              ))}
            </ul>
          )}
          {placedResults.length > 0 && (
            <ul class="placed-rows course-search-placed">
              {placedResults.map((course) => (
                <PlacedCourseRow
                  key={course.code}
                  view={view}
                  code={course.code}
                  course={course}
                  placement={placedOf(course.code)!}
                  onLocateCourse={locate}
                  onOpenDetails={openDetails}
                  current={openCode === course.code}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
