import { describe, expect, it } from "vitest";
import type { SearchResult } from "./api";
import { outcomeMessage } from "./search-message";

describe("outcomeMessage — not_found", () => {
  const notFound: SearchResult = { status: "not_found", courses: [] };

  it("suggests an exact course code after a title search misses", () => {
    expect(outcomeMessage(notFound, "software eng")).toBe(
      'No course found for "software eng". Try entering the exact course code, e.g. COMP1100.',
    );
  });

  it("asks to check the code when the query already is one", () => {
    expect(outcomeMessage(notFound, "comp9999")).toBe('No course found for "comp9999". Check the code is correct.');
  });
});
