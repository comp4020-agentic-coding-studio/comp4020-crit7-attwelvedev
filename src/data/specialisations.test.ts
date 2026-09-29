import { describe, expect, it } from "vitest";
import {
  SPECIALISATIONS,
  specialisationByCode,
  specialisationByGroup,
  specialisationsListing,
} from "./specialisations";

describe("SPECIALISATIONS", () => {
  it("holds the four P&C specialisations, sorted by code", () => {
    expect(SPECIALISATIONS.map((s) => s.code)).toEqual(["ARIN-SPEC", "HCCC-SPEC", "SYAR-SPEC", "THCS-SPEC"]);
  });

  it("carries each group's own label", () => {
    expect(specialisationByCode("ARIN-SPEC")?.label).toBe("Artificial Intelligence");
    expect(specialisationByCode("HCCC-SPEC")?.label).toBe("Human-Centred & Creative Computing");
  });

  it("pairs each P&C list with the child group that models it", () => {
    expect(specialisationByCode("ARIN-SPEC")?.lists).toEqual([
      {
        groupId: "arin-a",
        label: "Artificial Intelligence — foundations (max 12)",
        shortLabel: "foundations (max 12)",
        unitsMax: 12,
      },
      {
        groupId: "arin-b",
        label: "Artificial Intelligence — advanced (min 12)",
        shortLabel: "advanced (min 12)",
        unitsMax: null,
      },
    ]);
  });

  it("keeps a label with no ' — ' part whole as the short label", () => {
    expect(specialisationByCode("HCCC-SPEC")?.lists[0].shortLabel).toBe("HCCC core");
  });
});

describe("lookups", () => {
  it("finds by exact P&C code only", () => {
    expect(specialisationByCode("ARIN-SPEC")?.groupId).toBe("arin");
    expect(specialisationByCode("ARIN")).toBeNull();
    expect(specialisationByCode("NOPE-SPEC")).toBeNull();
  });

  it("finds by the specialisation group's id", () => {
    expect(specialisationByGroup("hccc")?.code).toBe("HCCC-SPEC");
    expect(specialisationByGroup("cap-team")).toBeNull();
  });

  it("lists every specialisation whose lists include a course", () => {
    expect(specialisationsListing("COMP3670").map((s) => s.code)).toEqual(["ARIN-SPEC", "HCCC-SPEC"]);
    expect(specialisationsListing("COMP1100")).toEqual([]);
  });
});
