import { useEffect, useRef } from "preact/hooks";
import type { PlanView } from "../lib/domain/view";
import { overlayEdges } from "./planner-logic";

interface Props {
  view: PlanView;
  show: boolean;
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
  const scroll = svgRef.current?.parentElement;

  const edges = show ? view.placements.flatMap((p) => overlayEdges(view, p.code)) : [];

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !scroll) return;
    svg.setAttribute("width", String(scroll.scrollWidth));
    svg.setAttribute("height", String(scroll.scrollHeight));
  });

  function centreOf(code: string): { x: number; y: number } | null {
    if (!scroll) return null;
    const el = scroll.querySelector(`[data-placed="${code}"]`);
    if (!el) return null;
    const elRect = el.getBoundingClientRect();
    const scrollRect = scroll.getBoundingClientRect();
    return {
      x: elRect.left - scrollRect.left + scroll.scrollLeft + elRect.width / 2,
      y: elRect.top - scrollRect.top + scroll.scrollTop + elRect.height / 2,
    };
  }

  return (
    <svg ref={svgRef} class="prereq-overlay" aria-hidden="true">
      {edges.map((edge) => {
        const from = centreOf(edge.from);
        const to = centreOf(edge.to);
        if (!from || !to) return null;
        return <line key={`${edge.from}-${edge.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
      })}
    </svg>
  );
}
