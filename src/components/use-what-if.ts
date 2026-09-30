import { useEffect, useState } from "preact/hooks";
import type { PlanView } from "../lib/domain/view";
import type { WhatIfView } from "../lib/domain/what-if";
import { fetchWhatIf } from "./api";

export interface WhatIfFetch {
  status: "idle" | "loading" | "ready" | "error";
  data: WhatIfView | null;
  retry: () => void;
}

// The what-if for an unchosen option, asked again on every new PlanView
// (each plan change is a new object), since any change can move what counts.
// optionId null (the chosen spec) asks nothing.
export function useWhatIf(planId: string, groupId: string, optionId: string | null, view: PlanView): WhatIfFetch {
  const [data, setData] = useState<WhatIfView | null>(null);
  const [status, setStatus] = useState<WhatIfFetch["status"]>("idle");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (optionId === null) {
      setStatus("idle");
      return;
    }
    // A newer view or option (or closing) makes this answer stale: drop it
    // rather than let a slow response overwrite a newer one.
    let stale = false;
    setStatus("loading");
    fetchWhatIf(planId, groupId, optionId)
      .then((result) => {
        if (stale) return;
        if ("error" in result) setStatus("error");
        else {
          setData(result);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!stale) setStatus("error");
      });
    return () => {
      stale = true;
    };
  }, [planId, groupId, optionId, view, attempt]);

  // The last answer stays up while the next loads, so the block doesn't
  // jump, but only for the same option: another spec's figures would mislead.
  const shown = data && data.groupId === groupId && data.optionId === optionId ? data : null;
  return { status: optionId === null ? "idle" : status, data: shown, retry: () => setAttempt((n) => n + 1) };
}
