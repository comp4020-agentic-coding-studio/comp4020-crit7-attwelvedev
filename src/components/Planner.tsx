import { useEffect, useRef, useState } from "preact/hooks";
import type { CourseDetailsView, PlanView } from "../lib/domain/view";
import { isError, placeCourse, removeCourse, setCutoff, setPin } from "./api";
import type { RemovedPlacement } from "./CourseCard";
import CompletedMenu from "./CompletedMenu";
import { type DetailsState, EMPTY_DETAILS, openCourse, withCourseParam } from "./details-state";
import MoreOptions from "./MoreOptions";
import {
  applyReqsState,
  applySplit,
  DEFAULT_REQS,
  DEFAULT_SPLIT,
  parseSplit,
  type ReqsState,
  reqsStateFromDataset,
  saveReqsState,
  saveSplit,
  type SplitStop,
} from "./panel-state";
import { completedReadout, dropTargets } from "./planner-logic";
import { useReqsFit } from "./reqs-fit";
import ReqsResizeHandle from "./ReqsResizeHandle";
import Sidebar, { type ShowRequest } from "./Sidebar";
import type { Panels } from "./split-resize";
import Timeline from "./Timeline";
import { useTouchDrag } from "./touch-drag";

// How long "Undo" stays offered after a Remove — long enough to notice and
// act on without thinking, short enough that it isn't still sitting there
// (offering to restore a now-stale course) minutes into unrelated work.
const UNDO_TIMEOUT_MS = 8000;

// The More options and completed-semesters panels share openMenuCode with
// the course menus, so only one is ever open; course codes (four letters,
// four digits) never look like these.
const MORE_OPTIONS = "more-options";
const COMPLETED_MENU = "completed-menu";

interface Props {
  view: PlanView;
  title: string;
  // The ?course= course, rendered on the server so the sidebar is there
  // from the first paint.
  initialDetails?: CourseDetailsView | null;
}

