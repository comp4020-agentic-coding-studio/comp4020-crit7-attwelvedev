import { useState } from "preact/hooks";
import type { CourseCard as CourseCardData, PlanView } from "../lib/domain/view";
import { isError, placeCourse, searchCourses, type SearchResult } from "./api";
import CourseDetail from "./CourseDetail";
import PlaceInMenu from "./PlaceInMenu";

interface Props {
  view: PlanView;
  planId: string;
  onChanged: (view: PlanView) => void;
  onAnnounce: (message: string) => void;
  onDragStart?: (code: string) => void;
  onDragEnd?: () => void;
  openMenuCode: string | null;
  onMenuOpenChange: (code: string, open: boolean) => void;
}

function outcomeMessage(result: SearchResult, query: string): string {
  switch (result.status) {
    case "found": {
      const count = result.courses.length;
      return count === 1 ? `Found 1 course matching "${query}"` : `Found ${count} courses matching "${query}"`;
    }
    case "fetched":
      return `Fetched ${query.toUpperCase()} from Programs & Courses`;
    case "not_found":
      return `No course found for "${query}"`;
    case "error":
      return result.message ?? `Search for "${query}" failed`;
    case "invalid":
      return result.message ?? "Enter a course code or title to search";
  }
}

interface SearchResultCardProps {
  view: PlanView;
  planId: string;
  course: CourseCardData;
  readOnly: boolean;
  onChanged: (view: PlanView) => void;
  onAnnounce: (message: string) => void;
  onDragStart?: (code: string) => void;
  onDragEnd?: () => void;
  openMenuCode: string | null;
  onMenuOpenChange: (code: string, open: boolean) => void;
}

// Mirrors AvailableCourseCard's markup (same grid, same card width, same
// "Details" dialog) so a search result is visually indistinguishable from
// the requirement-group cards it sits alongside — the only difference is
// the course card the dialog is given directly, since a searched course
// usually isn't (yet) part of the plan's tree.
function SearchResultCard({
  view,
  planId,
  course,
  readOnly,
  onChanged,
  onAnnounce,
  onDragStart,
  onDragEnd,
  openMenuCode,
  onMenuOpenChange,
}: SearchResultCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const draggable = !readOnly;

  async function place(term: number) {
    const result = await placeCourse(planId, course.code, term);
    if (isError(result)) onAnnounce(result.error);
    else onChanged(result);
  }

  return (
    <li
      class="course-card course-card-unplaced"
      draggable={draggable}
      onDragStart={(event) => {
        if (!draggable) {
          event.preventDefault();
          return;
        }
        event.dataTransfer?.setData("text/plain", course.code);
        onDragStart?.(course.code);
      }}
      onDragEnd={() => onDragEnd?.()}
    >
      <strong>{course.code}</strong>
      <span> — {course.title}</span>
      <p class="course-card-units">
        {course.units} units, {course.offeredLabel}
      </p>
      <PlaceInMenu
        view={view}
        code={course.code}
        onPlace={place}
        disabled={readOnly}
        hardBlockedOverride={course.hardBlocked}
        open={openMenuCode === course.code}
        onOpenChange={(open) => onMenuOpenChange(course.code, open)}
      />
      <button type="button" onClick={() => setDetailsOpen(true)}>
        Details
      </button>
      <CourseDetail
        view={view}
        code={course.code}
        course={course}
        planId={planId}
        open={detailsOpen}
        onChanged={onChanged}
        onAnnounce={onAnnounce}
        onClose={() => setDetailsOpen(false)}
      />
    </li>
  );
}

export default function CourseSearch({
  view,
  planId,
  onChanged,
  onAnnounce,
  onDragStart,
  onDragEnd,
  openMenuCode,
  onMenuOpenChange,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CourseCardData[]>([]);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ query: string; message: string } | null>(null);
  const readOnly = view.plan.readOnly;

  async function onSubmit(event: Event) {
    event.preventDefault();
    const q = query.trim();
    if (!q || pending) return;
    setPending(true);
    setStatus(null);
    try {
      const result = await searchCourses(q, planId);
      setResults(result.courses);
      const message = outcomeMessage(result, q);
      setStatus({ query: q, message });
      onAnnounce(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-label="course search" class="course-search">
      <h2>Search courses</h2>
      <form onSubmit={onSubmit}>
        <label>
          Course code or title
          <input type="text" value={query} onInput={(event) => setQuery((event.target as HTMLInputElement).value)} />
        </label>
        <button type="submit" disabled={pending}>
          Search
        </button>
      </form>
      {pending && <p class="course-search-status">Searching…</p>}
      {!pending && status && results.length === 0 && <p class="course-search-status">{status.message}</p>}
      {results.length > 0 && (
        <ul class="available-courses course-search-results" style={{ "--group-columns": Math.min(results.length, 3) || 1 }}>
          {results.map((course) => (
            <SearchResultCard
              key={course.code}
              view={view}
              planId={planId}
              course={course}
              readOnly={readOnly}
              onChanged={onChanged}
              onAnnounce={onAnnounce}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              openMenuCode={openMenuCode}
              onMenuOpenChange={onMenuOpenChange}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
