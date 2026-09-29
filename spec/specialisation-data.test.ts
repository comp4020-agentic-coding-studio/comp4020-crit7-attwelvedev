import { describe, expect, it } from "vitest";
import { AACOM_2027 } from "../src/data/aacom-2027";
import { SPEC_CHOICE_GROUP, SPECIALISATIONS } from "../src/data/specialisations";

// The P&C course lists are hand-copied into aacom-2027.ts as well as scraped
// into data/2027/specialisations.json. This fails the moment the two copies
// disagree, instead of the panel quietly showing lists the allocation
// doesn't use.
const specGroup = AACOM_2027.groups.find((g) => g.id === SPEC_CHOICE_GROUP);

describe("specialisation data matches AACOM_2027", () => {
  for (const spec of SPECIALISATIONS) {
    it(spec.code, () => {
      const group = specGroup?.children?.find((c) => c.id === spec.groupId);
      if (!group) throw new Error(`${spec.code}: no group "${spec.groupId}" under "${SPEC_CHOICE_GROUP}"`);
      const children = group.children ?? [];

      expect(spec.minUnits, `${spec.code}: min_units vs ${group.id}.unitsRequired`).toBe(group.unitsRequired);

      const lists = spec.requirements.flatMap((b) => (b.type === "list" ? [b] : []));
      expect(lists.length, `${spec.code}: P&C lists vs ${group.id}'s children`).toBe(children.length);

      lists.forEach((list, k) => {
        const child = children[k];
        const pc = new Set(list.courses);
        const app = new Set(child.courses ?? []);
        const missing = [...pc].filter((c) => !app.has(c));
        const extra = [...app].filter((c) => !pc.has(c));
        expect(
          { missing, extra },
          `${spec.code} "${list.heading}" vs ${child.id}: missing from the app / extra in the app`,
        ).toEqual({ missing: [], extra: [] });

        const max = /maximum of (\d+) units/i.exec(list.heading);
        if (max) expect(child.unitsMax, `${spec.code} "${list.heading}" vs ${child.id}.unitsMax`).toBe(Number(max[1]));
        const min = /minimum of (\d+) units/i.exec(list.heading);
        if (min)
          expect(child.unitsRequired, `${spec.code} "${list.heading}" vs ${child.id}.unitsRequired`).toBe(
            Number(min[1]),
          );
      });
    });
  }
});
