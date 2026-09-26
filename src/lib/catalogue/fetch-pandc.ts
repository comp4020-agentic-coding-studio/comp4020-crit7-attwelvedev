import { HTMLElement, TextNode, parse as parseHtml } from "node-html-parser";
import { parseRequisites } from "../domain/requisites";
import type { CatalogueCourse } from "../domain/types";
import { fromPandc, type PandcCourseJson } from "./from-pandc";

export type FetchOutcome =
  | { status: "fetched"; course: CatalogueCourse }
  | { status: "not_found" }
  | { status: "error"; message: string };

const CODE_PATTERN = /^[A-Z]{4}\d{4}$/;
const USER_AGENT = "anu-degree-planner (+https://comp4020-crit7-attwelvedev.fly.dev/readme/)";
const FETCH_TIMEOUT_MS = 10_000;

// Ported from anu_pandc/parse/courses.py, this repo's copy of the same
// parser anu-pandc uses offline (Phase 07 plan §3) — kept behaviourally
// identical so a fetched stub and a scraped, committed course agree.
const HEADING_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6"]);
const REQ_HEADING = "requisite and incompatibility";
const INCOMPAT_MARKERS = ["You are not able to enrol", "You cannot enrol", "You may not enrol", "Incompatible with"];

function collectLeafTexts(node: HTMLElement | TextNode, out: string[]): void {
  if (node instanceof TextNode) {
    const text = node.text.trim();
    if (text) out.push(text);
    return;
  }
  for (const child of node.childNodes) collectLeafTexts(child as HTMLElement | TextNode, out);
}

// Mirrors BeautifulSoup's get_text(separator, strip=True): every text node is
// individually trimmed, then all of them are joined with `separator` — not
// just at direct-child boundaries, so a mid-sentence tag (e.g. a course-code
// link) still gets `separator` on both sides.
function textOf(nodes: (HTMLElement | TextNode)[], separator = " "): string {
  const out: string[] = [];
  for (const node of nodes) collectLeafTexts(node, out);
  return out.join(separator);
}

function getTitle(root: HTMLElement): string {
  return root.querySelector("h1.intro__degree-title")?.text.trim() ?? "";
}

function getUnits(root: HTMLElement): string {
  const dl = root.querySelector("dl.student-contribution-band");
  if (dl) {
    for (const dt of dl.querySelectorAll("dt")) {
      if (dt.text.trim().toLowerCase().includes("unit value")) {
        const dd = dt.nextElementSibling;
        if (dd?.tagName === "DD") {
          const match = dd.text.trim().match(/(\d+)/);
          if (match) return match[1];
        }
      }
    }
  }
  const li = root.querySelector("li.degree-summary__requirements-units");
  if (li) {
    const match = li.text.trim().match(/(\d+)\s*unit/i);
    if (match) return match[1];
  }
  return "";
}

function requisiteSectionText(root: HTMLElement): string {
  for (const heading of root.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
    if (!heading.text.trim().toLowerCase().startsWith(REQ_HEADING)) continue;
    const siblings = heading.parentNode?.childNodes ?? [];
    const startIndex = siblings.indexOf(heading);
    const span: (HTMLElement | TextNode)[] = [];
    for (let i = startIndex + 1; i < siblings.length; i++) {
      const sibling = siblings[i] as HTMLElement | TextNode;
      if (sibling instanceof HTMLElement && HEADING_TAGS.has(sibling.tagName)) break;
      span.push(sibling);
    }
    return textOf(span);
  }
  const div = root.querySelector("div.requisite");
  return div ? textOf([div]) : "";
}

