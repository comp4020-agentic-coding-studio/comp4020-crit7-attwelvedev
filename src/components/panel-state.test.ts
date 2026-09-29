import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  applyLayoutPrefs,
  applyReqsState,
  applySplit,
  DEFAULT_REQS,
  DETAILS_W_KEY,
  loadLayoutPrefs,
  NAV_KEY,
  parseColumns,
  parseSplit,
  REQS_COLS_KEY,
  REQS_KEY,
  REQS_W_KEY,
  reqsStateFromDataset,
  saveLayoutPrefs,
  saveReqsState,
  saveSplit,
  setNavHidden,
  SPLIT_KEY,
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

describe("parseSplit", () => {
  it.each([
    ["30", 30],
    ["70", 70],
    ["50", 50],
  ])("reads %j as %i", (raw, split) => {
    expect(parseSplit(raw)).toBe(split);
  });

  it.each([null, undefined, "", "40", "abc"])("falls back to 50 for %j", (raw) => {
    expect(parseSplit(raw)).toBe(50);
  });
});

describe("applySplit", () => {
  it("sets the attribute for a non-default split, then clears it for 50", () => {
    const root = host();
    applySplit(root, 30);
    expect(root.dataset).toEqual({ split: "30" });
    applySplit(root, 50);
    expect(root.dataset).toEqual({});
  });
});

describe("saveSplit", () => {
  it("stores a non-default split, then removes the key for 50", () => {
    const storage = fakeStorage();
    saveSplit(70, storage);
    expect(storage.map.get(SPLIT_KEY)).toBe("70");
    saveSplit(50, storage);
    expect(storage.map.has(SPLIT_KEY)).toBe(false);
  });

  it("doesn't throw when storage throws or is missing", () => {
    expect(() => saveSplit(30, throwingStorage)).not.toThrow();
    expect(() => saveSplit(30, null)).not.toThrow();
  });
});

describe("loadLayoutPrefs", () => {
  const DEFAULTS = { reqsWidthPx: null, reqsFolded: false, detailsWidthPx: 440 };

  it("gives the defaults for empty storage", () => {
    expect(loadLayoutPrefs(fakeStorage())).toEqual(DEFAULTS);
    expect(loadLayoutPrefs(null)).toEqual(DEFAULTS);
  });

  it("reads saved widths and the fold", () => {
    const storage = fakeStorage();
    storage.map.set(REQS_W_KEY, "600");
    storage.map.set(DETAILS_W_KEY, "680");
    storage.map.set(REQS_KEY, "collapsed");
    expect(loadLayoutPrefs(storage)).toEqual({ reqsWidthPx: 600, reqsFolded: true, detailsWidthPx: 680 });
  });

  it.each(["abc", "-5", "99999", "12.5", ""])("falls back to the default for %j", (raw) => {
    const storage = fakeStorage();
    storage.map.set(REQS_W_KEY, raw);
    storage.map.set(DETAILS_W_KEY, raw);
    expect(loadLayoutPrefs(storage)).toEqual(DEFAULTS);
  });

  it("gives the defaults when storage throws", () => {
    expect(loadLayoutPrefs(throwingStorage)).toEqual(DEFAULTS);
  });
});

describe("saveLayoutPrefs", () => {
  it("writes both widths and the fold, and drops the retired column key", () => {
    const storage = fakeStorage();
    storage.map.set(REQS_COLS_KEY, "2");
    saveLayoutPrefs({ reqsWidthPx: 600, reqsFolded: true, detailsWidthPx: 680 }, storage);
    expect(Object.fromEntries(storage.map)).toEqual({
      [REQS_W_KEY]: "600",
      [DETAILS_W_KEY]: "680",
      [REQS_KEY]: "collapsed",
    });
  });

  it("removes the Requirements width when it's back to the default, and the fold when unfolded", () => {
    const storage = fakeStorage();
    saveLayoutPrefs({ reqsWidthPx: 600, reqsFolded: true, detailsWidthPx: 680 }, storage);
    saveLayoutPrefs({ reqsWidthPx: null, reqsFolded: false, detailsWidthPx: 440 }, storage);
    expect(Object.fromEntries(storage.map)).toEqual({ [DETAILS_W_KEY]: "440" });
  });

  it("doesn't throw when storage throws or is missing", () => {
    const prefs = { reqsWidthPx: 600, reqsFolded: false, detailsWidthPx: 440 };
    expect(() => saveLayoutPrefs(prefs, throwingStorage)).not.toThrow();
    expect(() => saveLayoutPrefs(prefs, null)).not.toThrow();
  });
});

describe("applyLayoutPrefs", () => {
  function fakeRoot() {
    const props = new Map<string, string>();
    return {
      props,
      dataset: {} as DOMStringMap,
      style: {
        setProperty: (name: string, value: string) => void props.set(name, value),
        removeProperty: (name: string) => void props.delete(name),
      },
    };
  }

  it("sets the width properties and the fold attribute the first paint reads", () => {
    const root = fakeRoot();
    applyLayoutPrefs(root, { reqsWidthPx: 600, reqsFolded: true, detailsWidthPx: 680 });
    expect(Object.fromEntries(root.props)).toEqual({ "--reqs-pref": "600px", "--details-pref": "680px" });
    expect(root.dataset.reqs).toBe("collapsed");
    applyLayoutPrefs(root, { reqsWidthPx: null, reqsFolded: false, detailsWidthPx: 440 });
    expect(Object.fromEntries(root.props)).toEqual({ "--details-pref": "440px" });
    expect(root.dataset.reqs).toBeUndefined();
  });
});

describe("the inline head script in Base.astro", () => {
  // The pre-paint script can't import this module (it runs inline, before any
  // bundle loads), so it spells the keys out; this keeps the two in step.
  it("uses the same nav key", () => {
    const base = readFileSync("src/layouts/Base.astro", "utf-8");
    expect(base).toContain(`"${NAV_KEY}"`);
  });

  it("uses the same sidebar key", () => {
    const base = readFileSync("src/layouts/Base.astro", "utf-8");
    expect(base).toContain(`"${REQS_KEY}"`);
  });

  it("uses the same column-count key", () => {
    const base = readFileSync("src/layouts/Base.astro", "utf-8");
    expect(base).toContain(`"${REQS_COLS_KEY}"`);
  });

  it("uses the same width keys, and sets the width properties", () => {
    const base = readFileSync("src/layouts/Base.astro", "utf-8");
    expect(base).toContain(`"${REQS_W_KEY}"`);
    expect(base).toContain(`"${DETAILS_W_KEY}"`);
    expect(base).toContain(`"--reqs-pref"`);
    expect(base).toContain(`"--details-pref"`);
  });

  it("uses the same split key", () => {
    const base = readFileSync("src/layouts/Base.astro", "utf-8");
    expect(base).toContain(`"${SPLIT_KEY}"`);
  });
});
