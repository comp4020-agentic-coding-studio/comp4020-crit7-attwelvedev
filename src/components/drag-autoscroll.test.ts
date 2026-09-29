import { describe, expect, it } from "vitest";
import { EDGE_ZONE_PX, edgeStep, MAX_STEP_PX } from "./drag-autoscroll";

describe("edgeStep", () => {
  // A scroller spanning 100–900 on the axis.
  it("is still away from the edges", () => {
    expect(edgeStep(500, 100, 900)).toBe(0);
    expect(edgeStep(100 + EDGE_ZONE_PX, 100, 900)).toBe(0);
    expect(edgeStep(900 - EDGE_ZONE_PX, 100, 900)).toBe(0);
  });

  it("scrolls toward the edge the pointer is near, faster the closer it gets", () => {
    const near = edgeStep(900 - EDGE_ZONE_PX / 2, 100, 900);
    const nearer = edgeStep(899, 100, 900);
    expect(near).toBeGreaterThan(0);
    expect(nearer).toBeGreaterThan(near);
    expect(nearer).toBeLessThanOrEqual(MAX_STEP_PX);
    expect(edgeStep(101, 100, 900)).toBeLessThan(0);
    expect(edgeStep(101, 100, 900)).toBe(-edgeStep(899, 100, 900));
  });

  it("always moves at least a pixel inside the zone", () => {
    expect(edgeStep(900 - EDGE_ZONE_PX + 0.5, 100, 900)).toBe(1);
  });

  it("is still outside the scroller", () => {
    expect(edgeStep(50, 100, 900)).toBe(0);
    expect(edgeStep(950, 100, 900)).toBe(0);
  });

  it("shrinks the zones on a small scroller so they never meet", () => {
    expect(edgeStep(150, 100, 200)).toBe(0);
    expect(edgeStep(105, 100, 200)).toBeLessThan(0);
  });
});
