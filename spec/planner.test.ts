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
});