export default function Planner({ view: initialView, title, initialDetails = null }: Props) {
  const [view, setView] = useState(initialView);
  const [details, setDetails] = useState<DetailsState>(() =>
    initialDetails ? openCourse(EMPTY_DETAILS, initialDetails.course.code) : EMPTY_DETAILS,
  );
  // replaceState, not pushState: stepping through courses shouldn't fill
  // the browser's own history, and the URL only has to be shareable.
  useEffect(() => {
    history.replaceState(null, "", withCourseParam(location.href, details.code));
  }, [details.code]);
  const [announcement, setAnnouncement] = useState("");
  const [draggingCode, setDraggingCode] = useState<string | null>(null);
  // Hard-blocked terms of every course search has returned, by code: a
  // result outside the plan's tree has no view.courses entry, so without
  // this a drag of it would grey nothing. Feasibility depends only on the
  // catalogue, never the plan, so an entry never goes stale.
  const [searchBlocked, setSearchBlocked] = useState<Record<string, Record<number, string>>>({});
  // Likewise whether each searched course is two-semester, so dragging one
  // from search outlines both of the terms it would take.
  const [searchTwoSemester, setSearchTwoSemester] = useState<Record<string, boolean>>({});
  const [showPrereqLinks, setShowPrereqLinks] = useState(false);
  const [openMenuCode, setOpenMenuCode] = useState<string | null>(null);
  const [locateRequest, setLocateRequest] = useState<{ code: string; token: number; part?: 2 } | null>(null);
  const [showRequest, setShowRequest] = useState<ShowRequest | null>(null);
  // The sidebar group whose heading is under hover or focus; the timeline
  // recedes every card outside it.
  const [focusGroupId, setFocusGroupId] = useState<string | null>(null);
  const [removed, setRemoved] = useState<RemovedPlacement | null>(null);
  const [cutoffPending, setCutoffPending] = useState(false);
  const [undoPending, setUndoPending] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const plannerRef = useRef<HTMLDivElement>(null);
  const panesRef = useRef<HTMLDivElement>(null);
  const fit = useReqsFit(panesRef);
  const readOnly = view.plan.readOnly;

  const [reqs, setReqs] = useState<ReqsState>(DEFAULT_REQS);
  const [split, setSplit] = useState<SplitStop>(DEFAULT_SPLIT);
  // The <head> script already painted the stored state; this just brings
  // Preact's copy in line after hydration (server render + first client
  // render stay equal, as with Sidebar's compaction state).
  useEffect(() => {
    setReqs(reqsStateFromDataset(document.documentElement.dataset));
    setSplit(parseSplit(document.documentElement.dataset.split));
  }, []);
  function updateReqs(next: ReqsState, commit: boolean) {
    setReqs(next);
    applyReqsState(document.documentElement, next);
    if (commit) saveReqsState(next);
  }

  // Revealing a hidden sidebar is Planner's job; Sidebar does the rest
  // (expanding the section, scrolling, focus, highlight) from the request.
  function showInSidebar(kind: ShowRequest["kind"], id: string) {
    if (reqs.collapsed) updateReqs({ ...reqs, collapsed: false }, true);
    setShowRequest({ kind, id, token: Date.now() });
  }

  function updatePanels(next: Panels, commit: boolean) {
    updateReqs(next.reqs, commit);
    setSplit(next.split);
    applySplit(document.documentElement, next.split);
    if (commit) saveSplit(next.split);
  }

  async function changeCutoff(next: number) {
    if (next < 0 || next > view.terms.length) return;
    setCutoffPending(true);
    try {
      const result = await setCutoff(view.plan.id, next);
      if (isError(result)) setAnnouncement(result.error);
      else setView(result);
    } finally {
      setCutoffPending(false);
    }
  }

  // The plan's own URL is the only way back to it (see the homepage and
  // Help copy) — this is the in-planner equivalent of "bookmark this",
  // for whoever's already here and would rather not hunt in the address
  // bar. navigator.clipboard needs a secure context; on the rare browser
  // where it's unavailable, say so rather than pretend it worked.
  async function copyPlanLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setAnnouncement("Plan link copied to clipboard");
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setAnnouncement("Couldn't copy the link automatically — copy it from the address bar instead");
    }
  }

  function handleRemoved(info: RemovedPlacement) {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setRemoved(info);
    undoTimer.current = setTimeout(() => setRemoved(null), UNDO_TIMEOUT_MS);
  }

  // The touch-drag drop handler for both "place/move" and "remove". Placing
  // mirrors Timeline's native onDrop, reimplemented here because touch
  // dragging resolves its drop target through elementFromPoint at the
  // planner level, not inside whichever column the pointer is over. Removal
  // is shared: Sidebar's native onDrop calls performRemove too, so a mouse
  // drop offers the same undo toast as a touch drop.
  async function performPlace(term: number, code: string) {
    const target = dropTargets(view, code, searchBlocked[code]).find((t) => t.term === term);
    if (target && !target.allowed) {
      if (target.reason) setAnnouncement(target.reason);
      return;
    }
    const result = await placeCourse(view.plan.id, code, term);
    if (isError(result)) setAnnouncement(result.error);
    else setView(result);
  }

  async function performRemove(code: string) {
    const placement = view.placements.find((p) => p.code === code);
    if (!placement) return;
    const course = view.courses[code];
    const info: RemovedPlacement = {
      code,
      term: placement.term,
      pinnedGroupId: placement.pinned ? (placement.countsToward ?? null) : null,
      label: course ? `${code} — ${course.title}` : code,
    };
    const result = await removeCourse(view.plan.id, code);
    if (isError(result)) setAnnouncement(result.error);
    else {
      setView(result);
      handleRemoved(info);
    }
  }

  // Re-placing a course always lands it unpinned (placeCourse's insert
  // always does) — restoring the pin it had, if any, is a deliberate
  // second call, not a side effect of the first.
  async function handleUndo() {
    if (!removed || undoPending) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const { code, term, pinnedGroupId, label } = removed;
    setUndoPending(true);
    setRemoved(null);
    try {
      const placed = await placeCourse(view.plan.id, code, term);
      if (isError(placed)) {
        setAnnouncement(placed.error);
        return;
      }
      if (!pinnedGroupId) {
        setView(placed);
      } else {
        const pinned = await setPin(view.plan.id, code, pinnedGroupId);
        setView(isError(pinned) ? placed : pinned);
      }
      setAnnouncement(`Restored ${label}`);
    } finally {
      setUndoPending(false);
    }
  }

  const readout = completedReadout(view.plan.cutoff, view.terms);

  useTouchDrag(plannerRef, {
    onDragStart: setDraggingCode,
    onDragEnd: () => setDraggingCode(null),
    onDrop: (target, code) => {
      if (target.kind === "term") void performPlace(target.term, code);
      else void performRemove(code);
    },
  });

  return (
    <div class="planner" data-cutoff={view.plan.cutoff} ref={plannerRef}>
      <p aria-live="polite" class="visually-hidden">
        {announcement}
      </p>
      {/* The plan page is a workspace, so its title row also carries the plan's own controls, leaving the timeline nothing above it. */}
      <div class="plan-title">
        <div class="plan-title-main">
          <h1>{title}</h1>
          {readOnly && (
            <p role="note" class="plan-badge">
              This is an example — Start your own plan
            </p>
          )}
        </div>
        <div class="plan-actions">
          <div class="completed-control" aria-busy={cutoffPending}>
            {readOnly ? (
              <>
                <span class="completed-readout" aria-hidden="true">
                  {readout.short}
                </span>
                <span class="visually-hidden">{readout.full}</span>
              </>
            ) : (
              <CompletedMenu
                view={view}
                open={openMenuCode === COMPLETED_MENU}
                onOpenChange={(next) => setOpenMenuCode(next ? COMPLETED_MENU : null)}
                onChoose={(next) => void changeCutoff(next)}
                pending={cutoffPending}
              />
            )}
          </div>
          <MoreOptions
            open={openMenuCode === MORE_OPTIONS}
            onOpenChange={(next) => setOpenMenuCode(next ? MORE_OPTIONS : null)}
          >
            <label class="show-links-toggle">
              <input
                type="checkbox"
                checked={showPrereqLinks}
                onChange={(event) => setShowPrereqLinks((event.target as HTMLInputElement).checked)}
              />
              Show prerequisite links
            </label>
            {!readOnly && (
              <button type="button" onClick={copyPlanLink}>
                {linkCopied ? "Copied!" : "Copy plan link"}
              </button>
            )}
          </MoreOptions>
        </div>
      </div>
      {/* Size container for the panes; the fixed undo toast stays outside it, since containment would pin it to the container. */}
      <div class="planner-layout">
        <div class="planner-panes" ref={panesRef}>
          <div class="planner-timeline-area">
            <Timeline
              view={view}
              planId={view.plan.id}
              draggingCode={draggingCode}
              draggingBlocked={draggingCode ? searchBlocked[draggingCode] : undefined}
              draggingTwoSemester={
                draggingCode
                  ? (view.courses[draggingCode]?.twoSemester ?? searchTwoSemester[draggingCode] ?? false)
                  : false
              }
              onChanged={setView}
              onAnnounce={setAnnouncement}
              onDragStart={setDraggingCode}
              onDragEnd={() => setDraggingCode(null)}
              showPrereqLinks={showPrereqLinks}
              openMenuCode={openMenuCode}
              onMenuOpenChange={(code, next) => setOpenMenuCode(next ? code : null)}
              onRemoved={handleRemoved}
              locateRequest={locateRequest}
              onLocateCourse={(code, part) => setLocateRequest({ code, part, token: Date.now() })}
              onShowGroup={(id) => showInSidebar("group", id)}
              focusGroupId={focusGroupId}
            />
          </div>
          <Sidebar
            view={view}
            planId={view.plan.id}
            onChanged={setView}
            onAnnounce={setAnnouncement}
            onDragStart={setDraggingCode}
            onDragEnd={() => setDraggingCode(null)}
            onSearchResults={(courses) => {
              setSearchBlocked((prev) => ({
                ...prev,
                ...Object.fromEntries(courses.map((course) => [course.code, course.hardBlocked])),
              }));
              setSearchTwoSemester((prev) => ({
                ...prev,
                ...Object.fromEntries(courses.map((course) => [course.code, course.twoSemester])),
              }));
            }}
            openMenuCode={openMenuCode}
            onMenuOpenChange={(code, next) => setOpenMenuCode(next ? code : null)}
            onLocateCourse={(code, part) => setLocateRequest({ code, part, token: Date.now() })}
            onHide={() => updateReqs({ ...reqs, collapsed: true }, true)}
            onShow={() => updateReqs({ ...reqs, collapsed: false }, true)}
            dropReady={draggingCode !== null && view.placements.some((p) => p.code === draggingCode)}
            onDropRemove={(code) => void performRemove(code)}
            showRequest={showRequest}
            onShowInSidebar={showInSidebar}
            onFocusGroup={setFocusGroupId}
          />
          <ReqsResizeHandle reqs={reqs} split={split} fit={fit} onChange={updatePanels} />
        </div>
      </div>
      {removed && (
        <div class={fit === 0 && reqs.collapsed ? "undo-toast undo-toast-above-bar" : "undo-toast"} role="status">
          <span>Removed {removed.label}.</span>
          <button type="button" disabled={undoPending} onClick={handleUndo}>
            {undoPending ? "Restoring…" : "Undo"}
          </button>
        </div>
      )}
    </div>
  );
}
