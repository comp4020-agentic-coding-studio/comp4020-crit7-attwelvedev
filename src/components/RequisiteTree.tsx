import type { RequisiteStatus } from "../lib/domain/evaluate";

interface Props {
  node: RequisiteStatus;
}

function statusText(ok: boolean | null): string {
  return ok === null ? "not checked" : ok ? "✓ met" : "✗ not met";
}

export default function RequisiteTree({ node }: Props) {
  if (node.kind === "and" || node.kind === "or") {
    return (
      <li>
        {node.kind === "and" ? "All of" : "One of"}: {statusText(node.ok)}
        <ul>
          {node.items.map((item, i) => (
            <RequisiteTree key={i} node={item} />
          ))}
        </ul>
      </li>
    );
  }
  if (node.kind === "course") {
    return (
      <li>
        {node.code}
        {node.concurrent ? " (may be taken concurrently)" : ""}: {statusText(node.ok)}
      </li>
    );
  }
  if (node.kind === "units") {
    return (
      <li>
        {node.text}: {statusText(node.ok)}
      </li>
    );
  }
  if (node.kind === "program") {
    return (
      <li>
        {node.name}: {statusText(node.ok)}
      </li>
    );
  }
  return (
    <li>
      {node.text}:{" "}
      {node.answer === "met" ? "✓ met (marked by you)" : node.answer === "not-met" ? "✗ not met (marked by you)" : "not checked"}
    </li>
  );
}
