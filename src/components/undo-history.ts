import type { HistoryStep } from "./plan-actions";

// Enough to walk back a working session; older steps drop off the far end.
export const HISTORY_LIMIT = 50;

// One linear history for the page visit, newest step last on each side.
// Held in memory only: a reload, or leaving the plan, starts it afresh.
export interface History {
  past: HistoryStep[];
  future: HistoryStep[];
}

export const EMPTY_HISTORY: History = { past: [], future: [] };

// A new edit starts a new branch, so nothing undone can be redone past it.
export function recordStep(history: History, step: HistoryStep): History {
  return { past: [...history.past, step].slice(-HISTORY_LIMIT), future: [] };
}

export function undoStep(history: History): History {
  const step = history.past.at(-1);
  if (!step) return history;
  return { past: history.past.slice(0, -1), future: [...history.future, step] };
}

export function redoStep(history: History): History {
  const step = history.future.at(-1);
  if (!step) return history;
  return { past: [...history.past, step], future: history.future.slice(0, -1) };
}
