import type { CourseFilter, ParsedRequisites, ReqExpr } from "./types";

// Each pattern below cites the real P&C phrasing (from data/2027/courses/*)
// it exists to handle — see Phase 03 plan §3 for the fuller inventory.

// "Incompatible: ...", "It is incompatible with ...", "You are not able /
// cannot / may not enrol ..." (COMP1600, MATH1005, COMP1110's incompat field).
const INCOMPATIBLE_ROUTE_RE = /^(Incompatible|It is incompatible|You (are not able|cannot|may not) enrol)/i;

// "Students enrolled/studying in <other program> must ..." (COMP2100) — but
// not when the "other program" is actually AACOM (COMP4820-style phrasing
// never matches this shape anyway, since it starts "To enrol...").
const OTHER_PROGRAM_ROUTE_RE = /^Students (enrolled|studying) in .* must/i;
const NAMES_AACOM_RE = /\bAACOM\b|Advanced Computing/i;

// Strips the "To enrol in this course you must ..." boilerplate once, at
// the start of a sentence. Deliberately does NOT eat a bare "completed"
// that's part of the concurrency marker ("completed or be currently ...").
const LEAD_IN_RE =
  /^To enrol( in this course)?,?\s*you must\s*(?:be\s+(?:studying(?:\s+a)?|enrolled in the)|(?:have\s+)?(?:successfully\s+)?(?:completed(?!\s*or\s+(?:be\s+)?currently)\s*:?\s*)?(?:the following\s*)?)?:?\s*/i;

// Recurring mid-expression filler before a code or a units clause: "have
// (successfully) completed[:] ..." (COMP4550, COMP4820's second clause).
const ACTION_FILLER_RE = /^(?:have\s+)?(?:successfully\s+)?completed\s*:?\s*/i;

// "(have) completed or (be) currently enrolled in/studying CODE" (COMP2120,
// COMP3620, COMP4550's second OR-branch) — concurrency, not disjunction.
const CONCURRENT_RE =
  /^(?:have\s+)?(?:successfully\s+)?completed\s+or\s+(?:be\s+)?currently\s+(?:enrolled\s+in|studying)\s+([A-Z]{4}\s?\d{4})\b/i;

const CODE_CORE_RE = /^([A-Z]{4})\s?(\d{4})\b/;
// "COMP1110 /1140" (digits-only shorthand) or "COMP1110 / COMP1140" (full
// second code) both expand to an OR of the two courses (COMP3620, COMP4670).
const CODE_SLASH_RE = /^\s*\/\s*(?:([A-Z]{4})\s?)?(\d{4})\b/;

// PROGRAM: a name-phrase ending in a short all-caps code in parens
// (COMP4450's HCOMP/HADAN/COMP-HSPC/AACOM), or the bare, code-less
// "Bachelor of Advanced Computing" (COMP4820) — both satisfied per FR11's
// rule (AACOM, or named "Bachelor of Advanced Computing" with no qualifier).
const PROGRAM_CODED_RE =
  /^((?:Bachelor|Honours|Computer Science Honours Specialisation)[A-Za-z ]*?)(?:\s*\([A-Za-z][A-Za-z ]*\))?\s*\(([A-Z][A-Z0-9-]{1,10})\)/;
const PROGRAM_BARE_RE = /^Bachelor of Advanced Computing\b/i;

// N units of <noun phrase>. Each tail pattern below is tried in order after
// the head; the first to match wins.
const UNITS_HEAD_RE = /^(\d[\d,]*)\s*units?\s*/i;
const UNITS_CODE_LIST_RE = /^of\s*\(\s*([A-Z]{4}\s?\d{4}(?:\s*(?:or|OR|,|\/)\s*[A-Z]{4}\s?\d{4})*)\s*\)/;
const UNITS_LEVEL_RE =
  /^of\s*(\d{4})\s*(?:and\/or|\/|-)?\s*(\d{4})?\s*-?\s*level(?:s)?\s+\(?\s*([A-Z]+(?:\s*(?:OR|or)\s*[A-Z]+)*)\s*\)?(?:\s*(?:coded\s+)?courses?\b)?/;
const UNITS_FUSED_LEVEL_RE = /^of\s*([A-Z]+)(\d{4})\s*-\s*level\s+courses\b/;
const UNITS_PREFIX_RE = /^of\s*([A-Z]+?)(S)?\b(?:\s+(?:coded\s+)?courses\b)?/;
const UNITS_EXCLUDE_RE = /^\s*\(\s*excluding\s+([A-Z]{4}\s?\d{4})\s*\)/i;
const UNITS_EMPTY_RE = /^(?:of\s*)?(?:towards\s+a\s+degree|towards\s+their\b[^,.]*|(?:of\s*)?tertiary\s+(?:courses|study))\b/i;

