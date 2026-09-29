// The phone's details sheet rests at one of three heights (WR44): a peek
// that shows only its header, half the screen, or all of it but a sliver
// at the top. Pure, so the handle's tap and drag rules run in node.

export type Detent = "peek" | "half" | "full";

const ORDER: Detent[] = ["peek", "half", "full"];

// A tap on the handle steps up through the heights, then back to the peek.
export function nextDetent(d: Detent): Detent {
  return ORDER[(ORDER.indexOf(d) + 1) % ORDER.length];
}

// The peek is the header (its button row, code and title) clear of the
// tab bar floating over the sheet's foot; styles.css holds the same
// number. Full stands 8px in from the top and bottom, so it still reads
// as a sheet.
export const PEEK_PX = 204;

export function detentHeights(viewportPx: number): Record<Detent, number> {
  return { peek: PEEK_PX, half: 0.56 * viewportPx, full: viewportPx - 16 };
}

// Where a released drag settles: whichever height is closest.
export function nearestDetent(heightPx: number, viewportPx: number): Detent {
  const heights = detentHeights(viewportPx);
  return ORDER.reduce((best, d) =>
    Math.abs(heights[d] - heightPx) < Math.abs(heights[best] - heightPx) ? d : best,
  );
}
