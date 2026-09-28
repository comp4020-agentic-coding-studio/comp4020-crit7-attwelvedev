import { readFileSync } from "node:fs";
import { describe, expect, inject, it } from "vitest";

// Follows the starter's HTTP test conventions (spec/guestbook.test.ts, now
// removed): drive the running, built server over HTTP.
const baseUrl = inject("baseUrl");

const postForm = (path: string, body: URLSearchParams = new URLSearchParams()) =>
  fetch(new URL(path, baseUrl), { method: "POST", headers: { origin: baseUrl }, body, redirect: "manual" });

const postJson = (path: string, body: unknown) =>
  fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { origin: baseUrl, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const del = (path: string) => fetch(new URL(path, baseUrl), { method: "DELETE", headers: { origin: baseUrl } });

const putJson = (path: string, body: unknown) =>
  fetch(new URL(path, baseUrl), {
    method: "PUT",
    headers: { origin: baseUrl, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

async function createPlan(): Promise<string> {
  const res = await postForm("/api/plans");
  const location = res.headers.get("location") ?? "";
  return location.replace("/plan/", "");
}

describe("planner", () => {
  it("POST /api/plans creates a plan and redirects", async () => {
    const res = await postForm("/api/plans");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toMatch(/^\/plan\/[A-Za-z0-9_-]{22}$/);
  });

  it("placing a course persists across reload", async () => {
    const id = await createPlan();
    const res = await postJson(`/api/plans/${id}/placements`, { code: "COMP1130", term: 0 });
    expect(res.status).toBe(200);
    const view = await res.json();
    expect(view.placements).toContainEqual(expect.objectContaining({ code: "COMP1130", term: 0 }));

    const page = await fetch(new URL(`/plan/${id}`, baseUrl));
    const html = await page.text();
    expect(html).toMatch(/data-term="0"[\s\S]*?data-placed="COMP1130"/);
  });

  it("moving re-places, not duplicates", async () => {
    const id = await createPlan();
    await postJson(`/api/plans/${id}/placements`, { code: "COMP1130", term: 0 });
    const res = await postJson(`/api/plans/${id}/placements`, { code: "COMP1130", term: 2 });
    const view = await res.json();
    const placements = view.placements.filter((p: { code: string }) => p.code === "COMP1130");
    expect(placements).toHaveLength(1);
    expect(placements[0].term).toBe(2);
  });

  it("DELETE /api/plans/<id>/placements/COMP1130 removes it", async () => {
    const id = await createPlan();
    await postJson(`/api/plans/${id}/placements`, { code: "COMP1130", term: 0 });
    const res = await del(`/api/plans/${id}/placements/COMP1130`);
    expect(res.status).toBe(200);
    const view = await res.json();
    expect(view.placements).not.toContainEqual(expect.objectContaining({ code: "COMP1130" }));
  });

  it("unknown course returns 400", async () => {
    const id = await createPlan();
    const res = await postJson(`/api/plans/${id}/placements`, { code: "ZZZZ9999", term: 0 });
    expect(res.status).toBe(400);
  });

  it("term 8 returns 400", async () => {
    const id = await createPlan();
    const res = await postJson(`/api/plans/${id}/placements`, { code: "COMP1130", term: 8 });
    expect(res.status).toBe(400);
  });

  it("placing COMP3630 in term 0 returns 409 (hard-blocked by the 24-unit clause)", async () => {
    const id = await createPlan();
    const res = await postJson(`/api/plans/${id}/placements`, { code: "COMP3630", term: 0 });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain("24 units");
  });

  it("unknown plan returns 404 for both the page and the API", async () => {
    const pageRes = await fetch(new URL("/plan/does-not-exist", baseUrl));
    expect(pageRes.status).toBe(404);

    const apiRes = await postJson("/api/plans/does-not-exist/placements", { code: "COMP1130", term: 0 });
    expect(apiRes.status).toBe(404);
  });

  it("the example plan is read-only", async () => {
    const res = await postJson("/api/plans/example/placements", { code: "COMP1130", term: 3 });
    expect(res.status).toBe(403);
  });

  it("/plan/example renders COMP1130 and the read-only banner", async () => {
    const res = await fetch(new URL("/plan/example", baseUrl));
    const html = await res.text();
    expect(html).toContain("data-placed=\"COMP1130\"");
    expect(html).toContain("This is an example");
  });

  it("index links to the example plan and has the start form", async () => {
    const res = await fetch(baseUrl);
    const html = await res.text();
    expect(html).toContain('href="/plan/example"');
    expect(html).toContain('action="/api/plans"');
  });

  it("PUT cutoff persists (reload shows data-cutoff=\"3\")", async () => {
    const id = await createPlan();
    const res = await putJson(`/api/plans/${id}/cutoff`, { cutoff: 3 });
    expect(res.status).toBe(200);

    const page = await fetch(new URL(`/plan/${id}`, baseUrl));
    const html = await page.text();
    expect(html).toContain('data-cutoff="3"');
  });

  it("a course straddling the cutoff counts its first semester as completed", async () => {
    const id = await createPlan();
    expect((await postJson(`/api/plans/${id}/placements`, { code: "COMP4550", term: 4 })).status).toBe(200);
    expect((await postJson(`/api/plans/${id}/placements`, { code: "COMP4620", term: 7 })).status).toBe(200);
    const res = await putJson(`/api/plans/${id}/cutoff`, { cutoff: 5 });
    const view = await res.json();
    expect(view.total).toEqual({ required: 192, completed: 12, planned: 18 });
  });

  it("cutoff 9 returns 400", async () => {
    const id = await createPlan();
    const res = await putJson(`/api/plans/${id}/cutoff`, { cutoff: 9 });
    expect(res.status).toBe(400);
  });

  it("PUT choices persists and re-allocates", async () => {
    const id = await createPlan();
    await postJson(`/api/plans/${id}/placements`, { code: "COMP2620", term: 2 });

    const arin = await putJson(`/api/plans/${id}/choices`, { groupId: "spec", childId: "arin" });
    const arinView = await arin.json();
    expect(arinView.placements.find((p: { code: string }) => p.code === "COMP2620").countsToward).toBe("arin-a");

    const thcs = await putJson(`/api/plans/${id}/choices`, { groupId: "spec", childId: "thcs" });
    const thcsView = await thcs.json();
    expect(thcsView.placements.find((p: { code: string }) => p.code === "COMP2620").countsToward).toBe("thcs-a");
  });

  it("PUT pin to an ineligible group returns 409", async () => {
    const id = await createPlan();
    await postJson(`/api/plans/${id}/placements`, { code: "MATH1013", term: 2 });
    const res = await putJson(`/api/plans/${id}/pins`, { code: "MATH1013", groupId: "math-disc" });
    expect(res.status).toBe(409);
  });

  it("PUT pin into a capstone option that isn't chosen returns 409", async () => {
    const id = await createPlan();
    await postJson(`/api/plans/${id}/placements`, { code: "COMP4500", term: 6 });
    const res = await putJson(`/api/plans/${id}/pins`, { code: "COMP4500", groupId: "cap-team-proj" });
    expect(res.status).toBe(409);
  });

  it("switching capstone clears a pin into the old option instead of breaking the plan", async () => {
    const id = await createPlan();
    await putJson(`/api/plans/${id}/choices`, { groupId: "capstone", childId: "cap-team" });
    await postJson(`/api/plans/${id}/placements`, { code: "COMP4500", term: 6 });
    expect((await putJson(`/api/plans/${id}/pins`, { code: "COMP4500", groupId: "cap-team-proj" })).status).toBe(200);

    const switched = await putJson(`/api/plans/${id}/choices`, { groupId: "capstone", childId: "cap-research" });
    expect(switched.status).toBe(200);
    const placement = (await switched.json()).placements.find((p: { code: string }) => p.code === "COMP4500");
    expect(placement.pinned).toBe(false);
    expect((await fetch(new URL(`/plan/${id}`, baseUrl))).status).toBe(200);

    // Switching back doesn't silently revive the old pin.
    const back = await putJson(`/api/plans/${id}/choices`, { groupId: "capstone", childId: "cap-team" });
    expect((await back.json()).placements.find((p: { code: string }) => p.code === "COMP4500").pinned).toBe(false);
  });

  it("PUT checks stores an answer (200)", async () => {
    const id = await createPlan();
    await postJson(`/api/plans/${id}/placements`, { code: "MATH1116", term: 1 });
    const res = await putJson(`/api/plans/${id}/checks`, {
      code: "MATH1116",
      item: "with a mark of 60 or above",
      answer: "met",
    });
    expect(res.status).toBe(200);
  });

  it("PUT checks on the read-only example returns 403", async () => {
    const res = await putJson("/api/plans/example/checks", {
      code: "COMP4550",
      item: "find a project/supervisor",
      answer: "met",
    });
    expect(res.status).toBe(403);
  });

  it("PUT checks for an unplaced course returns 400", async () => {
    const id = await createPlan();
    const res = await putJson(`/api/plans/${id}/checks`, {
      code: "MATH1116",
      item: "with a mark of 60 or above",
      answer: "met",
    });
    expect(res.status).toBe(400);
  });

  it("PUT checks with an item the course doesn't have returns 400", async () => {
    const id = await createPlan();
    await postJson(`/api/plans/${id}/placements`, { code: "MATH1116", term: 1 });
    const res = await putJson(`/api/plans/${id}/checks`, { code: "MATH1116", item: "find a project/supervisor", answer: "met" });
    expect(res.status).toBe(400);
  });

  it("PUT checks with a bad answer returns 400", async () => {
    const id = await createPlan();
    await postJson(`/api/plans/${id}/placements`, { code: "MATH1116", term: 1 });
    const res = await putJson(`/api/plans/${id}/checks`, {
      code: "MATH1116",
      item: "with a mark of 60 or above",
      answer: "yes",
    });
    expect(res.status).toBe(400);
  });

  it("/plan/example renders a two-segment progress bar per group with aria-valuenow and text", async () => {
    const res = await fetch(new URL("/plan/example", baseUrl));
    const html = await res.text();
    expect(html).toMatch(/role="progressbar"[^>]*aria-valuenow="\d+"/);
    expect(html).toMatch(/\d+ completed, \d+ planned of \d+/);
  });

  it("the Move to list for a placed COMP3630 omits both S1 2027 (can't be placed there) and S1 2028 (already there)", async () => {
    const id = await createPlan();
    await postJson(`/api/plans/${id}/placements`, { code: "COMP3630", term: 2 });

    const page = await fetch(new URL(`/plan/${id}`, baseUrl));
    const html = await page.text();
    const menuMatch = html.match(/<ul class="card-menu-terms" aria-label="Move COMP3630 to">[\s\S]*?<\/ul>/);
    expect(menuMatch).not.toBeNull();
    const menuHtml = menuMatch![0];
    expect(menuHtml).not.toContain("S1 2027");
    expect(menuHtml).not.toContain("S1 2028");
    expect(menuHtml).toContain("S1 2029");
  });

  it("soft-blocked cards expose their state as text", async () => {
    const id = await createPlan();
    await postJson(`/api/plans/${id}/placements`, { code: "COMP2100", term: 3 });

    const page = await fetch(new URL(`/plan/${id}`, baseUrl));
    const html = await page.text();
    expect(html).toMatch(/data-placed="COMP2100"[\s\S]*?Needs prerequisites/);
  });

  it("a new plan lists a leaf group's unplaced courses as draggable available cards", async () => {
    const id = await createPlan();
    const page = await fetch(new URL(`/plan/${id}`, baseUrl));
    const html = await page.text();
    expect(html).toMatch(/class="course-card course-card-unplaced" draggable="true"[\s\S]{0,40}COMP1100/);

    expect(html).toMatch(/class="course-card-code">COMP1100</);
    expect(html).toContain(">6u<");

    await postJson(`/api/plans/${id}/placements`, { code: "COMP1100", term: 0 });
    const afterPlacing = await fetch(new URL(`/plan/${id}`, baseUrl));
    const htmlAfter = await afterPlacing.text();
    expect(htmlAfter).not.toMatch(/course-card-unplaced[\s\S]{0,40}COMP1100/);
  });

  it("a placed course stays in its group's list as a compact row, and is no longer draggable", async () => {
    const id = await createPlan();
    await postJson(`/api/plans/${id}/placements`, { code: "COMP1100", term: 0 });
    const page = await fetch(new URL(`/plan/${id}`, baseUrl));
    const html = await page.text();
    expect(html).toMatch(/<li class="placed-row"[^>]*>[\s\S]{0,80}COMP1100/);
    expect(html).toMatch(/COMP1100[\s\S]{0,600}Planned[\s\S]{0,60}class="course-card-term-link"[^>]*>S1 2027</);
    expect(html).not.toMatch(/draggable="true"[^>]*>[\s\S]{0,200}course-card-code">COMP1100</);
  });

  it("the empty plan shows the hint", async () => {
    const id = await createPlan();
    const page = await fetch(new URL(`/plan/${id}`, baseUrl));
    const html = await page.text();
    expect(html).toContain("Drag a course onto a semester, or use Place in…");
  });

  it("the completed semesters have a menu", async () => {
    const id = await createPlan();
    const page = await fetch(new URL(`/plan/${id}`, baseUrl));
    const html = await page.text();
    const toggle = html.match(/<button[^>]*class="completed-toggle"[^>]*>[\s\S]*?<\/button>/);
    expect(toggle).not.toBeNull();
    expect(toggle![0]).toContain('aria-expanded="false"');
    expect(toggle![0]).toMatch(/aria-controls="[^"]+"/);
    expect(toggle![0]).toMatch(/<span data-current[^>]*>Nothing completed yet<\/span>/);
    expect(html).toMatch(/<button[^>]*>(?:<[^>]+>[^<]*<\/[^>]+>)?Nothing yet<\/button>/);
    expect(html).toMatch(/<button[^>]*>All semesters<\/button>/);
    expect(html).not.toContain("One more semester completed");

    const example = await (await fetch(new URL("/plan/example", baseUrl))).text();
    expect(example).not.toContain("completed-toggle");
    expect(example).toContain("Completed through S2 2027");
  });

  it("program checks render with the two-segment bar, and the untracked TDP check shows as not tracked", async () => {
    const res = await fetch(new URL("/plan/example", baseUrl));
    const html = await res.text();
    const checksMatch = html.match(/<section aria-label="program checks">[\s\S]*?<\/section>/);
    expect(checksMatch).not.toBeNull();
    const checksHtml = checksMatch![0];
    expect(checksHtml).toMatch(/role="progressbar"/);
    expect(checksHtml).toContain("not tracked — verify on P&amp;C");
  });

  it("the example page renders the verify badge on COMP4550", async () => {
    const res = await fetch(new URL("/plan/example", baseUrl));
    const html = await res.text();
    expect(html).toMatch(/data-placed="COMP4550"[\s\S]*?Verify on P&amp;C/);
  });

  it("the 'No published offering' badge appears on a placed COMP4600 in a new plan", async () => {
    const id = await createPlan();
    await postJson(`/api/plans/${id}/placements`, { code: "COMP4600", term: 2 });
    const page = await fetch(new URL(`/plan/${id}`, baseUrl));
    const html = await page.text();
    expect(html).toMatch(/data-placed="COMP4600"[\s\S]*?No published offering/);
  });

  it("each placed card's title opens Details", async () => {
    const res = await fetch(new URL("/plan/example", baseUrl));
    const html = await res.text();
    expect(html).toMatch(/data-placed="COMP1130"[\s\S]{0,600}class="course-card-title"/);
  });

  it("the plan page renders no dialogs", async () => {
    const res = await fetch(new URL("/plan/example", baseUrl));
    const html = await res.text();
    expect(html).not.toContain("<dialog");
  });

  it("?course= renders the details sidebar", async () => {
    const res = await fetch(new URL("/plan/example?course=COMP4550", baseUrl));
    const html = await res.text();
    const aside = html.match(/<aside[^>]*aria-label="Course details"[\s\S]*?<\/aside>/);
    expect(aside).not.toBeNull();
    expect(aside![0]).toContain("Computing Research Project");
    expect(aside![0]).toContain("https://programsandcourses.anu.edu.au/2027/course/COMP4550");
    expect(aside![0]).toContain("Learning outcomes");
  });

  it("all mutations on the example plan return 403", async () => {
    const cutoffRes = await putJson("/api/plans/example/cutoff", { cutoff: 1 });
    expect(cutoffRes.status).toBe(403);

    const choiceRes = await putJson("/api/plans/example/choices", { groupId: "spec", childId: "hccc" });
    expect(choiceRes.status).toBe(403);

    const pinRes = await putJson("/api/plans/example/pins", { code: "COMP1130", groupId: null });
    expect(pinRes.status).toBe(403);
  });

  it("search COMP21 returns COMP2100 with status found", async () => {
    const res = await fetch(new URL("/api/courses/search?q=COMP21", baseUrl));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; courses: { code: string }[] };
    expect(body.status).toBe("found");
    expect(body.courses.some((c) => c.code === "COMP2100")).toBe(true);
  });

  it('search "software" matches titles', async () => {
    const res = await fetch(new URL("/api/courses/search?q=software", baseUrl));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; courses: { code: string; title: string }[] };
    expect(body.status).toBe("found");
    expect(body.courses.length).toBeGreaterThan(0);
    for (const course of body.courses) {
      expect(course.title.toLowerCase()).toContain("software");
    }
  });
});

describe("course details endpoint", () => {
  type Details = {
    course: { code: string };
    scrapedAt: string;
    extras: { learningOutcomes: string[]; cotaught: string[]; classes: { classNumber: string | null }[] } | null;
  };

  function expectComp2100(body: Details): void {
    expect(body.course.code).toBe("COMP2100");
    expect(body.extras?.learningOutcomes).toHaveLength(6);
    expect(body.extras?.classes[0].classNumber).toBe("5103");
    expect(body.extras?.cotaught).toContain("COMP6442");
    expect(typeof body.scrapedAt).toBe("string");
    expect(body.scrapedAt.length).toBeGreaterThan(0);
  }

  it("GET /api/courses/COMP2100 returns its card, scrape time and extras", async () => {
    const res = await fetch(new URL("/api/courses/COMP2100", baseUrl));
    expect(res.status).toBe(200);
    expectComp2100((await res.json()) as Details);
  });

  it("accepts ?plan= with the same shape", async () => {
    const res = await fetch(new URL("/api/courses/COMP2100?plan=example", baseUrl));
    expect(res.status).toBe(200);
    expectComp2100((await res.json()) as Details);
  });

  it("rejects a malformed code with 400", async () => {
    const res = await fetch(new URL("/api/courses/comp2100x", baseUrl));
    expect(res.status).toBe(400);
    expect(typeof ((await res.json()) as { error: string }).error).toBe("string");
  });

  // Details never live-fetches (overview §4.3): an unknown code is a fast
  // 404, and the route doesn't even import the P&C fetcher.
  it("answers an unknown code with a fast 404 and no P&C fetch", async () => {
    const start = performance.now();
    const res = await fetch(new URL("/api/courses/ZZZZ9999", baseUrl));
    expect(performance.now() - start).toBeLessThan(1000);
    expect(res.status).toBe(404);
    expect(typeof ((await res.json()) as { error: string }).error).toBe("string");
    expect(readFileSync("src/pages/api/courses/[code].ts", "utf8")).not.toContain("fetchCourseFromPandc");
  });
});
