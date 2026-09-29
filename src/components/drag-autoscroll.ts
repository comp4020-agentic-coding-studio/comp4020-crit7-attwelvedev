// How far a drag held near a scroller's edge scrolls it each frame. The
// browser's own drag autoscroll only starts in a thin band right at a
// scroller's edge, and only for a mouse drag, with the pointer over the
// scroller itself: the dividers' hit areas overlap the timeline's edges,
// and touch drags (touch-drag.ts) get none at all. So the timeline scrolls
// itself, from wherever the pointer is. Pure, so it runs in node.

// The zone inside each edge where a drag scrolls, and the fastest it goes
// (px per frame), reached right at the edge.
export const EDGE_ZONE_PX = 48;
export const MAX_STEP_PX = 18;

// Negative toward `start`, positive toward `end`, 0 away from both or
// outside the scroller. The speed ramps with how deep into the zone the
// pointer is, so easing off the edge slows it down.
export function edgeStep(pos: number, start: number, end: number): number {
  if (pos < start || pos > end) return 0;
  // A small scroller's zones never meet in the middle.
  const zone = Math.min(EDGE_ZONE_PX, (end - start) / 4);
  const depth = pos < start + zone ? (start + zone - pos) / zone : pos > end - zone ? (pos - (end - zone)) / zone : 0;
  if (depth <= 0) return 0;
  const step = Math.max(1, Math.round(depth * MAX_STEP_PX));
  return pos < start + zone ? -step : step;
}
