import type { CheckAnswer } from "../lib/domain/types";
import type { PlanView } from "../lib/domain/view";
import { completedReadout, groupLabel, groupPath } from "./planner-logic";

// Every change to a plan, from any entry point (a drag, a card menu, a
// suggestion, Place in…, the details sidebar, a choice, the Completed
// menu). Planner's runAction is the one place these reach the API.
export type PlanAction =
  | { kind: "place"; code: string; term: number }
  | { kind: "move"; code: string; term: number }
  | { kind: "remove"; code: string }
  | { kind: "pin"; code: string; groupId: string | null }
  | { kind: "check"; code: string; item: string; answer: CheckAnswer | null }
  | { kind: "choice"; groupId: string; childId: string | null }
  | { kind: "cutoff"; cutoff: number };

// One undoable change: what the toast says, the change itself, and the
// changes that reverse it, applied in order. A list, because re-placing a
// removed course lands it unpinned (placeCourse's insert always does), so a
// pin it had comes back as a second change.
export interface HistoryStep {
  message: string;
  redo: PlanAction;
  undo: PlanAction[];
}

// The course a change was made to, which has its own card (and so needs no
// knock-on warning); a choice or the cutoff changes the whole plan.
export function actedOn(action: PlanAction): string | null {
  return action.kind === "choice" || action.kind === "cutoff" ? null : action.code;
}

// The other placed courses a change left missing a prerequisite: fine (or
// only asking for a check) before, "Needs prerequisites" after. One already
// missing one, or blocked, isn't news; the course acted on has its own card.
export function newlyBroken(before: PlanView, after: PlanView, actedOn: string | null): string[] {
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

// What the plan has now for the value a single-value change sets.
function currentPin(view: PlanView, code: string): string | null {
  const placement = view.placements.find((p) => p.code === code);
  return placement?.pinned ? (placement.countsToward ?? null) : null;
}

function currentAnswer(view: PlanView, code: string, item: string): CheckAnswer | null {
  const placement = view.placements.find((p) => p.code === code);
  return placement?.checks.find((c) => c.item === item)?.answer ?? null;
}

function currentChoice(view: PlanView, groupId: string): string | null {
  return groupPath(view, groupId).at(-1)?.chosenId ?? null;
}

// Dropping a course back on its own term, or choosing the pin, answer,
// option or cutoff already set (from any entry point): nothing to send, and
// nothing to undo.
export function changesNothing(view: PlanView, action: PlanAction): boolean {
  switch (action.kind) {
    case "move":
      return view.placements.some((p) => p.code === action.code && p.term === action.term);
    case "pin":
      return currentPin(view, action.code) === action.groupId;
    case "check":
      return currentAnswer(view, action.code, action.item) === action.answer;
    case "choice":
      return currentChoice(view, action.groupId) === action.childId;
    case "cutoff":
      return view.plan.cutoff === action.cutoff;
    default:
      return false;
  }
}

// Putting a course in a term is a move if it's already placed.
export function actionFor(view: PlanView, code: string, term: number): PlanAction {
  const placed = view.placements.some((p) => p.code === code);
  return { kind: placed ? "move" : "place", code, term };
}

const ANSWER_LABELS: Record<CheckAnswer | "null", string> = { met: "Met", "not-met": "Not met", null: "Not sure" };

// Built from the view before the change, which still knows where the course
// was, whether it was pinned, and every value a change replaces. A move
// keeps its pin (upsertPlacement only updates the term), so undoing one is
// just a move back.
export function historyStep(view: PlanView, action: PlanAction): HistoryStep {
  const termLabel = (term: number) => view.terms[term]?.label ?? `term ${term + 1}`;
  const step = (message: string, undo: PlanAction[]): HistoryStep => ({ message, redo: action, undo });
  switch (action.kind) {
    case "remove": {
      const placement = view.placements.find((p) => p.code === action.code) ?? null;
      const course = view.courses[action.code];
      const pin = currentPin(view, action.code);
      return step(`Removed ${course ? `${action.code} — ${course.title}` : action.code}`, [
        { kind: "place", code: action.code, term: placement?.term ?? 0 },
        ...(pin ? [{ kind: "pin", code: action.code, groupId: pin } as const] : []),
      ]);
    }
    case "move": {
      const placement = view.placements.find((p) => p.code === action.code);
      if (placement) {
        return step(`Moved ${action.code} to ${termLabel(action.term)}`, [
          { kind: "move", code: action.code, term: placement.term },
        ]);
      }
      return step(`Placed ${action.code} in ${termLabel(action.term)}`, [{ kind: "remove", code: action.code }]);
    }
    case "place":
      return step(`Placed ${action.code} in ${termLabel(action.term)}`, [{ kind: "remove", code: action.code }]);
    case "pin":
      return step(
        action.groupId
          ? `${action.code} now counts toward ${groupLabel(view, action.groupId)}`
          : `${action.code} now counts automatically`,
        [{ kind: "pin", code: action.code, groupId: currentPin(view, action.code) }],
      );
    case "check": {
      const placement = view.placements.find((p) => p.code === action.code);
      const label = placement?.checks.find((c) => c.item === action.item)?.label ?? action.item;
      return step(`${action.code}: '${label}' marked ${ANSWER_LABELS[action.answer ?? "null"]}`, [
        { kind: "check", code: action.code, item: action.item, answer: currentAnswer(view, action.code, action.item) },
      ]);
    }
    case "choice": {
      const option = groupPath(view, action.groupId)
        .at(-1)
        ?.options.find((o) => o.id === action.childId);
      return step(`Chose ${option?.label ?? action.childId} for ${groupLabel(view, action.groupId)}`, [
        { kind: "choice", groupId: action.groupId, childId: currentChoice(view, action.groupId) },
      ]);
    }
    case "cutoff":
      return step(completedReadout(action.cutoff, view.terms).short, [
        { kind: "cutoff", cutoff: view.plan.cutoff },
      ]);
  }
}