interface AtomResult {
  node: ReqExpr;
  end: number;
}

function normalizeCode(raw: string): string {
  return raw.replace(/\s+/g, "");
}

function matchProgram(text: string, pos: number): AtomResult | null {
  const rest = text.slice(pos);
  const coded = PROGRAM_CODED_RE.exec(rest);
  if (coded) {
    const name = coded[1]!.trim();
    const code = coded[2]!;
    return {
      node: { kind: "program", code, name, satisfied: code === "AACOM" },
      end: pos + coded[0].length,
    };
  }
  const bare = PROGRAM_BARE_RE.exec(rest);
  if (bare) {
    return {
      node: { kind: "program", code: null, name: "Bachelor of Advanced Computing", satisfied: true },
      end: pos + bare[0].length,
    };
  }
  return null;
}

function matchConcurrent(text: string, pos: number): AtomResult | null {
  const m = CONCURRENT_RE.exec(text.slice(pos));
  if (!m) return null;
  return {
    node: { kind: "course", code: normalizeCode(m[1]!), concurrent: true },
    end: pos + m[0].length,
  };
}

function codeAtomAt(text: string, pos: number): AtomResult | null {
  const rest = text.slice(pos);
  const m = CODE_CORE_RE.exec(rest);
  if (!m) return null;
  const first = `${m[1]}${m[2]}`;
  let end = pos + m[0].length;
  const slash = CODE_SLASH_RE.exec(text.slice(end));
  if (slash) {
    const prefix = slash[1] ?? m[1]!;
    const second = `${prefix}${slash[2]}`;
    end += slash[0].length;
    return {
      node: { kind: "or", items: [
        { kind: "course", code: first, concurrent: false },
        { kind: "course", code: second, concurrent: false },
      ] },
      end,
    };
  }
  return { node: { kind: "course", code: first, concurrent: false }, end };
}

function matchCode(text: string, pos: number): AtomResult | null {
  const rest = text.slice(pos);
  const filler = ACTION_FILLER_RE.exec(rest);
  if (filler) {
    const r = codeAtomAt(text, pos + filler[0].length);
    if (r) return r;
  }
  return codeAtomAt(text, pos);
}

