import { useState } from "preact/hooks";
import type { CourseCard as CourseCardData, PlanView } from "../lib/domain/view";
import AvailableCourseCard from "./AvailableCourseCard";
import { searchCourses, type SearchResult } from "./api";
import PlacedCourseRow from "./PlacedCourseRow";
import SidebarSection from "./SidebarSection";

interface Props {
  view: PlanView;
  planId: string;
  onChanged: (view: PlanView) => void;
  onAnnounce: (message: string) => void;
  onDragStart?: (code: string) => void;
  onDragEnd?: () => void;
  // A result outside the plan's tree has no view.courses entry, so the
  // timeline can only grey its blocked terms mid-drag if it hears about it.
  onResults?: (courses: CourseCardData[]) => void;
  openMenuCode: string | null;
  onMenuOpenChange: (code: string, open: boolean) => void;
  onLocateCourse: (code: string, part?: 2) => void;
  compact: boolean;
  onToggleCompact: () => void;
  onExpand: () => void;
}

// Same shape the search endpoint uses to decide whether to fetch from P&C.
const COURSE_CODE = /^[A-Z]{4}\d{4}$/;

export function outcomeMessage(result: SearchResult, query: string): string {
  switch (result.status) {
    case "found": {
      const count = result.courses.length;
      return count === 1 ? `Found 1 course matching "${query}"` : `Found ${count} courses matching "${query}"`;
    }
    case "fetched":
      return `Fetched ${query.toUpperCase()} from Programs & Courses`;
    // Titles only match courses already in the local catalogue, but an
    // exact code is also looked up on P&C — so steer title searches there.
    case "not_found":
      return COURSE_CODE.test(query.trim().toUpperCase())
        ? `No course found for "${query}". Check the code is correct.`
        : `No course found for "${query}". Try entering the exact course code, e.g. COMP1100.`;
    case "error":
      return result.message ?? `Search for "${query}" failed`;
    case "invalid":
      return result.message ?? "Enter a course code or title to search";
  }
}

export default function CourseSearch({
  view,
  planId,
  onChanged,
  onAnnounce,
  onDragStart,
  onDragEnd,
  onResults,
  openMenuCode,
  onMenuOpenChange,
  onLocateCourse,
  compact,
  onToggleCompact,
  onExpand,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CourseCardData[]>([]);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ query: string; message: string } | null>(null);

  const placedOf = (code: string) => view.placements.find((p) => p.code === code) ?? null;
  const unplacedResults = results.filter((c) => !placedOf(c.code));
  const placedResults = results.filter((c) => placedOf(c.code));

  async function onSubmit(event: Event) {
    event.preventDefault();
    const q = query.trim();
    if (!q || pending) return;
    setPending(true);
    setStatus(null);
    // A new search is a request to see results, so it undoes compacting.
    onExpand();
    try {
      const result = await searchCourses(q, planId);
      setResults(result.courses);
      onResults?.(result.courses);
      const message = outcomeMessage(result, q);
      setStatus({ query: q, message });
      onAnnounce(message);
    } finally {
      setPending(false);
    }
  }

  return (
    // Compacting keeps the search box — it's the section's whole point and
    // costs one row — and hides only the results, which are what grow long.
    <SidebarSection
      id="search"
      label="Search courses"
      class="course-search"
      compact={compact}
      onToggle={onToggleCompact}
      summary={
        <form onSubmit={onSubmit}>
          <label>
            Course code or title
            <span class="course-search-field">
              <svg class="course-search-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>
              <input
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
        </form>
      }
      compactSummary={
        results.length > 0 && (
          <p class="course-search-status">
            {results.length} result{results.length === 1 ? "" : "s"} hidden
          </p>
        )
      }
    >
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
              planId={planId}
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
      {placedResults.length > 0 && (
        <ul class="placed-rows course-search-placed">
          {placedResults.map((course) => (
            <PlacedCourseRow
              key={course.code}
              view={view}
              code={course.code}
              course={course}
              placement={placedOf(course.code)!}
              planId={planId}
              onChanged={onChanged}
              onAnnounce={onAnnounce}
              onLocateCourse={onLocateCourse}
            />
          ))}
        </ul>
      )}
    </SidebarSection>
  );
}
