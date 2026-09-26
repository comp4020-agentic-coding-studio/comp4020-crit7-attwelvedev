import { describe, expect, it } from "vitest";
import { TERMS, termLabel } from "./terms";

describe("TERMS", () => {
  it("has 8 terms S1 2027 … S2 2030", () => {
    expect(TERMS.map((t) => t.label)).toEqual([
      "S1 2027", "S2 2027", "S1 2028", "S2 2028",
      "S1 2029", "S2 2029", "S1 2030", "S2 2030",
    ]);
    expect(TERMS[3]).toEqual({ index: 3, year: 2028, session: "S2", label: "S2 2028" });
  });

  it("termLabel(8) throws RangeError", () => {
    expect(() => termLabel(8)).toThrow(RangeError);
  });
});
