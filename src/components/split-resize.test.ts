import { describe, expect, it } from "vitest";
import { nearestIndex, panelsFor, snapSplit, type SplitSize, splitLabel, splitSizeOf, stepSplit } from "./split-resize";

describe("nearestIndex", () => {
  it.each([
    [10.2, [3, 17.5], 0],
    [10.25, [3, 17.5], 1],
    [37.9, [3, 17.5, 31.1, 44.7], 3],
    [-5, [1, 2], 0],
    [99, [1, 2], 1],
  ])("puts %d nearest %j at index %i", (value, positions, index) => {
    expect(nearestIndex(value, positions)).toBe(index);
  });
});

describe("snapSplit", () => {
  it.each([
    [-10, 30],
    [39.9, 30],
    [40, 50],
    [59.9, 50],
    [60, 70],
    [84.9, 70],
    [85, 100],
    [150, 100],
  ])("snaps a %d%% share to %i", (share, size) => {
    expect(snapSplit(share)).toBe(size);
  });
});

describe("stepSplit", () => {
  it.each([
    [50, "ArrowDown", 70],
    [70, "ArrowDown", 100],
    [100, "ArrowDown", 100],
    [100, "ArrowUp", 70],
    [30, "ArrowUp", 30],
    [70, "Home", 30],
    [30, "End", 100],
    [50, "ArrowLeft", null],
    [50, "ArrowRight", null],
    [50, "Enter", null],
  ] as const)("from %i, %s gives %j", (size, key, next) => {
    expect(stepSplit(size, key)).toBe(next);
  });
});

describe("splitLabel", () => {
  it.each([
    [30, "Timeline 30%"],
    [50, "Timeline 50%"],
    [70, "Timeline 70%"],
    [100, "Requirements hidden"],
  ] as const)("labels %i as %j", (size: SplitSize, label) => {
    expect(splitLabel(size)).toBe(label);
  });
});

describe("splitSizeOf", () => {
  it("is 100 when collapsed, whatever the split", () => {
    expect(splitSizeOf({ reqs: { collapsed: true }, split: 30 })).toBe(100);
  });

  it("is the split when expanded", () => {
    expect(splitSizeOf({ reqs: { collapsed: false }, split: 70 })).toBe(70);
  });
});

describe("panelsFor", () => {
  it("collapses while keeping the split", () => {
    expect(panelsFor(100, { reqs: { collapsed: false }, split: 30 })).toEqual({
      reqs: { collapsed: true },
      split: 30,
    });
  });

  it("expands to the given split", () => {
    expect(panelsFor(50, { reqs: { collapsed: true }, split: 30 })).toEqual({
      reqs: { collapsed: false },
      split: 50,
    });
  });
});