function splitPrefixList(raw: string): string[] {
  return raw
    .split(/\s*(?:OR|or)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function unitsCore(rest: string): { filter: CourseFilter; length: number } | null {
  const codeList = UNITS_CODE_LIST_RE.exec(rest);
  if (codeList) {
    const codes = codeList[1]!
      .split(/\s*(?:or|OR|,|\/)\s*/)
      .map((s) => normalizeCode(s.trim()))
      .filter(Boolean);
    return { filter: { codes }, length: codeList[0].length };
  }

  const level = UNITS_LEVEL_RE.exec(rest);
  if (level) {
    const min = Number(level[1]);
    const max = level[2] ? Number(level[2]) : min;
    return {
      filter: { prefixes: splitPrefixList(level[3]!), minLevel: Math.min(min, max), maxLevel: Math.max(min, max) },
      length: level[0].length,
    };
  }

  const fused = UNITS_FUSED_LEVEL_RE.exec(rest);
  if (fused) {
    const lvl = Number(fused[2]);
    return { filter: { prefixes: [fused[1]!], minLevel: lvl, maxLevel: lvl }, length: fused[0].length };
  }

  const prefix = UNITS_PREFIX_RE.exec(rest);
  if (prefix) {
    let length = prefix[0].length;
    let word = prefix[1]!;
    if (prefix[2] && word === "MATH") word = "MATH"; // "MATHS" -> "MATH"
    const filter: CourseFilter = { prefixes: [word] };
    const exclude = UNITS_EXCLUDE_RE.exec(rest.slice(length));
    if (exclude) {
      filter.excludeCodes = [normalizeCode(exclude[1]!)];
      length += exclude[0].length;
    }
    return { filter, length };
  }

  const empty = UNITS_EMPTY_RE.exec(rest);
  if (empty) {
    return { filter: {}, length: empty[0].length };
  }

  return null;
}

function matchUnits(text: string, pos: number): AtomResult | null {
  const rest = text.slice(pos);
  const filler = ACTION_FILLER_RE.exec(rest);
  const tryAt = (offset: number): AtomResult | null => {
    const head = UNITS_HEAD_RE.exec(text.slice(pos + offset));
    if (!head) return null;
    const units = Number(head[1]!.replace(/,/g, ""));
    const afterHead = pos + offset + head[0].length;
    const core = unitsCore(text.slice(afterHead));
    if (!core) return null;
    return {
      node: { kind: "units", units, filter: core.filter, text: text.slice(pos + offset, afterHead + core.length).trim() },
      end: afterHead + core.length,
    };
  };
  if (filler) {
    const r = tryAt(filler[0].length);
    if (r) return r;
  }
  return tryAt(0);
}

function matchParenGroup(text: string, pos: number, parse: (t: string, p: number) => AtomResult | null): AtomResult | null {
  if (text[pos] !== "(") return null;
  const inner = parse(text, pos + 1);
  if (!inner) return null;
  let end = inner.end;
  while (end < text.length && /\s/.test(text[end]!)) end++;
  if (text[end] !== ")") return null;
  return { node: inner.node, end: end + 1 };
}

// Word-boundary "and"/"or" is a real connective except: "N or above/below"
// (mark clauses) and the "and/or" compound (level ranges the units matcher
// missed) — both are absorbed as ordinary text instead of splitting.
const CONNECTIVE_SCAN_RE = /\(|\)|\band\/or\b|\bor\s+(?:above|below)\b|\b(and|AND|or|OR)\b|,/gi;

interface Connective {
  type: "AND" | "OR";
  start: number;
  end: number;
}

function nextConnective(text: string, from: number): Connective | null {
  CONNECTIVE_SCAN_RE.lastIndex = from;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = CONNECTIVE_SCAN_RE.exec(text))) {
    const token = m[0];
    if (token === "(") {
      depth++;
      continue;
    }
    if (token === ")") {
      if (depth === 0) return null; // closes an enclosing group, not ours
      depth--;
      continue;
    }
    if (depth > 0) continue;
    if (/^and\/or$/i.test(token) || /^or\s+(above|below)$/i.test(token)) continue; // absorbed, keep scanning
    if (token === ",") {
      // ", or" is one combined connective, not a comma-OR followed by a
      // redundant bare "or" (COMP4880: "completed COMP3670, or you must...").
      let end = m.index + token.length;
      const orAfter = /^\s*(?:or|OR)\b\s*/.exec(text.slice(end));
      if (orAfter) end += orAfter[0].length;
      return { type: "OR", start: m.index, end };
    }
    return { type: /and/i.test(token) ? "AND" : "OR", start: m.index, end: m.index + token.length };
  }
  return null;
}

function matchTextFallback(text: string, pos: number): AtomResult | null {
  let end = pos;
  while (end < text.length && /\s/.test(text[end]!)) end++;
  if (end >= text.length) return null;
  const conn = nextConnective(text, end);
  const stop = conn ? conn.start : text.length;
  const raw = text.slice(end, stop).trim();
  if (!raw) return null;
  return { node: { kind: "unverifiable", text: raw }, end: stop };
}

function skipWs(text: string, pos: number): number {
  let p = pos;
  while (p < text.length && /\s/.test(text[p]!)) p++;
  return p;
}

function parseAtom(text: string, rawPos: number): AtomResult | null {
  const pos = skipWs(text, rawPos);
  for (const matcher of [matchProgram, matchUnits, matchConcurrent, matchCode]) {
    const r = matcher(text, pos);
    if (r) return r;
  }
  const paren = matchParenGroup(text, pos, parseAndOuter);
  if (paren) return paren;
  return matchTextFallback(text, pos);
}

// Tightest binding: atoms joined with no connective at all (a code
// immediately followed by descriptive text, e.g. "MATH1115 with a mark of
// 60 or above") are implicitly AND'd together.
function parseAndInner(text: string, pos: number): AtomResult | null {
  const first = parseAtom(text, pos);
  if (!first) return null;
  const items: ReqExpr[] = [first.node];
  let end = first.end;
  while (true) {
    const p = skipWs(text, end);
    if (p >= text.length || text[p] === ")") break;
    const conn = nextConnective(text, p);
    if (conn && conn.start === p) break; // explicit connective right here — not implicit
    const next = parseAtom(text, p);
    if (!next) break;
    items.push(next.node);
    end = next.end;
  }
  return { node: items.length > 1 ? { kind: "and", items } : items[0]!, end };
}

