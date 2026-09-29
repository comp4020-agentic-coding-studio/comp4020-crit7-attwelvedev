import { describe, expect, it } from "vitest";
import {
  computeLayout,
  DETAILS_SNAPS,
  dividerValue,
  dragPrefs,
  keyPrefs,
  type LayoutInput,
  type LayoutPrefs,
  reqsSnapTargets,
  snap,
  unfoldPrefs,
} from "./workspace-layout";

const REM = 16;
const OVERHEAD = 72; // the default 4.5rem
const DEFAULTS: LayoutPrefs = { reqsWidthPx: null, reqsFolded: false, detailsWidthPx: 440 };

function input(containerPx: number, detailsOpen = false, prefs: Partial<LayoutPrefs> = {}): LayoutInput {
  return { containerPx, remPx: REM, detailsOpen, prefs: { ...DEFAULTS, ...prefs }, gridOverheadPx: OVERHEAD };
}

const px = (reqs: number | "rail") => (reqs === "rail" ? "rail" : Number(reqs.toFixed(1)));

describe("computeLayout", () => {
  // At ≥1100px viewports the planner container is the viewport minus 256px:
  // the 13rem site nav plus main's 1.5rem padding either side.
  it.each([
    [1664, 715.2], // a 1920 viewport
    [1184, 497.6], // 1440
    [844, 280], // 1100
  ])("defaults reproduce today's widths: %i gives %d", (containerPx, reqsPx) => {
    const layout = computeLayout(input(containerPx));
    expect(layout.mode).toBe("side-by-side");
    expect(px(layout.reqsPx)).toBe(reqsPx);
    expect(layout.details).toEqual({ mode: "closed" });
    expect(layout.autoFolded).toBe(false);
  });

  it("is stacked below 49.5rem, with details as a sheet when open", () => {
    expect(computeLayout(input(780)).mode).toBe("stacked");
    expect(computeLayout(input(780)).details).toEqual({ mode: "closed" });
    expect(computeLayout(input(780, true)).details).toEqual({ mode: "sheet" });
  });

  it("opening details at 1664 steps requirements to two columns and docks 440", () => {
    const layout = computeLayout(input(1664, true));
    expect(px(layout.reqsPx)).toBe(497.6);
    expect(layout.details).toEqual({ mode: "docked", px: 440 });
    expect(layout.autoFolded).toBe(false);
  });

  it.each<[number, number | "rail", { mode: string; px?: number }, boolean]>([
    [1700, 715.2, { mode: "docked", px: 440 }, false],
    [1600, 497.6, { mode: "docked", px: 440 }, false],
    [1280, 280, { mode: "docked", px: 440 }, false],
    [1024, "rail", { mode: "docked", px: 440 }, true],
    [1000, "rail", { mode: "docked", px: 424 }, true],
    [900, 280, { mode: "drawer", px: 440 }, false],
  ])(
    "as content narrows, requirements go 3 → 2 → 1 → rail before details shrink below 440: %i",
    (containerPx, reqsPx, details, autoFolded) => {
      const layout = computeLayout(input(containerPx, true));
      expect(px(layout.reqsPx)).toBe(reqsPx);
      expect(layout.details).toEqual(details);
      expect(layout.autoFolded).toBe(autoFolded);
    },
  );

  it("the timeline never drops below 496 in every docked case", () => {
    const squeezed: string[] = [];
    for (let containerPx = 800; containerPx <= 2000; containerPx += 10) {
      for (const open of [false, true]) {
        for (const prefs of [{}, { detailsWidthPx: 960 }, { reqsWidthPx: 1400 }, { reqsFolded: true }]) {
          const layout = computeLayout(input(containerPx, open, prefs));
          if (layout.details.mode === "drawer") continue;
          if (layout.timelinePx < 496 - 1e-6) squeezed.push(`${containerPx} ${open} ${JSON.stringify(prefs)}`);
        }
      }
    }
    expect(squeezed).toEqual([]);
  });

  it("drawer when docking can't fit: requirements are what they'd be with details closed", () => {
    const layout = computeLayout(input(844, true));
    expect(layout.details).toEqual({ mode: "drawer", px: 440 });
    expect(layout.reqsPx).toBe(computeLayout(input(844)).reqsPx);
    expect(layout.autoFolded).toBe(false);
  });

  it("a folded preference stays folded, with autoFolded false", () => {
    for (const open of [false, true]) {
      const layout = computeLayout(input(1664, open, { reqsFolded: true }));
      expect(layout.reqsPx).toBe("rail");
      expect(layout.autoFolded).toBe(false);
    }
  });

  it("keeps a free width that fits, and drops one that doesn't to the column below", () => {
    expect(computeLayout(input(1664, false, { reqsWidthPx: 600 })).reqsPx).toBe(600);
    expect(px(computeLayout(input(1000, false, { reqsWidthPx: 600 })).reqsPx)).toBe(280);
  });

  it("clamps a saved width to the requirements minimum", () => {
    expect(computeLayout(input(1664, false, { reqsWidthPx: 100 })).reqsPx).toBe(280);
  });
});

