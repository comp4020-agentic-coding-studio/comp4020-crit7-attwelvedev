import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFit, REQS_WIDTH_REM, type ReqsSize, sizeLabel, sizeOf, snapSize, stateFor, stepSize } from "./reqs-resize";

describe("snapSize", () => {
  it.each([
    [-5, 0],
    [10.2, 0],
    [10.25, 1],
    [24.2, 1],
    [24.3, 2],
    [37.8, 2],
    [37.9, 3],
    [90, 3],
  ])("snaps %drem to size %i when 3 columns fit", (widthRem, size) => {
    expect(snapSize(widthRem, 3)).toBe(size);
  });

  it("never snaps past the columns that fit", () => {
    expect(snapSize(90, 2)).toBe(2);
    expect(snapSize(90, 1)).toBe(1);
  });
});

describe("stepSize", () => {
  it.each([
    [2, "ArrowLeft", 3, 1],
    [0, "ArrowLeft", 3, 0],
    [1, "ArrowRight", 3, 2],
    [2, "ArrowRight", 2, 2],
    [3, "ArrowDown", 3, 2],
    [0, "ArrowUp", 3, 1],
    [2, "Home", 3, 0],
    [0, "End", 2, 2],
    [1, "Enter", 3, null],
  ] as const)("from size %i, %s with %i fitting gives %j", (size, key, fit, next) => {
    expect(stepSize(size, key, fit)).toBe(next);
  });
});

describe("sizeOf", () => {
  it("is 0 when collapsed, whatever the preference", () => {
    expect(sizeOf({ collapsed: true, columns: 2 }, 3)).toBe(0);
  });

  it("caps the preference at the columns that fit", () => {
    expect(sizeOf({ collapsed: false, columns: 3 }, 2)).toBe(2);
    expect(sizeOf({ collapsed: false, columns: 1 }, 3)).toBe(1);
  });
});

describe("stateFor", () => {
  it("collapses while keeping the preferred columns", () => {
    expect(stateFor(0, { collapsed: false, columns: 2 })).toEqual({ collapsed: true, columns: 2 });
  });

  it("expands to the given column count", () => {
    expect(stateFor(3, { collapsed: true, columns: 1 })).toEqual({ collapsed: false, columns: 3 });
  });
});

describe("sizeLabel", () => {
  it.each([
    [0, "Collapsed"],
    [1, "1 column"],
    [2, "2 columns"],
    [3, "3 columns"],
  ] as const)("labels size %i as %j", (size: ReqsSize, label) => {
    expect(sizeLabel(size)).toBe(label);
  });
});

describe("parseFit", () => {
  it.each([
    [" 2 ", 2],
    ["0", 0],
    ["", 0],
    ["4", 0],
  ])("reads %j as %i", (raw, fit) => {
    expect(parseFit(raw)).toBe(fit);
  });
});

describe("REQS_WIDTH_REM", () => {
  // Snapping measures the pointer against these widths, so they must be the
  // ones the CSS actually lays the sidebar out at.
  it("matches the width tokens in styles.css", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).toContain(`--reqs-w-rail: ${REQS_WIDTH_REM[0]}rem;`);
    expect(css).toContain(`--reqs-w-1: ${REQS_WIDTH_REM[1]}rem;`);
    expect(css).toContain(`--reqs-w-2: ${REQS_WIDTH_REM[2]}rem;`);
    expect(css).toContain(`--reqs-w-3: ${REQS_WIDTH_REM[3]}rem;`);
  });
});
