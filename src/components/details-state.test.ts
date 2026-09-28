import { describe, expect, it } from "vitest";
import {
  closeDetails,
  courseParam,
  EMPTY_DETAILS,
  openCourse,
  stepHistory,
  withCourseParam,
} from "./details-state";

describe("openCourse", () => {
  it("opens a course from nothing", () => {
    const state = openCourse(EMPTY_DETAILS, "COMP2100");
    expect(state.code).toBe("COMP2100");
    expect(state.history).toEqual(["COMP2100"]);
    expect(state.index).toBe(0);
    expect(state.focus).toBe("top");
  });

  it("truncates forward history when opening after stepping back", () => {
    let state = openCourse(EMPTY_DETAILS, "AAAA1000");
    state = openCourse(state, "BBBB1000");
    state = stepHistory(state, -1);
    state = openCourse(state, "CCCC1000");
    expect(state.history).toEqual(["AAAA1000", "CCCC1000"]);
    expect(state.index).toBe(1);
    expect(state.code).toBe("CCCC1000");
  });

  it("re-opening the open course keeps the history and bumps the token", () => {
    const first = openCourse(EMPTY_DETAILS, "COMP2100");
    const again = openCourse(first, "COMP2100", "requisites");
    expect(again.history).toEqual(["COMP2100"]);
    expect(again.index).toBe(0);
    expect(again.focus).toBe("requisites");
    expect(again.token).toBeGreaterThan(first.token);
  });
});

describe("stepHistory", () => {
  it("is clamped at both ends", () => {
    let state = openCourse(EMPTY_DETAILS, "AAAA1000");
    state = openCourse(state, "BBBB1000");
    const forward = stepHistory(state, 1);
    expect(forward.index).toBe(1);
    expect(forward.code).toBe("BBBB1000");
    const back = stepHistory(stepHistory(state, -1), -1);
    expect(back.index).toBe(0);
    expect(back.code).toBe("AAAA1000");
  });
});

describe("closeDetails", () => {
  it("clears the code and keeps the history", () => {
    const state = closeDetails(openCourse(EMPTY_DETAILS, "COMP2100"));
    expect(state.code).toBeNull();
    expect(state.history).toEqual(["COMP2100"]);
  });
});

describe("courseParam", () => {
  it("reads a well-formed course code", () => {
    expect(courseParam("?course=COMP2100")).toBe("COMP2100");
  });
  it("rejects anything else", () => {
    expect(courseParam("?course=bad")).toBeNull();
    expect(courseParam("")).toBeNull();
  });
});

describe("withCourseParam", () => {
  it("sets course and keeps other parameters", () => {
    const url = new URL(withCourseParam("https://x/plan/a?foo=1", "COMP2100"));
    expect(url.searchParams.get("foo")).toBe("1");
    expect(url.searchParams.get("course")).toBe("COMP2100");
  });
  it("removes course for null", () => {
    const url = new URL(withCourseParam("https://x/plan/a?foo=1&course=COMP2100", null));
    expect(url.searchParams.get("foo")).toBe("1");
    expect(url.searchParams.has("course")).toBe(false);
  });
});
