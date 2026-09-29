import type { GroupDef } from "../lib/domain/types";
import type { SpecialisationData, SpecialisationsFile } from "./specialisation-types";
// A static import, like aacom-2027.ts's tdp.json: the Dockerfile ships only
// dist/, so the bundler has to inline the data. Regenerate it with
// `node scripts/merge-subplans.ts`, never by hand.
import merged from "../../data/2027/specialisations.json";
import { AACOM_2027 } from "./aacom-2027";

export type { SpecBlock, SpecialisationData, SpecialisationsFile } from "./specialisation-types";

export interface SpecList {
  groupId: string; // "arin-a": the child group this P&C list is modelled by
  label: string; // "Artificial Intelligence — foundations (max 12)"
  shortLabel: string; // "foundations (max 12)"
  unitsMax: number | null;
}

export interface SpecialisationInfo extends SpecialisationData {
  groupId: string; // "arin": the option of the selectable group
  label: string; // the app's label, as the radio shows it
  lists: SpecList[]; // one per `list` block, in order
}

export const SPEC_CHOICE_GROUP = "spec";

// The P&C code → group link lives here rather than on GroupDef: the program
// is seeded into SQLite from AACOM_2027, so a new field would need a
// migration. P&C's lists come in the same order as each group's children.
const GROUP_OF: Record<string, string> = {
  "ARIN-SPEC": "arin",
  "HCCC-SPEC": "hccc",
  "SYAR-SPEC": "syar",
  "THCS-SPEC": "thcs",
};

// Static data, so a broken link throws at import and fails every test that
// touches it, rather than rendering half a page.
function link(data: SpecialisationData): SpecialisationInfo {
  const groupId = GROUP_OF[data.code];
  if (!groupId) throw new Error(`${data.code}: no group linked in GROUP_OF`);
  const choice = AACOM_2027.groups.find((g) => g.id === SPEC_CHOICE_GROUP);
  const group = choice?.children?.find((c) => c.id === groupId);
  if (!group) throw new Error(`${data.code}: no group "${groupId}" under "${SPEC_CHOICE_GROUP}"`);
  const lists = data.requirements
    .flatMap((b) => (b.type === "list" ? [b] : []))
    .map((list, k): SpecList => {
      const child: GroupDef | undefined = group.children?.[k];
      if (!child) throw new Error(`${data.code}: no child group for list ${k + 1} "${list.heading}"`);
      return {
        groupId: child.id,
        label: child.label,
        shortLabel: child.label.split(" — ")[1] ?? child.label,
        unitsMax: child.unitsMax ?? null,
      };
    });
  return { ...data, groupId, label: group.label, lists };
}

export const SPECIALISATIONS: SpecialisationInfo[] = (merged as SpecialisationsFile).specialisations.map(link);

export function specialisationByCode(code: string): SpecialisationInfo | null {
  return SPECIALISATIONS.find((s) => s.code === code) ?? null;
}

export function specialisationByGroup(groupId: string): SpecialisationInfo | null {
  return SPECIALISATIONS.find((s) => s.groupId === groupId) ?? null;
}

export function specialisationsListing(courseCode: string): SpecialisationInfo[] {
  return SPECIALISATIONS.filter((s) =>
    s.requirements.some((b) => b.type === "list" && b.courses.includes(courseCode)),
  );
}
