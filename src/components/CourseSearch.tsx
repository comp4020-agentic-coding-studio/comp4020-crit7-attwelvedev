import { useState } from "preact/hooks";
import type { CourseCard as CourseCardData, PlanView } from "../lib/domain/view";
import { isError, placeCourse, searchCourses, type SearchResult } from "./api";
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
  const readOnly = view.plan.readOnly;

  async function onSubmit(event: Event) {
    event.preventDefault();
    const q = query.trim();
    if (!q || pending) return;
    setPending(true);
    try {
      const result = await searchCourses(q, planId);
      setResults(result.courses);
      onAnnounce(outcomeMessage(result, q));
    } finally {
      setPending(false);
    }
  }

  async function place(code: string, term: number) {
    const result = await placeCourse(planId, code, term);
    if (isError(result)) onAnnounce(result.error);
    else onChanged(result);
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
      {results.length > 0 && (
        <ul class="course-search-results">
          {results.map((course) => (
            <li
              key={course.code}
              class="course-card course-card-search-result"
              draggable={!readOnly}
              onDragStart={(event) => {
                if (readOnly) {
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
                onPlace={(term) => place(course.code, term)}
                disabled={readOnly}
                open={openMenuCode === course.code}
                onOpenChange={(open) => onMenuOpenChange(course.code, open)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
