import { describe, expect, it } from "vitest";
import {
  closeDetails,
  courseCode,
  type DetailsSubject,
  EMPTY_DETAILS,
  openSubject,
  specCode,
  stepHistory,
  subjectParam,
  withSubjectParam,
} from "./details-state";

const course = (code: string): DetailsSubject => ({ kind: "course", code });
const spec = (code: string): DetailsSubject => ({ kind: "spec", code });

describe("openSubject", () => {
  it("opens a subject from nothing", () => {
    const state = openSubject(EMPTY_DETAILS, course("COMP2100"));
    expect(state.subject).toEqual(course("COMP2100"));
    expect(state.history).toEqual([course("COMP2100")]);
    expect(state.index).toBe(0);
    expect(state.focus).toBe("top");
  });

  it("truncates forward history when opening after stepping back", () => {
    let state = openSubject(EMPTY_DETAILS, course("AAAA1000"));
    state = openSubject(state, course("BBBB1000"));
    state = stepHistory(state, -1);
    state = openSubject(state, course("CCCC1000"));
    expect(state.history).toEqual([course("AAAA1000"), course("CCCC1000")]);
    expect(state.index).toBe(1);
    expect(state.subject).toEqual(course("CCCC1000"));
  });

  it("re-opening the open subject keeps the history and bumps the token", () => {
    const first = openSubject(EMPTY_DETAILS, course("COMP2100"));
    const again = openSubject(first, course("COMP2100"), "requisites");
    expect(again.history).toEqual([course("COMP2100")]);
    expect(again.index).toBe(0);
    expect(again.focus).toBe("requisites");
    expect(again.token).toBeGreaterThan(first.token);
  });

  it("keeps courses and specialisations on one trail", () => {
    let state = openSubject(EMPTY_DETAILS, course("AAAA1000"));
    state = openSubject(state, spec("ARIN-SPEC"));
    state = openSubject(state, course("BBBB1000"));
    state = stepHistory(stepHistory(state, -1), -1);
    expect(state.subject).toEqual(course("AAAA1000"));
    state = stepHistory(state, 1);
    expect(state.subject).toEqual(spec("ARIN-SPEC"));
  });

  it("treats a spec and a course with the same code as different subjects", () => {
    const state = openSubject(openSubject(EMPTY_DETAILS, course("X")), spec("X"));
    expect(state.history).toEqual([course("X"), spec("X")]);
    expect(state.index).toBe(1);
  });
});

describe("stepHistory", () => {
  it("is clamped at both ends", () => {
    let state = openSubject(EMPTY_DETAILS, course("AAAA1000"));
    state = openSubject(state, course("BBBB1000"));
    const forward = stepHistory(state, 1);
    expect(forward.index).toBe(1);
    expect(forward.subject).toEqual(course("BBBB1000"));
    const back = stepHistory(stepHistory(state, -1), -1);
    expect(back.index).toBe(0);
    expect(back.subject).toEqual(course("AAAA1000"));
  });
});

describe("closeDetails", () => {
  it("clears the subject and keeps the history", () => {
    const state = closeDetails(openSubject(EMPTY_DETAILS, course("COMP2100")));
    expect(state.subject).toBeNull();
    expect(state.history).toEqual([course("COMP2100")]);
  });
});

describe("subjectParam", () => {
  it("reads a well-formed course code", () => {
    expect(subjectParam("?course=COMP2100")).toEqual(course("COMP2100"));
  });
  it("reads a well-formed specialisation code", () => {
    expect(subjectParam("?spec=ARIN-SPEC")).toEqual(spec("ARIN-SPEC"));
  });
  it("prefers the course when both are present", () => {
    expect(subjectParam("?spec=ARIN-SPEC&course=COMP2100")).toEqual(course("COMP2100"));
  });
  it("rejects anything else", () => {
    expect(subjectParam("?spec=arin")).toBeNull();
    expect(subjectParam("?spec=ARIN")).toBeNull();
    expect(subjectParam("?course=bad")).toBeNull();
    expect(subjectParam("")).toBeNull();
  });
});

describe("withSubjectParam", () => {
  it("sets course, removes spec and keeps other parameters", () => {
    const url = new URL(withSubjectParam("https://x/plan/a?foo=1&spec=ARIN-SPEC", course("COMP2100")));
    expect(url.searchParams.get("foo")).toBe("1");
    expect(url.searchParams.get("course")).toBe("COMP2100");
    expect(url.searchParams.has("spec")).toBe(false);
  });
  it("sets spec and removes course", () => {
    const url = new URL(withSubjectParam("https://x/plan/a?course=COMP2100", spec("ARIN-SPEC")));
    expect(url.searchParams.get("spec")).toBe("ARIN-SPEC");
    expect(url.searchParams.has("course")).toBe(false);
  });
  it("removes both for null", () => {
    const url = new URL(withSubjectParam("https://x/plan/a?foo=1&course=COMP2100&spec=ARIN-SPEC", null));
    expect(url.searchParams.get("foo")).toBe("1");
    expect(url.searchParams.has("course")).toBe(false);
    expect(url.searchParams.has("spec")).toBe(false);
  });
});

describe("courseCode and specCode", () => {
  it("each read their own kind only", () => {
    const onCourse = openSubject(EMPTY_DETAILS, course("COMP2100"));
    const onSpec = openSubject(EMPTY_DETAILS, spec("ARIN-SPEC"));
    expect(courseCode(onCourse)).toBe("COMP2100");
    expect(specCode(onCourse)).toBeNull();
    expect(specCode(onSpec)).toBe("ARIN-SPEC");
    expect(courseCode(onSpec)).toBeNull();
    expect(courseCode(EMPTY_DETAILS)).toBeNull();
  });
});