describe("reqsSnapTargets", () => {
  it("gives the one-, two- and three-column widths", () => {
    const targets = reqsSnapTargets(REM, OVERHEAD);
    expect(targets.map((t) => Number(t.px.toFixed(1)))).toEqual([280, 497.6, 715.2]);
    expect(targets.map((t) => t.label)).toEqual(["One card column", "Two card columns", "Three card columns"]);
  });
});

describe("snap", () => {
  it("snaps within 16px, and not further", () => {
    expect(snap(434, DETAILS_SNAPS)).toEqual({ px: 440, target: DETAILS_SNAPS[0] });
    expect(snap(420, DETAILS_SNAPS)).toEqual({ px: 420, target: null });
  });
});

describe("dragPrefs", () => {
  const targets = reqsSnapTargets(REM, OVERHEAD);

  it("a requirements drag past the minimum by 60 releases to fold", () => {
    const i = input(1664);
    const start = computeLayout(i);
    const outcome = dragPrefs("reqs", i.prefs, start, 219 - 715.2, targets, i);
    expect(outcome.release).toBe("fold");
    expect(outcome.label).toBe("Release to fold requirements");
  });

  it("a requirements drag between the fold zone and the minimum rests at the minimum", () => {
    const i = input(1664);
    const outcome = dragPrefs("reqs", i.prefs, computeLayout(i), 240 - 715.2, targets, i);
    expect(outcome.release).toBeNull();
    expect(outcome.prefs.reqsWidthPx).toBe(280);
  });

  it("a requirements drag rests freely away from the targets", () => {
    const i = input(1664);
    const outcome = dragPrefs("reqs", i.prefs, computeLayout(i), 600 - 715.2, targets, i);
    expect(outcome).toMatchObject({ prefs: { reqsWidthPx: 600 }, label: "600 px", snapped: false, warn: false });
  });

  it("a requirements drag near a target snaps to it, rounding up so the columns still fit", () => {
    const i = input(1664);
    const outcome = dragPrefs("reqs", i.prefs, computeLayout(i), 505 - 715.2, targets, i);
    expect(outcome).toMatchObject({ prefs: { reqsWidthPx: 498 }, label: "Two card columns", snapped: true });
  });

  it("an over-max drag warns", () => {
    const i = input(1184);
    const outcome = dragPrefs("reqs", i.prefs, computeLayout(i), 800, targets, i);
    expect(outcome.warn).toBe(true);
    expect(outcome.label).toBe("The timeline needs room for one year");
    // The maximum leaves the timeline its one year beside the divider.
    expect(outcome.prefs.reqsWidthPx).toBe(1184 - 16 - 496);
  });

  it("widening requirements beside docked details squeezes details, not the columns", () => {
    const i = input(1664, true, { reqsWidthPx: 498 });
    const start = computeLayout(i);
    const outcome = dragPrefs("reqs", i.prefs, start, 200, targets, i);
    expect(outcome.prefs.reqsWidthPx).toBe(698);
    expect(outcome.prefs.detailsWidthPx).toBe(1632 - 698 - 496);
    expect(computeLayout({ ...i, prefs: outcome.prefs }).reqsPx).toBe(698);
  });

  it("a details drag to 690 snaps to 680", () => {
    const i = input(1664, true);
    const outcome = dragPrefs("details", i.prefs, computeLayout(i), 440 - 690, DETAILS_SNAPS, i);
    expect(outcome).toMatchObject({ prefs: { detailsWidthPx: 680 }, label: "Two-column details", snapped: true });
  });

  it("a details drag says when requirements would fold for it", () => {
    const i = input(1184, true, { reqsFolded: false });
    const start = computeLayout({ ...i, prefs: { ...i.prefs, detailsWidthPx: 360 } });
    const outcome = dragPrefs("details", { ...i.prefs, detailsWidthPx: 360 }, start, -200, DETAILS_SNAPS, i);
    expect(outcome.label).toBe("560 px, requirements fold");
  });

  it("a details drag past the minimum by 70 releases to close", () => {
    const i = input(1664, true);
    const outcome = dragPrefs("details", i.prefs, computeLayout(i), 440 - 289, DETAILS_SNAPS, i);
    expect(outcome.release).toBe("close");
    expect(outcome.label).toBe("Release to close details");
  });
});

