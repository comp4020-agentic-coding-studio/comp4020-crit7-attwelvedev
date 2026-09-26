import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { parseRequisites } from "../domain/requisites";
import { fetchCourseFromPandc } from "./fetch-pandc";
import { fromPandc, type PandcCourseJson } from "./from-pandc";

function loadExpected(code: string): PandcCourseJson {
  return JSON.parse(readFileSync(`data/2027/courses/${code}.json`, "utf-8"));
}

function loadFixture(code: string): string {
  return readFileSync(`src/lib/catalogue/__fixtures__/${code}.html`, "utf-8");
}

function okFetch(html: string): typeof fetch {
  return vi.fn(async () => new Response(html, { status: 200 })) as unknown as typeof fetch;
}

describe("fetchCourseFromPandc", () => {
  it("parses COMP2100.html like the scraped JSON", async () => {
    const outcome = await fetchCourseFromPandc("COMP2100", okFetch(loadFixture("COMP2100")));
    expect(outcome.status).toBe("fetched");
    if (outcome.status !== "fetched") throw new Error("unreachable");

    const expectedJson = loadExpected("COMP2100");
    const expected = fromPandc(expectedJson, null, parseRequisites);
    expect(outcome.course.title).toBe(expected.title);
    expect(outcome.course.units).toBe(6);
    expect(outcome.course.requisiteRaw).toBe(expected.requisiteRaw);
    expect(outcome.course.requisites).toEqual(expected.requisites);
    expect(outcome.course.offerings).toEqual(expected.offerings);
  });

  it("parses MATH1116.html like the scraped JSON", async () => {
    const outcome = await fetchCourseFromPandc("MATH1116", okFetch(loadFixture("MATH1116")));
    expect(outcome.status).toBe("fetched");
    if (outcome.status !== "fetched") throw new Error("unreachable");

    const expectedJson = loadExpected("MATH1116");
    const expected = fromPandc(expectedJson, null, parseRequisites);
    expect(outcome.course.title).toBe(expected.title);
    expect(outcome.course.units).toBe(6);
    expect(outcome.course.requisiteRaw).toBe(expected.requisiteRaw);
    expect(outcome.course.requisites).toEqual(expected.requisites);
    expect(outcome.course.offerings).toEqual(expected.offerings);
  });

  it("302 to /Error/ → not_found", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "https://programsandcourses.anu.edu.au/Error/Index/404?aspxerrorpath=/2027/course/ZZZZ9999" },
        }),
    ) as unknown as typeof fetch;
    const outcome = await fetchCourseFromPandc("ZZZZ9999", fetchImpl);
    expect(outcome.status).toBe("not_found");
  });

  it("network error → error, nothing returned", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const outcome = await fetchCourseFromPandc("COMP2100", fetchImpl);
    expect(outcome.status).toBe("error");
  });

  it("sends a self-identifying User-Agent", async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => new Response(loadFixture("COMP2100"), { status: 200 }));
    await fetchCourseFromPandc("COMP2100", fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0];
    const headers = new Headers(init.headers);
    expect(headers.get("user-agent")).toMatch(/^anu-degree-planner/);
  });

  it("rejects malformed codes without fetching", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const outcome = await fetchCourseFromPandc("not-a-code", fetchImpl);
    expect(outcome.status).toBe("error");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
