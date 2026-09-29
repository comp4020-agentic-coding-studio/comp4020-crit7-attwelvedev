import { describe, expect, it } from "vitest";
import { chromium, type Page } from "playwright";
import { axeViolations, openPage, type Viewport } from "../browser";
import { baseUrl, browser, planWithPlacement, useBrowser, withPlan } from "./helpers";

useBrowser();

const desktop = { width: 1920, height: 1080 };
const phone = { width: 390, height: 844 };

async function onPlan(id: string, viewport: Viewport, check: (page: Page) => Promise<void>): Promise<void> {
  const page = await openPage(browser, new URL(`/plan/${id}`, baseUrl).href, viewport);
  try {
    await check(page);
  } finally {
    await page.close();
  }
}

const earlier = (page: Page) => page.getByRole("button", { name: "Scroll to earlier semesters" });
const later = (page: Page) => page.getByRole("button", { name: "Scroll to later semesters" });

describe("timeline years", { timeout: 30_000 }, () => {
  it("terms are grouped by year", async () => {
    await withPlan(desktop, async (page) => {
      const years = await page.evaluate(() =>
        [...document.querySelectorAll(".timeline-year")].map((year) => ({
          label: year.querySelector(".timeline-year-head .timeline-year-label")?.textContent?.trim(),
          labelHidden: year.querySelector(".timeline-year-label")?.closest("[aria-hidden='true']") !== null,
          terms: [...year.querySelectorAll(":scope > section.term[data-term]")].map((term) =>
            term.querySelector("h2")!.textContent!.split(" ").pop(),
          ),
        })),
      );
      expect(years).toEqual(
        ["2027", "2028", "2029", "2030"].map((year) => ({ label: year, labelHidden: true, terms: [year, year] })),
      );
    });
  });

  // The phone's timeline pane is short enough to scroll; the head must
  // hold at the scroller's top rather than scroll away with the cards.
  it("year headers stay visible", async () => {
    await withPlan(phone, async (page) => {
      const result = await page.evaluate(() => {
        const scroller = document.querySelector<HTMLElement>(".timeline-scroll")!;
        scroller.scrollTop = 400;
        const head = document.querySelector<HTMLElement>(".timeline-year-head")!;
        const glass = document.querySelector<HTMLElement>(".timeline-glass")!;
        const top = scroller.getBoundingClientRect().top;
        return {
          scrolled: scroller.scrollTop,
          offset: head.getBoundingClientRect().top - top,
          glassOffset: glass.getBoundingClientRect().top - top,
          glass: glass.classList.contains("glass"),
        };
      });
      expect(result.scrolled).toBeGreaterThan(0);
      expect(Math.abs(result.offset)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.glassOffset)).toBeLessThanOrEqual(1);
      expect(result.glass).toBe(true);
    });
  });

  // One frosted surface per year, not a band plus one per term (Task 15
  // review, 2026-09-29): scrolled down, each term's heading row sits on
  // its year's band, inside it, with no glass of its own.
  // 800px tall on desktop: at 1080 the example's cards fit, leaving nothing to scroll.
  it.each([{ width: 1920, height: 800 }, phone])(
    "a year has one sticky header, its terms' headings inside it, at $width×$height",
    async (viewport) => {
      await withPlan(viewport, async (page) => {
        const result = await page.evaluate(() => {
          const scroller = document.querySelector<HTMLElement>(".timeline-scroll")!;
          scroller.scrollTop = 300;
          const year = document.querySelector(".timeline-year")!;
          const band = year.querySelector(".timeline-year-head")!.getBoundingClientRect();
          return {
            scrolled: scroller.scrollTop,
            tops: [...year.querySelectorAll(".term-top")].map((el) => {
              const r = el.getBoundingClientRect();
              return {
                inside: r.top >= band.top - 1 && r.bottom <= band.bottom + 1,
                glass: getComputedStyle(el).backdropFilter,
              };
            }),
          };
        });
        expect(result.scrolled).toBeGreaterThan(0);
        expect(result.tops).toEqual([
          { inside: true, glass: "none" },
          { inside: true, glass: "none" },
        ]);
      });
    },
  );

  // One rhythm across the timeline: a card sits as far from the region's
  // edge as from a year's hairline, and the gap between S1's and S2's
  // cards is the same again (Task 15 review, 2026-09-29).
  it("keeps cards the same distance from every column edge", async () => {
    await withPlan(desktop, async (page) => {
      const measure = () =>
        page.evaluate(() => {
          const areaEl = document.querySelector(".planner-timeline-area")!;
          const area = areaEl.getBoundingClientRect();
          const border = parseFloat(getComputedStyle(areaEl).borderLeftWidth);
          const card = (t: number) =>
            document.querySelector(`[data-term="${t}"] .course-card`)!.getBoundingClientRect();
          const year = document.querySelector(".timeline-year")!;
          const divider = year.getBoundingClientRect().right;
          const hairline = parseFloat(getComputedStyle(year).borderRightWidth);
          return {
            first: card(0).left - (area.left + border),
            last: area.right - border - card(7).right,
            between: card(1).left - card(0).right,
            beforeDivider: divider - hairline - card(1).right,
            afterDivider: card(2).left - divider,
          };
        });
      const start = await measure();
      await page.locator(".timeline-scroll").evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
      const end = await measure();
      const gaps = {
        first: start.first,
        between: start.between,
        beforeDivider: start.beforeDivider,
        afterDivider: start.afterDivider,
        last: end.last,
      };
      for (const [name, gap] of Object.entries(gaps)) {
        expect(Math.abs(gap - start.afterDivider), `${name}: ${JSON.stringify(gaps)}`).toBeLessThanOrEqual(1);
      }
    });
  });

  // A card's rings sit outside it (the locate flash, the open course's,
  // focus), and the year band paints over cards, so the band has to end
  // clear of the widest ring around a column's first card (Task 15 review,
  // 2026-09-29).
  it.each([desktop, phone])("the header ends clear of a first card's ring at $width", async (viewport) => {
    await withPlan(viewport, async (page) => {
      const result = await page.evaluate(() => {
        const card = document.querySelector<HTMLElement>('[data-term="0"] .course-card')!;
        card.classList.add("course-card-highlighted");
        const style = getComputedStyle(card);
        const ring = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
        card.classList.remove("course-card-highlighted");
        const band = card.closest(".timeline-year")!.querySelector(".timeline-year-head")!.getBoundingClientRect();
        return { ring, clearance: card.getBoundingClientRect().top - band.bottom };
      });
      expect(result.ring).toBeGreaterThan(0);
      expect(result.clearance).toBeGreaterThanOrEqual(result.ring);
    });
  });

  // With no courses placed, the scroller holds nothing to tab to, and on a
  // phone there are no ‹ › buttons either: it's a focusable, labelled
  // region, so the keyboard can still scroll it (found by axe at the
  // Phase 05 close, 2026-09-29).
  it.each([desktop, phone])(
    "an empty plan's timeline can be scrolled from the keyboard at $width",
    async (viewport) => {
      const created = await fetch(new URL("/api/plans", baseUrl), {
        method: "POST",
        headers: { origin: baseUrl },
        redirect: "manual",
      });
      const id = created.headers.get("location")!.split("/").pop()!;
      await onPlan(id, viewport, async (page) => {
        const scroller = page.getByRole("region", { name: "Timeline" });
        expect(await scroller.evaluate((el) => el.classList.contains("timeline-scroll"))).toBe(true);
        expect(await axeViolations(page)).toEqual([]);
        await scroller.focus();
        await page.keyboard.press("ArrowRight");
        await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
      });
    },
  );

  // The frosted header is one glass surface across every year, edge to
  // edge of the region, with the years' labels, term headings and
  // hairlines drawn over it. A band per year, even touching, left a seam
  // at each year: a backdrop blur stops at its own element's edge (Task 15
  // review, 2026-09-29).
  it("the frosted header is one surface, edge to edge", async () => {
    await withPlan({ width: 1920, height: 800 }, async (page) => {
      const measure = () =>
        page.evaluate(() => {
          const areaEl = document.querySelector(".planner-timeline-area")!;
          const area = areaEl.getBoundingClientRect();
          const border = parseFloat(getComputedStyle(areaEl).borderLeftWidth);
          const scroller = document.querySelector(".timeline-scroll")!;
          const frosted = [...scroller.querySelectorAll("*")].filter(
            (el) => getComputedStyle(el).backdropFilter !== "none",
          );
          const rect = frosted[0]?.getBoundingClientRect();
          const years = [...document.querySelectorAll(".timeline-year")];
          return {
            count: frosted.length,
            startGap: rect ? rect.left - (area.left + border) : null,
            endGap: rect ? area.right - border - rect.right : null,
            stuck: rect ? Math.abs(rect.top - scroller.getBoundingClientRect().top) : null,
            hairlines: years.map((y) => getComputedStyle(y, "::after").backgroundColor),
          };
        });
      await page.locator(".timeline-scroll").evaluate((el) => {
        el.scrollTop = 150;
      });
      const start = await measure();
      await page.locator(".timeline-scroll").evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
      const end = await measure();
      expect(start.count).toBe(1);
      expect(start.startGap).toBeLessThanOrEqual(0.5);
      expect(end.endGap).toBeLessThanOrEqual(0.5);
      expect(start.stuck).toBeLessThanOrEqual(1);
      // Every year but the last draws its hairline, in the line colour.
      const drawn = start.hairlines.slice(0, -1);
      expect(new Set(drawn).size).toBe(1);
      expect(drawn[0]).not.toBe("rgba(0, 0, 0, 0)");
    });
  });

  // The ‹ › and the edge fades sit clear of the scroller's own scrollbars,
  // which stay visible and grabbable (Task 15 review, 2026-09-29). The
  // suite's browser hides scrollbars, so this launches one that draws them.
  it("keeps the ‹ › and the edge fades off the scrollbars", async () => {
    const withBars = await chromium.launch({ ignoreDefaultArgs: ["--hide-scrollbars"] });
    try {
      const page = await withBars.newPage({ viewport: { width: 1920, height: 800 } });
      await page.goto(new URL("/plan/example", baseUrl).href, { waitUntil: "networkidle" });
      const result = await page.evaluate(() => {
        const scroller = document.querySelector<HTMLElement>(".timeline-scroll")!;
        const box = scroller.getBoundingClientRect();
        const style = getComputedStyle(scroller);
        const contentRight = box.left + parseFloat(style.borderLeftWidth) + scroller.clientWidth;
        const contentBottom = box.top + parseFloat(style.borderTopWidth) + scroller.clientHeight;
        const wrap = document.querySelector(".timeline-scroll-wrap")!;
        const fade = getComputedStyle(wrap, "::after");
        const wrapBox = wrap.getBoundingClientRect();
        return {
          bar: scroller.offsetWidth - scroller.clientWidth,
          toolbarRight: document.querySelector(".timeline-toolbar")!.getBoundingClientRect().right,
          fadeRight: wrapBox.right - parseFloat(fade.right),
          fadeBottom: wrapBox.bottom - parseFloat(fade.bottom),
          contentRight,
          contentBottom,
        };
      });
      expect(result.bar).toBeGreaterThan(0);
      expect(result.toolbarRight).toBeLessThanOrEqual(result.contentRight + 0.5);
      expect(result.fadeRight).toBeLessThanOrEqual(result.contentRight + 0.5);
      expect(result.fadeBottom).toBeLessThanOrEqual(result.contentBottom + 0.5);
    } finally {
      await withBars.close();
    }
  });

  it("scroll buttons", async () => {
    await withPlan(desktop, async (page) => {
      const scrollLeft = () => page.locator(".timeline-scroll").evaluate((el) => el.scrollLeft);
      expect(await earlier(page).isDisabled()).toBe(true);
      expect(await later(page).isDisabled()).toBe(false);
      await later(page).click();
      await expect.poll(scrollLeft).toBeGreaterThan(0);
      await expect.poll(() => earlier(page).isDisabled()).toBe(false);
      await page.locator(".timeline-scroll").evaluate((el) => {
        el.scrollLeft = el.scrollWidth;
      });
      await expect.poll(() => later(page).isDisabled()).toBe(true);
    });
  });

  it("edge fade shows when more is off-screen", async () => {
    await withPlan(desktop, async (page) => {
      const classes = () => page.locator(".timeline-scroll-wrap").evaluate((el) => [...el.classList]);
      await expect.poll(classes).toContain("more-right");
      expect(await classes()).not.toContain("more-left");
      await page.locator(".timeline-scroll").evaluate((el) => el.scrollBy({ left: 300 }));
      await expect.poll(classes).toContain("more-left");
    });
  });

  // COMP4550 is hard-blocked only from terms 0, 1 and 7. Over term 3 (S2
  // 2028) it takes term 4 too (S1 2029): a different year's group, so the
  // outline can't rely on the two terms being adjacent siblings.
  it("two-semester drag outlines both terms across a year boundary", async () => {
    const id = await planWithPlacement("COMP4550", 2);
    await onPlan(id, desktop, async (page) => {
      const card = page.locator('[data-drag-code="COMP4550"]').first();
      await card.hover();
      await page.mouse.down();
      const start = (await card.boundingBox())!;
      await page.mouse.move(start.x + start.width / 2 + 20, start.y + start.height / 2, { steps: 4 });
      const target = (await page.locator('[data-term="3"]').boundingBox())!;
      const scroller = (await page.locator(".timeline-scroll").boundingBox())!;
      const x = (target.x + Math.min(target.x + target.width, scroller.x + scroller.width)) / 2;
      await page.mouse.move(x, target.y + 80, { steps: 10 });
      await page.mouse.move(x + 4, target.y + 84, { steps: 2 });
      const outlined = (term: number) =>
        page
          .locator(`[data-term="${term}"]`)
          .evaluate(
            (el) => getComputedStyle(el).outlineStyle !== "none" && getComputedStyle(el).outlineWidth !== "0px",
          );
      await expect
        .poll(async () => [await outlined(3), await outlined(4), await outlined(5)])
        .toEqual([true, true, false]);
      expect(await page.locator('[data-term="3"].drag-hover-target').count()).toBe(1);
      expect(await page.locator('[data-term="4"].drag-hover-next').count()).toBe(1);
      await page.mouse.up();
    });
  });

  // The year band's glass lies over the top of every term, so a term's
  // drag states show on its heading row too, which sits above the band:
  // the outline's top and sides, and a blocked term's grey (Task 15
  // review, 2026-09-29).
  it("shows drag states on the sticky term headings, over the year band", async () => {
    const id = await planWithPlacement("COMP4550", 2);
    await onPlan(id, desktop, async (page) => {
      const card = page.locator('[data-drag-code="COMP4550"]').first();
      await card.hover();
      await page.mouse.down();
      const start = (await card.boundingBox())!;
      await page.mouse.move(start.x + start.width / 2 + 20, start.y + start.height / 2, { steps: 4 });
      const target = (await page.locator('[data-term="3"]').boundingBox())!;
      const scroller = (await page.locator(".timeline-scroll").boundingBox())!;
      const x = (target.x + Math.min(target.x + target.width, scroller.x + scroller.width)) / 2;
      await page.mouse.move(x, target.y + 80, { steps: 10 });
      await page.mouse.move(x + 4, target.y + 84, { steps: 2 });
      await expect.poll(() => page.locator('[data-term="3"].drag-hover-target').count()).toBe(1);
      const tops = await page.evaluate(() => {
        const probe = document.createElement("div");
        probe.style.background = "var(--paper)";
        document.body.append(probe);
        const paper = getComputedStyle(probe).backgroundColor;
        probe.remove();
        return [0, 3, 4, 5].map((term) => {
          const section = document.querySelector(`[data-term="${term}"]`)!;
          const top = section.querySelector(".term-top")!;
          const style = getComputedStyle(top);
          return {
            term,
            ring: style.boxShadow !== "none",
            grey: style.backgroundColor === paper,
            fullWidth: Math.abs(top.getBoundingClientRect().width - section.getBoundingClientRect().width) <= 1,
          };
        });
      });
      await page.mouse.up();
      expect(tops).toEqual([
        { term: 0, ring: false, grey: true, fullWidth: true },
        { term: 3, ring: true, grey: false, fullWidth: true },
        { term: 4, ring: true, grey: false, fullWidth: true },
        { term: 5, ring: false, grey: false, fullWidth: true },
      ]);
    });
  });

  // Phone timelines are swiped, and the pane can't spare a band as tall
  // as the buttons (Phase 05 review, 2026-09-29).
  it("hides the scroll buttons on a phone, where the timeline is swiped", async () => {
    await withPlan(phone, async (page) => {
      expect(await earlier(page).isVisible()).toBe(false);
      expect(await later(page).isVisible()).toBe(false);
      // The label's row: the band's own height runs on down behind the term tops.
      const row = await page.evaluate(() => {
        const band = document.querySelector(".timeline-year-head")!.getBoundingClientRect();
        const top = document.querySelector(".term-top")!.getBoundingClientRect();
        return top.top - band.top;
      });
      expect(row).toBeLessThan(44);
    });
  });
});
