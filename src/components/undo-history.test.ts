import { describe, expect, it } from "vitest";
import type { HistoryStep } from "./plan-actions";
import {
  EMPTY_HISTORY,
  HISTORY_LIMIT,
  historyShortcut,
  isTextEntry,
  recordStep,
  redoStep,
  undoStep,
} from "./undo-history";

function step(n: number): HistoryStep {
  return {
    message: `Step ${n}`,
    redo: { kind: "cutoff", cutoff: n },
    undo: [{ kind: "cutoff", cutoff: n - 1 }],
  };
}

describe("undo history", () => {
  const a = step(1);
  const b = step(2);

  it("records a step on the undo side", () => {
    expect(recordStep(EMPTY_HISTORY, a)).toEqual({ past: [a], future: [] });
  });

  it("moves a step to the redo side on undo, and back on redo", () => {
    const undone = undoStep(recordStep(EMPTY_HISTORY, a));
    expect(undone).toEqual({ past: [], future: [a] });
    expect(redoStep(undone)).toEqual({ past: [a], future: [] });
  });

  it("undoes and redoes newest first", () => {
    const both = recordStep(recordStep(EMPTY_HISTORY, a), b);
    const once = undoStep(both);
    expect(once).toEqual({ past: [a], future: [b] });
    expect(undoStep(once)).toEqual({ past: [], future: [b, a] });
    expect(redoStep(undoStep(once))).toEqual({ past: [a], future: [b] });
  });

  it("clears the redo side on a new step", () => {
    const undone = undoStep(recordStep(EMPTY_HISTORY, a));
    expect(recordStep(undone, b)).toEqual({ past: [b], future: [] });
  });

  it("leaves the history alone when there's nothing to undo or redo", () => {
    expect(undoStep(EMPTY_HISTORY)).toBe(EMPTY_HISTORY);
    expect(redoStep(EMPTY_HISTORY)).toBe(EMPTY_HISTORY);
    const recorded = recordStep(EMPTY_HISTORY, a);
    expect(redoStep(recorded)).toBe(recorded);
  });

  it(`keeps the latest ${HISTORY_LIMIT} steps`, () => {
    expect(HISTORY_LIMIT).toBe(50);
    let history = EMPTY_HISTORY;
    for (let n = 1; n <= 51; n++) history = recordStep(history, step(n));
    expect(history.past).toHaveLength(50);
    expect(history.past[0]).toEqual(step(2));
    expect(history.past.at(-1)).toEqual(step(51));
  });
});

describe("historyShortcut", () => {
  const keys = (key: string, mods: Partial<Record<"metaKey" | "ctrlKey" | "shiftKey" | "altKey", boolean>> = {}) => ({
    key,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...mods,
  });

  it("uses Cmd on a Mac", () => {
    expect(historyShortcut(keys("z", { metaKey: true }), true)).toBe("undo");
    expect(historyShortcut(keys("Z", { metaKey: true, shiftKey: true }), true)).toBe("redo");
    expect(historyShortcut(keys("z", { metaKey: true, shiftKey: true }), true)).toBe("redo");
    expect(historyShortcut(keys("z", { ctrlKey: true }), true)).toBeNull();
    expect(historyShortcut(keys("y", { metaKey: true }), true)).toBeNull();
  });

  it("uses Ctrl elsewhere, with Ctrl+Y for redo too", () => {
    expect(historyShortcut(keys("z", { ctrlKey: true }), false)).toBe("undo");
    expect(historyShortcut(keys("Z", { ctrlKey: true, shiftKey: true }), false)).toBe("redo");
    expect(historyShortcut(keys("y", { ctrlKey: true }), false)).toBe("redo");
    expect(historyShortcut(keys("z", { metaKey: true }), false)).toBeNull();
  });

  it("ignores Alt combinations and a plain key", () => {
    expect(historyShortcut(keys("z", { metaKey: true, altKey: true }), true)).toBeNull();
    expect(historyShortcut(keys("z", { ctrlKey: true, altKey: true }), false)).toBeNull();
    expect(historyShortcut(keys("y", { ctrlKey: true, altKey: true }), false)).toBeNull();
    expect(historyShortcut(keys("z"), true)).toBeNull();
    expect(historyShortcut(keys("z"), false)).toBeNull();
  });
});

describe("isTextEntry", () => {
  it("is true where typing happens", () => {
    expect(isTextEntry({ tagName: "INPUT", type: "text" })).toBe(true);
    expect(isTextEntry({ tagName: "INPUT", type: "search" })).toBe(true);
    expect(isTextEntry({ tagName: "INPUT" })).toBe(true);
    expect(isTextEntry({ tagName: "TEXTAREA" })).toBe(true);
    expect(isTextEntry({ tagName: "SELECT" })).toBe(true);
    expect(isTextEntry({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });

  it("is false for controls with no text to undo", () => {
    expect(isTextEntry({ tagName: "INPUT", type: "radio" })).toBe(false);
    expect(isTextEntry({ tagName: "INPUT", type: "checkbox" })).toBe(false);
    expect(isTextEntry({ tagName: "INPUT", type: "button" })).toBe(false);
    expect(isTextEntry({ tagName: "BUTTON" })).toBe(false);
    expect(isTextEntry({ tagName: "DIV" })).toBe(false);
    expect(isTextEntry(null)).toBe(false);
  });
});
