import type { ReqExpr } from "./types";

// A verify item is often a fragment of the sentence it was parsed from:
// MATH1116's "with a mark of 60 or above" only makes sense next to the
// MATH1115 it's AND'ed with. The parser gives a code directly followed by
// its qualifier as an AND of just those two, so only that shape is
// labelled "<CODE> <text>" — a sentence-level AND can also hold a single
// course (COMP4820's COMP2100) whose items have nothing to do with it. Any
// other item keeps its text. Display only — answers are keyed by the raw text.
export function verifyItemLabels(prereq: ReqExpr | null, items: string[]): Map<string, string> {
  const labels = new Map<string, string>();

  function walk(node: ReqExpr): void {
    if (node.kind !== "and" && node.kind !== "or") return;
    if (node.kind === "and" && node.items.length === 2) {
      const course = node.items.find((item) => item.kind === "course");
      const unverifiable = node.items.find((item) => item.kind === "unverifiable");
      if (course?.kind === "course" && unverifiable?.kind === "unverifiable") {
        labels.set(unverifiable.text, `${course.code} ${unverifiable.text}`);
      }
    }
    for (const item of node.items) walk(item);
  }

  if (prereq) walk(prereq);
  return new Map(items.map((item) => [item, labels.get(item) ?? item]));
}
