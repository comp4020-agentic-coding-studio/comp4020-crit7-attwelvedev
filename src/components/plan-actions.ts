import type { PlanView } from "../lib/domain/view";

// Every change to which courses sit where, from any entry point (a drag, a
// card menu, a suggestion, Place in…, the details sidebar). Planner's
// runAction is the one place these reach the API.
export type PlanAction =
  | { kind: "place"; code: string; term: number }
  | { kind: "move"; code: string; term: number }
  | { kind: "remove"; code: string };

// What the undo toast says, and what its Undo does. Re-placing a removed
// course lands it unpinned (placeCourse's insert always does), so a pin it
// had is restored by a separate setPin call.
export interface UndoEntry {
  message: string;
  undo: PlanAction;
  restorePin: string | null;
}

// The other placed courses a change left missing a prerequisite: fine (or
// only asking for a check) before, "Needs prerequisites" after. One already
// missing one, or blocked, isn't news; the course acted on has its own card.
export function newlyBroken(before: PlanView, after: PlanView, actedOn: string): string[] {
  const was = new Map(before.placements.map((p) => [p.code, p.state]));
  return after.placements
    .filter((p) => p.code !== actedOn && p.state === "soft")
    .filter((p) => was.get(p.code) === "available" || was.get(p.code) === "check")
    .map((p) => p.code);
}

// Appended to the toast's own sentence, so it starts with a space.
export function knockOnText(codes: string[]): string {
  if (codes.length === 0) return "";
  if (codes.length === 1) return ` ${codes[0]} now misses a prerequisite.`;
  return ` ${codes.length} courses now miss a prerequisite, including ${codes[0]}.`;
}

// Putting a course in a term is a move if it's already placed.
export function actionFor(view: PlanView, code: string, term: number): PlanAction {
  const placed = view.placements.some((p) => p.code === code);
  return { kind: placed ? "move" : "place", code, term };
}

// Built from the view before the change, which still knows where the course
// was and whether it was pinned. A move keeps its pin (upsertPlacement only
// updates the term), so undoing one is just a move back.
export function undoEntry(view: PlanView, action: PlanAction): UndoEntry {
  const placement = view.placements.find((p) => p.code === action.code) ?? null;
  const termLabel = (term: number) => view.terms[term]?.label ?? `term ${term + 1}`;
  if (action.kind === "remove") {
    const course = view.courses[action.code];
    return {
      message: `Removed ${course ? `${action.code} — ${course.title}` : action.code}`,
      undo: { kind: "place", code: action.code, term: placement?.term ?? 0 },
      restorePin: placement?.pinned ? (placement.countsToward ?? null) : null,
    };
  }
  if (action.kind === "move" && placement) {
    return {
      message: `Moved ${action.code} to ${termLabel(action.term)}`,
      undo: { kind: "move", code: action.code, term: placement.term },
      restorePin: null,
    };
  }
  return {
    message: `Placed ${action.code} in ${termLabel(action.term)}`,
    undo: { kind: "remove", code: action.code },
    restorePin: null,
  };
}
