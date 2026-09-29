import type { RefObject } from "preact";
import { useEffect, useState } from "preact/hooks";

// The element's content-box width, which is what the planner's container
// queries measure too. 0 until mounted: the server render and the first
// client render can't know it, so callers treat 0 as "not measured yet".
export function useContainerWidth(ref: RefObject<HTMLElement>): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return width;
}