function getRequisiteParts(root: HTMLElement): { prerequisites: string; incompatibilities: string; requisite_raw: string } {
  const fullText = requisiteSectionText(root).split("\n").join(" ").trim();
  if (!fullText) return { prerequisites: "None", incompatibilities: "None", requisite_raw: "" };

  let incompatStart: number | null = null;
  for (const marker of INCOMPAT_MARKERS) {
    const index = fullText.indexOf(marker);
    if (index !== -1 && (incompatStart === null || index < incompatStart)) incompatStart = index;
  }
  const head = (incompatStart !== null ? fullText.slice(0, incompatStart) : fullText).trim();
  return {
    prerequisites: head || "None",
    incompatibilities: incompatStart !== null ? fullText.slice(incompatStart).trim() : "None",
    requisite_raw: fullText,
  };
}

function getDescription(root: HTMLElement): string {
  const introDiv = root.querySelector("div.introduction");
  if (!introDiv) return "";
  const parts = introDiv
    .querySelectorAll("p")
    .map((p) => textOf([p], ""))
    .filter((text) => text.length > 0);
  return parts.join(" ");
}

function getOfferings(root: HTMLElement): { year: string; semester: string; mode: string }[] {
  const classTab = root.querySelector("#class");
  const tabsContainer = classTab?.querySelector("#tabs-container");
  if (!tabsContainer) return [];

  const yearByContentId = new Map<string, string>();
  const menu = tabsContainer.querySelector("div.course-tabs-menu");
  if (menu) {
    for (const anchor of menu.querySelectorAll("a")) {
      const href = (anchor.getAttribute("href") ?? "").replace(/^#/, "");
      yearByContentId.set(href, anchor.text.trim());
    }
  }

  const offerings: { year: string; semester: string; mode: string }[] = [];
  for (const contentDiv of tabsContainer.querySelectorAll("div.course-tab-content")) {
    const year = yearByContentId.get(contentDiv.getAttribute("id") ?? "") ?? "";
    for (const h3 of contentDiv.querySelectorAll("h3")) {
      const semester = h3.text.trim();
      const table = h3.nextElementSibling;
      if (table?.tagName !== "TABLE") continue;
      for (const row of table.querySelectorAll("tr")) {
        const cells = row.querySelectorAll("td");
        if (cells.length === 1 && cells[0].getAttribute("colspan")) continue; // a topic-label row
        if (cells.length < 6) continue;
        offerings.push({ year, semester, mode: cells[5].text.trim() });
      }
    }
  }
  return offerings;
}

function parseCoursePage(code: string, url: string, html: string, scrapedAt: string): PandcCourseJson {
  const root = parseHtml(html);
  const requisites = getRequisiteParts(root);
  return {
    code,
    url,
    title: getTitle(root),
    units: getUnits(root),
    level: (code.match(/\d/)?.[0] ?? "0") + "000",
    prerequisites: requisites.prerequisites,
    incompatibilities: requisites.incompatibilities,
    requisite_raw: requisites.requisite_raw,
    description: getDescription(root),
    scraped_at: scrapedAt,
    offerings: getOfferings(root),
  };
}

export async function fetchCourseFromPandc(code: string, fetchImpl: typeof fetch = fetch): Promise<FetchOutcome> {
  if (!CODE_PATTERN.test(code)) {
    return { status: "error", message: `malformed course code: ${code}` };
  }

  const url = `https://programsandcourses.anu.edu.au/2027/course/${code}`;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": USER_AGENT },
    });
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }

  if (response.status === 302 || response.status === 301) {
    const location = response.headers.get("location") ?? "";
    if (location.includes("/Error/")) return { status: "not_found" };
    return { status: "error", message: `unexpected redirect to ${location}` };
  }
  if (!response.ok) {
    return { status: "error", message: `unexpected status ${response.status}` };
  }

  let html: string;
  try {
    html = await response.text();
  } catch (err) {
    return { status: "error", message: err instanceof Error ? err.message : String(err) };
  }

  const json = parseCoursePage(code, url, html, new Date().toISOString());
  const course = fromPandc(json, null, parseRequisites);
  return { status: "fetched", course: { ...course, isStub: true } };
}
