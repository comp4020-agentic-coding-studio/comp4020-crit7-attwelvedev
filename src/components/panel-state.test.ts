import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyReqsState,
  DEFAULT_REQS,
  NAV_KEY,
  parseColumns,
  REQS_COLS_KEY,
  REQS_KEY,
  reqsStateFromDataset,
  saveReqsState,
  setNavHidden,
  type StorageLike,
} from "./panel-state";

function fakeStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

// Stands in for a private window or blocked site data, where every access throws.
const throwingStorage: StorageLike = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

function host() {
  return { dataset: {} as DOMStringMap };
}

describe("parseColumns", () => {
  it.each([
    ["1", 1],
    ["2", 2],
    ["3", 3],
  ])("reads %j as %i", (raw, columns) => {
    expect(parseColumns(raw)).toBe(columns);
  });

  it.each([null, undefined, "", "0", "4", "2.5", "two"])("falls back to 3 for %j", (raw) => {
    expect(parseColumns(raw)).toBe(3);
  });
});

describe("reqsStateFromDataset", () => {
  it("gives the defaults for an empty dataset", () => {
    expect(reqsStateFromDataset({})).toEqual(DEFAULT_REQS);
  });

  it("reads a collapsed, 1-column state", () => {
    expect(reqsStateFromDataset({ reqs: "collapsed", reqsCols: "1" })).toEqual({ collapsed: true, columns: 1 });
  });

  it("treats anything but \"collapsed\" as expanded", () => {
    expect(reqsStateFromDataset({ reqs: "yes" }).collapsed).toBe(false);
  });
});

describe("applyReqsState", () => {
  it("sets the attributes for a non-default state, then clears them for the default", () => {
    const root = host();
    applyReqsState(root, { collapsed: true, columns: 2 });
    expect(root.dataset).toEqual({ reqs: "collapsed", reqsCols: "2" });
    applyReqsState(root, { collapsed: false, columns: 3 });
    expect(root.dataset).toEqual({});
  });
});

describe("saveReqsState", () => {
  it("stores the collapsed flag and always stores the column count", () => {
    const storage = fakeStorage();
    saveReqsState({ collapsed: true, columns: 1 }, storage);
    expect(storage.map.get(REQS_KEY)).toBe("collapsed");
    expect(storage.map.get(REQS_COLS_KEY)).toBe("1");
    saveReqsState({ collapsed: false, columns: 3 }, storage);
    expect(storage.map.has(REQS_KEY)).toBe(false);
    expect(storage.map.get(REQS_COLS_KEY)).toBe("3");
    saveReqsState({ collapsed: false, columns: 2 }, storage);
    expect(storage.map.get(REQS_COLS_KEY)).toBe("2");
  });

  it("doesn't throw when storage throws or is missing", () => {
    expect(() => saveReqsState({ collapsed: true, columns: 2 }, throwingStorage)).not.toThrow();
    expect(() => saveReqsState({ collapsed: true, columns: 2 }, null)).not.toThrow();
  });
});

describe("setNavHidden", () => {
  it("sets and stores the hidden state, then clears both", () => {
    const root = host();
    const storage = fakeStorage();
    setNavHidden(root, true, storage);
    expect(root.dataset.nav).toBe("hidden");
    expect(storage.map.get(NAV_KEY)).toBe("hidden");
    setNavHidden(root, false, storage);
    expect("nav" in root.dataset).toBe(false);
    expect(storage.map.has(NAV_KEY)).toBe(false);
  });

  it("still applies the attribute when storage throws", () => {
    const root = host();
    expect(() => setNavHidden(root, true, throwingStorage)).not.toThrow();
    expect(root.dataset.nav).toBe("hidden");
  });
});

describe("the inline head script in Base.astro", () => {
  // The pre-paint script can't import this module (it runs inline, before any
  // bundle loads), so it spells the keys out; this keeps the two in step.
  it("uses the same nav key", () => {
    const base = readFileSync("src/layouts/Base.astro", "utf-8");
    expect(base).toContain(`"${NAV_KEY}"`);
  });
});
