import type { CheckAnswer } from "../lib/domain/types";
import type { VerifyCheck } from "../lib/domain/evaluate";
import type { TreeStatus } from "./planner-logic";

interface Props {
  node: TreeStatus;
  // False for a course that isn't placed: nothing has been evaluated, so no
  // node claims met or not met.
  marks: boolean;
  checks: VerifyCheck[]; // placement.checks, or [] when unplaced
  disabled: boolean; // read-only or a save in flight
  pending: { item: string; value: CheckAnswer | null } | null;
  onAnswer: (item: string, value: CheckAnswer | null) => void;
  onOpen: (code: string) => void; // a course leaf's code link
  // Whether a leaf's course has details to open; one that doesn't stays text
  // rather than a button that does nothing.
  canOpen: (code: string) => boolean;
  // A course leaf's title (when known) and where it sits in this plan:
  // "Completed S1 2027", "Planned S2 2028", "Not in your plan".
  courseInfo: (code: string) => { title: string | null; where: string };
}

const ANSWERS: [CheckAnswer | null, string][] = [
  ["met", "Met"],
  ["not-met", "Not met"],
  [null, "Not sure"],
];

function Mark({ ok }: { ok: boolean | null }) {
  const [glyph, label] = ok === null ? ["?", "Needs your check"] : ok ? ["✓", "Met"] : ["✗", "Not met"];
  return (
    <span class={`mark mark-${ok === null ? "unknown" : ok ? "met" : "unmet"}`}>
      <span aria-hidden="true">{glyph}</span>
      <span class="visually-hidden">{label}</span>
    </span>
  );
}

// The requisite tree, with each check the planner can't make answered on
// its own node, so the question sits beside the rule it belongs to.
export default function RequisiteTree(props: Props) {
  return (
    <ul class="requisite-tree">
      <Node {...props} />
    </ul>
  );
}

function Node(props: Props) {
  const { node, marks, checks, disabled, pending, onAnswer } = props;
  // Unmarked, a plain dot keeps each rule's place on the guide line.
  const mark = marks ? <Mark ok={node.ok} /> : <span class="mark-dot" aria-hidden="true" />;

  if (node.kind === "and" || node.kind === "or") {
    return (
      <li>
        <span class="requisite-line">
          {mark}
          {node.kind === "and" ? "All of" : "One of"}
        </span>
        <ul>
          {node.items.map((item, i) => (
            <Node key={i} {...props} node={item} />
          ))}
        </ul>
      </li>
    );
  }
  if (node.kind === "course") {
    const info = props.courseInfo(node.code);
    return (
      <li>
        <span class="requisite-line">
          {mark}
          <span>
            {props.canOpen(node.code) ? (
              <button type="button" class="requisite-code" onClick={() => props.onOpen(node.code)}>
                {node.code}
              </button>
            ) : (
              <strong>{node.code}</strong>
            )}
            {info.title && ` ${info.title}`}
            {node.concurrent ? " (may be taken concurrently)" : ""}
            <span class="requisite-where">{info.where}</span>
          </span>
        </span>
      </li>
    );
  }
  if (node.kind === "units" || node.kind === "program") {
    return (
      <li>
        <span class="requisite-line">
          {mark}
          {node.kind === "units" ? node.text : node.name}
        </span>
      </li>
    );
  }

  // The answer key is the leaf's own text (evaluate.ts reads answers by it).
  const check = checks.find((c) => c.item === node.text);
  const chosen = check ? (pending?.item === check.item ? pending.value : check.answer) : null;
  return (
    <li>
      <span class="requisite-line">
        {mark}
        {check?.label ?? node.text}
      </span>
      {check && (
        <>
          <div class="requisite-answer" role="group" aria-label={check.label}>
            {ANSWERS.map(([value, text]) => (
              <button
                key={text}
                type="button"
                aria-pressed={chosen === value}
                disabled={disabled}
                onClick={() => onAnswer(check.item, value)}
              >
                {text}
              </button>
            ))}
          </div>
          {check.answer !== null && <small class="requisite-marked">Marked by you</small>}
        </>
      )}
    </li>
  );
}
