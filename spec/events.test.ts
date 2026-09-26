import { describe, expect, inject, it } from "vitest";

// The guestbook is gone; only the heartbeat SSE stream (kept as a CI probe)
// and its removal of the messages plumbing are checked here.
const baseUrl = inject("baseUrl");

describe("events", () => {
  it("GET /api/events streams an opening comment", async () => {
    const res = await fetch(new URL("/api/events", baseUrl));
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body?.getReader();
    if (!reader) throw new Error("no response body");
    const { value } = await reader.read();
    await reader.cancel();
    expect(new TextDecoder().decode(value)).toContain(": connected");
  });

  it("/api/messages is gone", async () => {
    const res = await fetch(new URL("/api/messages", baseUrl), {
      method: "POST",
      headers: { origin: baseUrl },
      body: new URLSearchParams({ body: "x" }),
      redirect: "manual",
    });
    expect(res.status).toBe(404);
  });
});
