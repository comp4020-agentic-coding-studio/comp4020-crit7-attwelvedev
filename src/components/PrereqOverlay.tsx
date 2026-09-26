import { useLayoutEffect, useRef, useState } from "preact/hooks";
import type { PlanView } from "../lib/domain/view";
import { overlayEdges } from "./planner-logic";

interface Props {
  view: PlanView;
  show: boolean;
}

interface Line {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Draws thin lines between every placed course and its already-placed
// prerequisites, all at once when `show` is on (a hover-only overlay made it
// hard to trace a line spanning several off-screen terms — you lose it the
// moment you stop hovering the source card to scroll). Lives inside
// `.timeline-scroll` (its `position: relative` containing block), sized to
// the full scrollable content so lines stay put under the cards as the
// timeline scrolls.
export default function PrereqOverlay({ view, show }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [lines, setLines] = useState<Line[]>([]);

  // Measuring card positions has to happen in a layout effect, not during
  // render: a render only builds the next tree, it doesn't move any cards
  // yet, so a getBoundingClientRect() call made while rendering reads
  // wherever the DOM was left by the *previous* commit (e.g. a just-removed
  // card that hasn't reappeared yet, or one about to move column) — every
  // line lagged one update behind, and a remove-then-replace in the same
  // spot produced a line anchored to a card that briefly didn't exist.
  // useLayoutEffect runs after the DOM has actually been patched to match
  // this render, so it measures the real, current positions.
  useLayoutEffect(() => {
    const svg = svgRef.current;
    const scroll = svg?.parentElement;
    if (!svg || !scroll) {
      setLines([]);
      return;
    }
    svg.setAttribute("width", String(scroll.scrollWidth));
    svg.setAttribute("height", String(scroll.scrollHeight));

    function centreOf(code: string): { x: number; y: number } | null {
      const el = scroll!.querySelector(`[data-placed="${code}"]`);
      if (!el) return null;
      const elRect = el.getBoundingClientRect();
      const scrollRect = scroll!.getBoundingClientRect();
      return {
        x: elRect.left - scrollRect.left + scroll!.scrollLeft + elRect.width / 2,
        y: elRect.top - scrollRect.top + scroll!.scrollTop + elRect.height / 2,
      };
    }

    const edges = show ? view.placements.flatMap((p) => overlayEdges(view, p.code)) : [];
    const next: Line[] = [];
    for (const edge of edges) {
      const from = centreOf(edge.from);
      const to = centreOf(edge.to);
      if (from && to) next.push({ key: `${edge.from}-${edge.to}`, x1: from.x, y1: from.y, x2: to.x, y2: to.y });
    }
    setLines(next);
  }, [view, show]);

  return (
    <svg ref={svgRef} class="prereq-overlay" aria-hidden="true">
      {lines.map((line) => (
        <line key={line.key} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
      ))}
    </svg>
  );
}
