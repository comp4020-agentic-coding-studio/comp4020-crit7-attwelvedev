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

  it("/plan/example renders a two-segment progress bar per group with aria-valuenow and text", async () => {
    const res = await fetch(new URL("/plan/example", baseUrl));
    const html = await res.text();
    expect(html).toMatch(/role="progressbar"[^>]*aria-valuenow="\d+"/);
    expect(html).toMatch(/\d+ completed, \d+ planned of \d+/);
  });

  it("Place in… for COMP3630 omits S1 2027, the term it can't be placed in", async () => {
    const id = await createPlan();
    await postJson(`/api/plans/${id}/placements`, { code: "COMP3630", term: 2 });

    const page = await fetch(new URL(`/plan/${id}`, baseUrl));
    const html = await page.text();
    const menuMatch = html.match(/<ul hidden role="menu" aria-label="Place COMP3630 in">[\s\S]*?<\/ul>/);
    expect(menuMatch).not.toBeNull();
    const menuHtml = menuMatch![0];
    expect(menuHtml).not.toContain("S1 2027");
    expect(menuHtml).toContain("S1 2028");
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

    await postJson(`/api/plans/${id}/placements`, { code: "COMP1100", term: 0 });
    const afterPlacing = await fetch(new URL(`/plan/${id}`, baseUrl));
    const htmlAfter = await afterPlacing.text();
    expect(htmlAfter).not.toMatch(/course-card-unplaced[\s\S]{0,40}COMP1100/);
  });

  it("the empty plan shows the hint", async () => {
    const id = await createPlan();
    const page = await fetch(new URL(`/plan/${id}`, baseUrl));
    const html = await page.text();
    expect(html).toContain("Drag a course onto a semester, or use Place in…");
  });

  it("the cutoff has keyboard buttons", async () => {
    const id = await createPlan();
    const page = await fetch(new URL(`/plan/${id}`, baseUrl));
    const html = await page.text();
    expect(html).toContain("Move cutoff earlier");
    expect(html).toContain("Move cutoff later");
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
    expect(html).toMatch(/data-placed="COMP4550"[\s\S]{0,400}Verify on P&amp;C/);
  });

  it("the 'No published offering' badge appears on a placed COMP4600 in a new plan", async () => {
    const id = await createPlan();
    await postJson(`/api/plans/${id}/placements`, { code: "COMP4600", term: 2 });
    const page = await fetch(new URL(`/plan/${id}`, baseUrl));
    const html = await page.text();
    expect(html).toMatch(/data-placed="COMP4600"[\s\S]{0,400}No published offering/);
  });

  it("each placed card has a Details button", async () => {
    const res = await fetch(new URL("/plan/example", baseUrl));
    const html = await res.text();
    expect(html).toMatch(/data-placed="COMP1130"[\s\S]{0,600}>Details</);
  });

  it("the details dialog is closed in the server render", async () => {
    const res = await fetch(new URL("/plan/example", baseUrl));
    const html = await res.text();
    expect(html).toContain("<dialog");
    expect(html).not.toMatch(/<dialog[^>]*\bopen\b/);
  });

  it("the details for COMP4550 contain its P&C URL", async () => {
    const res = await fetch(new URL("/plan/example", baseUrl));
    const html = await res.text();
    const dialogMatch = html.match(/<dialog aria-label="COMP4550 details"[\s\S]*?<\/dialog>/);
    expect(dialogMatch).not.toBeNull();
    expect(dialogMatch![0]).toContain("https://programsandcourses.anu.edu.au/2027/course/COMP4550");
  });

  it("all mutations on the example plan return 403", async () => {
    const cutoffRes = await putJson("/api/plans/example/cutoff", { cutoff: 1 });
    expect(cutoffRes.status).toBe(403);

    const choiceRes = await putJson("/api/plans/example/choices", { groupId: "spec", childId: "hccc" });
    expect(choiceRes.status).toBe(403);

    const pinRes = await putJson("/api/plans/example/pins", { code: "COMP1130", groupId: null });
    expect(pinRes.status).toBe(403);
  });
});