describe("keyPrefs", () => {
  const at = (i: LayoutInput) => computeLayout(i);

  it("ArrowRight moves the divider 16px, 64px with Shift", () => {
    const i = input(1664, false, { reqsWidthPx: 600 });
    expect(keyPrefs("reqs", "ArrowRight", false, at(i), i.prefs, i)).toMatchObject({ reqsWidthPx: 616 });
    expect(keyPrefs("reqs", "ArrowRight", true, at(i), i.prefs, i)).toMatchObject({ reqsWidthPx: 664 });
    expect(keyPrefs("reqs", "ArrowLeft", false, at(i), i.prefs, i)).toMatchObject({ reqsWidthPx: 584 });
  });

  it("moving the details divider right narrows details", () => {
    const i = input(1664, true);
    expect(keyPrefs("details", "ArrowRight", false, at(i), i.prefs, i)).toMatchObject({ detailsWidthPx: 424 });
    expect(keyPrefs("details", "ArrowLeft", true, at(i), i.prefs, i)).toMatchObject({ detailsWidthPx: 504 });
  });

  it("Enter toggles", () => {
    const i = input(1664, true);
    expect(keyPrefs("reqs", "Enter", false, at(i), i.prefs, i)).toBe("toggle");
    expect(keyPrefs("details", "Enter", false, at(i), i.prefs, i)).toBe("toggle");
  });

  it("Home on requirements folds; End goes to the maximum", () => {
    const i = input(1184);
    expect(keyPrefs("reqs", "Home", false, at(i), i.prefs, i)).toMatchObject({ reqsFolded: true });
    expect(keyPrefs("reqs", "End", false, at(i), i.prefs, i)).toMatchObject({ reqsWidthPx: 1184 - 16 - 496 });
  });

  it("ArrowLeft at the minimum folds, and ArrowRight from folded unfolds", () => {
    const i = input(1664, false, { reqsWidthPx: 280 });
    expect(keyPrefs("reqs", "ArrowLeft", false, at(i), i.prefs, i)).toMatchObject({ reqsFolded: true });
    const folded = input(1664, false, { reqsFolded: true });
    expect(keyPrefs("reqs", "ArrowRight", false, at(folded), folded.prefs, folded)).toMatchObject({
      reqsFolded: false,
      reqsWidthPx: 280,
    });
  });

  it("Home and End on details go to its minimum and maximum", () => {
    const i = input(1664, true);
    expect(keyPrefs("details", "Home", false, at(i), i.prefs, i)).toMatchObject({ detailsWidthPx: 360 });
    expect(keyPrefs("details", "End", false, at(i), i.prefs, i)).toMatchObject({ detailsWidthPx: 960 });
  });

  it("ignores other keys", () => {
    const i = input(1664);
    expect(keyPrefs("reqs", "a", false, at(i), i.prefs, i)).toBeNull();
  });
});

describe("dividerValue", () => {
  const targets = reqsSnapTargets(REM, OVERHEAD);

  it("names a width on a target by its label, and any other by its px", () => {
    const i = input(1664);
    expect(dividerValue("reqs", computeLayout(i), i, targets)).toEqual({
      now: 715,
      min: 48,
      max: 1152,
      text: "Three card columns",
    });
    const free = input(1664, false, { reqsWidthPx: 600 });
    expect(dividerValue("reqs", computeLayout(free), free, targets).text).toBe("600 px");
  });

  it("says Folded on the rail", () => {
    const i = input(1664, false, { reqsFolded: true });
    expect(dividerValue("reqs", computeLayout(i), i, targets)).toMatchObject({ now: 48, text: "Folded" });
  });

  it("measures details within their own range", () => {
    const i = input(1664, true);
    expect(dividerValue("details", computeLayout(i), i, DETAILS_SNAPS)).toEqual({
      now: 440,
      min: 360,
      max: 960,
      text: "Default width",
    });
  });
});

describe("unfoldPrefs", () => {
  it("at 1184, auto-folded beside 440 details, unfolds at one column and narrows details", () => {
    const i = input(1184, true);
    expect(computeLayout(i).autoFolded).toBe(true);
    const result = unfoldPrefs(i);
    expect(result).toEqual({ prefs: { reqsWidthPx: 280, reqsFolded: false, detailsWidthPx: 376 } });
    if ("prefs" in result) {
      const layout = computeLayout({ ...i, prefs: result.prefs });
      expect(layout.reqsPx).toBe(280);
      expect(layout.details).toEqual({ mode: "docked", px: 376 });
    }
  });

  it("keeps the saved width when it fits beside the details minimum", () => {
    const i = input(1664, true, { reqsWidthPx: 700, detailsWidthPx: 960 });
    expect(unfoldPrefs(i)).toEqual({ prefs: { reqsWidthPx: 700, reqsFolded: false, detailsWidthPx: 436 } });
  });

  it("at 1024 there's no room for both", () => {
    expect(unfoldPrefs(input(1024, true))).toEqual({
      error: "Not enough room for requirements and details together. Close details, or widen the window.",
    });
  });
});
