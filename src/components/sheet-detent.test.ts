import { describe, expect, it } from "vitest";
import { detentHeights, nearestDetent, nextDetent, PEEK_PX } from "./sheet-detent";

describe("nextDetent", () => {
  it("cycles peek → half → full → peek", () => {
    expect(nextDetent("peek")).toBe("half");
    expect(nextDetent("half")).toBe("full");
    expect(nextDetent("full")).toBe("peek");
  });
});

describe("detentHeights", () => {
  it("is the header's peek, 56% of the viewport, and all but 8px above and below", () => {
    expect(detentHeights(844)).toEqual({ peek: PEEK_PX, half: 0.56 * 844, full: 828 });
  });
});

describe("nearestDetent", () => {
  const vp = 844;

  it.each([
    [160, "peek"],
    [0.5 * vp, "half"],
    [0.9 * vp, "full"],
  ] as const)("settles %d px at %s", (height, detent) => {
    expect(nearestDetent(height, vp)).toBe(detent);
  });

  it("settles past either end at that end", () => {
    expect(nearestDetent(0, vp)).toBe("peek");
    expect(nearestDetent(vp * 2, vp)).toBe("full");
  });
});
