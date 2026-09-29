import type { SearchResult } from "./api";

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
