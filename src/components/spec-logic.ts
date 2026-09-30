import { SPEC_CHOICE_GROUP, SPECIALISATIONS, type SpecialisationInfo } from "../data/specialisations";
import type { PlanView } from "../lib/domain/view";
import type { WhatIfView } from "../lib/domain/what-if";
import { groupLabel, groupPath, placedStatus } from "./planner-logic";

// The specialisation option the plan has chosen, as its group id, or null.
export function chosenSpecGroup(view: PlanView): string | null {
  return groupPath(view, SPEC_CHOICE_GROUP)[0]?.chosenId ?? null;
}

const words = (text: string) => text.toLowerCase().split(/[^a-z]+/).filter(Boolean);

// The palette's specialisation results, in SPECIALISATIONS order: a code
// ("ARIN" or "ARIN-SPEC"), or else every query word of 3+ letters starting
// some word of P&C's title or the app's label. Shorter words are skipped
// so "ai" or "of" doesn't match everything. A digit means a course search
// ("COMP1100", "COMP11"), and any four letters read as a code: either way
// "comp" would otherwise prefix the "Computing" specs' words.
export function matchSpecialisations(query: string): SpecialisationInfo[] {
  if (/\d/.test(query)) return [];
  const code = query.trim().toUpperCase();
  if (/^[A-Z]{4}(-SPEC)?$/.test(code)) {
    return SPECIALISATIONS.filter((s) => s.code.startsWith(`${code.slice(0, 4)}-`));
  }
  const wanted = words(query).filter((w) => w.length >= 3);
  if (wanted.length === 0) return [];
  return SPECIALISATIONS.filter((s) => {
    const have = [...words(s.title), ...words(s.label)];
    return wanted.every((w) => have.some((h) => h.startsWith(w)));
  });
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
// For an unchosen spec, the what-if says whether it would.
export function courseLineStatus(
  view: PlanView,
  code: string,
  spec: SpecialisationInfo,
  listGroupId: string,
  whatIf?: WhatIfView | null,
): string {
  const placement = view.placements.find((p) => p.code === code);
  if (!placement) return "Not in your plan";
  const status = placedStatus(view, placement);
  const base = `${status.word} ${status.parts[0].termLabel}`;
  if (chosenSpecGroup(view) !== spec.groupId) {
    if (!whatIf) return base;
    if (whatIf.countsToward[code] === listGroupId) return `${base}, would count`;
    const list = whatIf.lists.find((l) => l.groupId === listGroupId);
    const full = list && list.unitsMax !== null && list.completed + list.planned >= list.unitsMax;
    return full ? `${base}, wouldn't count here, over the ${list.unitsMax}-unit limit` : `${base}, wouldn't count here`;
  }
  if (placement.countsToward === listGroupId) return `${base}, counts here`;
  if (placement.countsToward) return `${base}, counts toward ${groupLabel(view, placement.countsToward)}`;
  return `${base}, not counting toward anything`;
}

// What's left of the option after the swap. The bar above it already
// prints the completed and planned figures.
export function fitFigures(w: WhatIfView): string {
  const toGo = w.required - w.completed - w.planned;
  return toGo > 0 ? `${toGo} units to go.` : "Covered.";
}

function joinAnd(items: string[]): string {
  return items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

export function fitSummary(w: WhatIfView): string {
  const n = w.moves.length;
  if (n === 0) return `None of your courses would count toward it yet, so all ${w.required} units are still to go.`;
  const from = [...new Set(w.moves.flatMap((m) => (m.from ? [m.from.label] : [])))];
  if (from.length === 0) return `${n} of your courses would count here.`;
  return `${n} of your courses would move here, from ${joinAnd(from)}.`;
}

export function shortfallText(s: WhatIfView["shortfalls"][number]): string {
  return `${s.label} would drop to ${s.completed + s.planned} of ${s.required}`;
}