// OR binds tighter than the outer AND (accepted over-strict on COMP4350's
// "either A or B and C" — see overview §2.4).
function parseOrMid(text: string, pos: number): AtomResult | null {
  const first = parseAndInner(text, pos);
  if (!first) return null;
  const items: ReqExpr[] = [first.node];
  let end = first.end;
  while (true) {
    const p = skipWs(text, end);
    const conn = nextConnective(text, p);
    if (!conn || conn.start !== p || conn.type !== "OR") break;
    const next = parseAndInner(text, conn.end);
    if (!next) break;
    items.push(next.node);
    end = next.end;
  }
  return { node: items.length > 1 ? { kind: "or", items } : items[0]!, end };
}

function parseAndOuter(text: string, pos: number): AtomResult | null {
  const first = parseOrMid(text, pos);
  if (!first) return null;
  const items: ReqExpr[] = [first.node];
  let end = first.end;
  while (true) {
    const p = skipWs(text, end);
    const conn = nextConnective(text, p);
    if (!conn || conn.start !== p || conn.type !== "AND") break;
    const next = parseOrMid(text, conn.end);
    if (!next) break;
    items.push(next.node);
    end = next.end;
  }
  return { node: items.length > 1 ? { kind: "and", items } : items[0]!, end };
}

function parseExpr(sentence: string): ReqExpr | null {
  const trimmed = sentence.trim();
  if (!trimmed) return null;
  const result = parseAndOuter(trimmed, 0);
  return result ? result.node : null;
}

function splitSentences(text: string): string[] {
  return text
    .split(/\n+/)
    .flatMap((line) => line.split(/\.\s+/))
    .map((s) => s.trim().replace(/\.$/, "").trim())
    .filter(Boolean);
}

function stripLeadIn(sentence: string): string {
  return sentence.replace(LEAD_IN_RE, "").trim();
}

function collectUnverifiable(node: ReqExpr | null, out: string[]): void {
  if (node === null) return;
  switch (node.kind) {
    case "and":
    case "or":
      for (const item of node.items) collectUnverifiable(item, out);
      return;
    case "unverifiable":
      out.push(node.text);
      return;
    default:
      return;
  }
}

function combineAnd(parts: ReqExpr[]): ReqExpr | null {
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0]!;
  const items: ReqExpr[] = [];
  for (const part of parts) {
    if (part.kind === "and") items.push(...part.items);
    else items.push(part);
  }
  return { kind: "and", items };
}

const CODE_RE_GLOBAL = /\b[A-Z]{4}\d{4}\b/g;

function matchAllCodes(text: string): string[] {
  return Array.from(text.matchAll(CODE_RE_GLOBAL), (m) => m[0]);
}

export function parseRequisites(input: { prerequisites: string; incompatibilities: string }): ParsedRequisites {
  const prereqSentences: string[] = [];
  const incompatBucket: string[] = [];
  const otherPrograms: string[] = [];

  const prereqText = input.prerequisites.trim();
  if (prereqText && prereqText !== "None") {
    for (const sentence of splitSentences(prereqText)) {
      if (INCOMPATIBLE_ROUTE_RE.test(sentence)) {
        incompatBucket.push(sentence);
      } else if (OTHER_PROGRAM_ROUTE_RE.test(sentence) && !NAMES_AACOM_RE.test(sentence)) {
        otherPrograms.push(sentence);
      } else {
        prereqSentences.push(sentence);
      }
    }
  }

  const incompatText = input.incompatibilities.trim();
  if (incompatText && incompatText !== "None") {
    incompatBucket.push(...splitSentences(incompatText));
  }

  const incompatible: string[] = [];
  const seenIncompat = new Set<string>();
  const unverifiable: string[] = [];
  for (const sentence of incompatBucket) {
    const codes = matchAllCodes(sentence);
    if (codes.length === 0) {
      unverifiable.push(sentence);
      continue;
    }
    for (const code of codes) {
      if (!seenIncompat.has(code)) {
        seenIncompat.add(code);
        incompatible.push(code);
      }
    }
  }

  const prereqParts: ReqExpr[] = [];
  for (const [i, sentence] of prereqSentences.entries()) {
    // A sentence split on ". " that begins with a bare connective (e.g.
    // COMP3310's "... COMP2300 . AND 6 units of ...") continues the same
    // top-level AND chain as the sentence before it.
    const stripped = i === 0 ? stripLeadIn(sentence) : sentence.replace(/^(?:AND|and|OR|or|,)\s*/, "");
    const node = parseExpr(stripped);
    if (node) prereqParts.push(node);
  }
  const prereq = combineAnd(prereqParts);

  collectUnverifiable(prereq, unverifiable);

  return {
    prereq,
    incompatible,
    unverifiable,
    otherPrograms,
    parseStatus: unverifiable.length > 0 ? "partial" : "ok",
  };
}
