import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as panelState from "./panel-state";
import {
  applyLayoutPrefs,
  DETAILS_W_KEY,
  loadLayoutPrefs,
  NAV_KEY,
  REQS_KEY,
  REQS_W_KEY,
  saveLayoutPrefs,
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
  it("writes both widths and the fold", () => {
    const storage = fakeStorage();
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

  it("uses the same width keys, and sets the width properties", () => {
    const base = readFileSync("src/layouts/Base.astro", "utf-8");
    expect(base).toContain(`"${REQS_W_KEY}"`);
    expect(base).toContain(`"${DETAILS_W_KEY}"`);
    expect(base).toContain(`"--reqs-pref"`);
    expect(base).toContain(`"--details-pref"`);
  });

  // Phones switch regions with tabs now, so the stacked split is gone
  // (workspace-redesign WR40), and no saved split can resurface.
  it("no longer reads a split", () => {
    const base = readFileSync("src/layouts/Base.astro", "utf-8");
    expect(base).not.toContain("panel-split");
    expect(base).not.toContain("dataset.split");
    expect("SPLIT_KEY" in panelState).toBe(false);
  });
});
