import { useEffect, useState } from "preact/hooks";
import type { CourseDetailsView } from "../lib/domain/view";
import { fetchCourseDetails } from "./api";

export interface CourseDetailsFetch {
  status: "idle" | "loading" | "ready" | "error";
  data: CourseDetailsView | null;
}

// Details are catalogue data, so a course fetched once stays good for the
// page's life; going back to it in the sidebar's history shows it at once.
// Keyed by plan too, since the card's eligible groups follow its choices.
// Client-only: the server never writes here, so one request's plan can't
// leak into another's render.
const cache = new Map<string, CourseDetailsView>();

const keyOf = (planId: string, code: string) => `${planId}/${code}`;

export function useCourseDetails(
  code: string | null,
  planId: string,
  initial: CourseDetailsView | null,
): CourseDetailsFetch {
  // Read in render, not only after an effect, so the server render and the
  // first client render of a ?course= page already show the full details.
  const seeded = code !== null && initial?.course.code === code ? initial : null;
  const cached = code === null ? null : (cache.get(keyOf(planId, code)) ?? seeded);
  const [failed, setFailed] = useState<string | null>(null);
  // Bumped when a fetch lands, to re-render and pick it up from the cache.
  const [, setLoaded] = useState(0);

  useEffect(() => {
    if (initial) cache.set(keyOf(planId, initial.course.code), initial);
  }, [initial, planId]);

  useEffect(() => {
    if (code === null || cache.has(keyOf(planId, code)) || seeded) return;
    // A newer code (or closing) makes this fetch's answer stale: drop it
    // rather than let a slow response overwrite what's now open.
    let stale = false;
    setFailed(null);
    fetchCourseDetails(code, planId)
      .then((result) => {
        if (stale) return;
        if ("error" in result) setFailed(code);
        else {
          cache.set(keyOf(planId, code), result);
          setLoaded((n) => n + 1);
        }
      })
      .catch(() => {
        if (!stale) setFailed(code);
      });
    return () => {
      stale = true;
    };
  }, [code, planId]);

  if (code === null) return { status: "idle", data: null };
  if (cached) return { status: "ready", data: cached };
  return { status: failed === code ? "error" : "loading", data: null };
}
