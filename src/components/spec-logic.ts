import { SPEC_CHOICE_GROUP, type SpecialisationInfo } from "../data/specialisations";
import type { PlanView } from "../lib/domain/view";
import { groupLabel, groupPath, placedStatus } from "./planner-logic";

// The specialisation option the plan has chosen, as its group id, or null.
export function chosenSpecGroup(view: PlanView): string | null {
  return groupPath(view, SPEC_CHOICE_GROUP)[0]?.chosenId ?? null;
}

export type ProseSegment = string | { code: string };

const CODE_IN_PROSE = /\b[A-Z]{4}\d{4}\b/g;

// P&C prose with its course codes split out, so each can be a link. A code
// canOpen rejects stays part of the surrounding text.
export function linkCodes(text: string, canOpen: (code: string) => boolean): ProseSegment[] {
  const segments: ProseSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(CODE_IN_PROSE)) {
    if (!canOpen(match[0])) continue;
    if (match.index > last) segments.push(text.slice(last, match.index));
    segments.push({ code: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push(text.slice(last));
  return segments;
}

// A spec list's course line: where the course sits in the plan and, for
// the chosen spec, whether it counts toward this list or somewhere else.
// (An unchosen spec's what-if suffix is Phase 03's.)
export function courseLineStatus(
  view: PlanView,
  code: string,
  spec: SpecialisationInfo,
  listGroupId: string,
): string {
  const placement = view.placements.find((p) => p.code === code);
  if (!placement) return "Not in your plan";
  const status = placedStatus(view, placement);
  const base = `${status.word} ${status.parts[0].termLabel}`;
  if (chosenSpecGroup(view) !== spec.groupId) return base;
  if (placement.countsToward === listGroupId) return `${base}, counts here`;
  if (placement.countsToward) return `${base}, counts toward ${groupLabel(view, placement.countsToward)}`;
  return `${base}, not counting toward anything`;
}
