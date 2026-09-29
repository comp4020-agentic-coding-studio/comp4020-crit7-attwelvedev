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

export interface ShortcutKeys {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

// Each platform's own convention: Cmd+Z / Cmd+Shift+Z on a Mac; Ctrl+Z and
// Ctrl+Shift+Z or Ctrl+Y elsewhere. Alt combinations belong to other things.
export function historyShortcut(keys: ShortcutKeys, mac: boolean): "undo" | "redo" | null {
  const primary = mac ? keys.metaKey && !keys.ctrlKey : keys.ctrlKey && !keys.metaKey;
  if (!primary || keys.altKey) return null;
  const key = keys.key.toLowerCase();
  if (key === "z") return keys.shiftKey ? "redo" : "undo";
  if (key === "y" && !mac && !keys.shiftKey) return "redo";
  return null;
}

const NON_TEXT_INPUTS = new Set(["button", "checkbox", "color", "file", "image", "radio", "range", "reset", "submit"]);

// Where the browser's own undo belongs to what's being typed, so the plan's
// history stays out of the way.
export function isTextEntry(el: { tagName: string; type?: string; isContentEditable?: boolean } | null): boolean {
  if (!el) return false;
  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  return el.tagName === "INPUT" && !NON_TEXT_INPUTS.has((el.type ?? "text").toLowerCase());
}
