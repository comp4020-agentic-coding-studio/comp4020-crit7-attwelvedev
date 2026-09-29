import { describe, expect, it } from "vitest";
import type { HistoryStep } from "./plan-actions";
import { EMPTY_HISTORY, HISTORY_LIMIT, recordStep, redoStep, undoStep } from "./undo-history";

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
