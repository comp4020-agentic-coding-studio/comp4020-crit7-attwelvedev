import type { RefObject } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { ReqsColumns } from "./panel-state";
import { parseFit } from "./reqs-resize";

// How many requirement columns the panes fit, or 0 in the stacked layout.
// It lives in Planner because the undo toast, outside the size container,
// needs it too.
export function useReqsFit(panesRef: RefObject<HTMLElement>): 0 | ReqsColumns {
  // Starts at 3 so the server render and the first client render agree; the
  // observer below corrects it once the panes have a real width.
  const [fit, setFit] = useState<0 | ReqsColumns>(3);

  // The CSS tiers already decide how many columns fit and publish it as
  // --reqs-fit on the panes, so reading it back keeps CSS the single source
  // of truth rather than repeating the tier thresholds here.
  useEffect(() => {
    const panes = panesRef.current;
    if (!panes) return;
    const read = () => setFit(parseFit(getComputedStyle(panes).getPropertyValue("--reqs-fit")));
    read();
    const observer = new ResizeObserver(read);
    observer.observe(panes);
    return () => observer.disconnect();
  }, []);

  return fit;
}
