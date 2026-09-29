import { useEffect, useRef, useState } from "preact/hooks";
import type { CourseCard, CourseDetailsView, PlanView } from "../lib/domain/view";
import { isError, placeCourse, removeCourse, setCheck, setChoice, setCutoff, setPin } from "./api";
import CompletedMenu from "./CompletedMenu";
import CourseDetailsPanel from "./CourseDetailsPanel";
import {
  closeDetails,
  type DetailsFocus,
  type DetailsState,
  EMPTY_DETAILS,
  openCourse,
  stepHistory,
  withCourseParam,
} from "./details-state";
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
import {
  actedOn,
  actionFor,
  changesNothing,
  historyStep,
  knockOnText,
  newlyBroken,
  type PlanAction,
} from "./plan-actions";
import { completedReadout, dropTargets, linkedHighlights } from "./planner-logic";
import { useReqsFit } from "./reqs-fit";
import ReqsResizeHandle from "./ReqsResizeHandle";
import Sidebar, { type ShowRequest } from "./Sidebar";
import type { Panels } from "./split-resize";
import Timeline, { type LocateRequest } from "./Timeline";
import { useTouchDrag } from "./touch-drag";
import { EMPTY_HISTORY, type History, recordStep, redoStep, undoStep } from "./undo-history";
import { useCourseDetails } from "./use-course-details";

// How long "Undo" stays offered after a change — long enough to notice and
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
  // Token 0 marks the server-rendered open: the page just loaded on it, so
  // nothing asked for focus to move there.
  const [details, setDetails] = useState<DetailsState>(() =>
    initialDetails ? { ...openCourse(EMPTY_DETAILS, initialDetails.course.code), token: 0 } : EMPTY_DETAILS,
  );
  // replaceState, not pushState: stepping through courses shouldn't fill
  // the browser's own history, and the URL only has to be shareable.
  // (window. because `history` below is the plan's undo history.)
  useEffect(() => {
    window.history.replaceState(null, "", withCourseParam(location.href, details.code));
  }, [details.code]);
  const fetched = useCourseDetails(details.code, initialView.plan.id, initialDetails);
  // Cards for courses outside view.courses (search results, or anything
  // fetched for the sidebar), so the sidebar can show them from the plan's
  // side too. Catalogue data, so an entry never goes stale.
  const [knownCards, setKnownCards] = useState<Record<string, CourseCard>>(() =>
    initialDetails ? { [initialDetails.course.code]: initialDetails.course } : {},
  );
  useEffect(() => {
    const course = fetched.data?.course;
    if (course) setKnownCards((prev) => (prev[course.code] ? prev : { ...prev, [course.code]: course }));
  }, [fetched.data]);
  // What had focus before the sidebar opened, so Close can hand it back.
  const openerRef = useRef<HTMLElement | null>(null);
  function openDetails(code: string, focus: DetailsFocus = "top") {
    if (details.code === null && document.activeElement instanceof HTMLElement) {
      openerRef.current = document.activeElement;
    }
    setDetails((s) => openCourse(s, code, focus));
    // Show where a placed course sits, without taking focus from the panel.
    if (view.placements.some((p) => p.code === code)) setLocateRequest({ code, token: Date.now(), focus: false });
  }
  useEffect(() => {
    if (details.code !== null || !openerRef.current) return;
    if (openerRef.current.isConnected) openerRef.current.focus();
    openerRef.current = null;
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
  const [locateRequest, setLocateRequest] = useState<LocateRequest | null>(null);
  const [showRequest, setShowRequest] = useState<ShowRequest | null>(null);
  // The sidebar group whose heading is under hover or focus; the timeline
  // recedes every card outside it.
  const [focusGroupId, setFocusGroupId] = useState<string | null>(null);
  // The one toast: the latest edit or redo ("edit", offering Undo), or the
  // latest undo ("undone", offering Redo).
  const [toast, setToast] = useState<{ mode: "edit" | "undone"; message: string; knockOn: string } | null>(null);
  const [history, setHistory] = useState<History>(EMPTY_HISTORY);
  // Edits, undos and redos queued or running; Undo and Redo wait for none.
  const [busy, setBusy] = useState(0);
  const [historyPending, setHistoryPending] = useState<"undo" | "redo" | null>(null);
  const [cutoffPending, setCutoffPending] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The toast's timeout waits while the pointer is over it or focus is in
  // it (WCAG 2.2.1), so reading it and reaching Undo can't be cut short.
  const undoHeld = useRef({ hover: false, focus: false });
  const plannerRef = useRef<HTMLDivElement>(null);
  const panesRef = useRef<HTMLDivElement>(null);
  const fit = useReqsFit(panesRef);
  const readOnly = view.plan.readOnly;
  // Queued work runs after renders it wasn't called from, so it reads the
  // latest view and history from these rather than from its own closure.
  const viewRef = useRef(view);
  const historyRef = useRef(history);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  function commitView(next: PlanView) {
    viewRef.current = next;
    setView(next);
  }
  function commitHistory(next: History) {
    historyRef.current = next;
    setHistory(next);
  }

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
      await runAction({ kind: "cutoff", cutoff: next });
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

  function apply(action: PlanAction) {
    const planId = view.plan.id;
    switch (action.kind) {
      case "place":
      case "move":
        return placeCourse(planId, action.code, action.term);
      case "remove":
        return removeCourse(planId, action.code);
      case "pin":
        return setPin(planId, action.code, action.groupId);
      case "check":
        return setCheck(planId, action.code, action.item, action.answer);
      case "choice":
        return setChoice(planId, action.groupId, action.childId);
      case "cutoff":
        return setCutoff(planId, action.cutoff);
    }
  }

  // The one path every plan change takes — drag (mouse or touch), card
  // menu, suggestion, Place in…, the details sidebar, a choice, the
  // Completed menu — so a place or move is refused by the same rule as
  // dragging, and every change offers the same Undo.
  function runAction(action: PlanAction): Promise<void> {
    return enqueue(async () => {
      const before = viewRef.current;
      if (changesNothing(before, action)) return;
      if (action.kind === "remove") {
        if (!before.placements.some((p) => p.code === action.code)) return;
      } else if (action.kind === "place" || action.kind === "move") {
        // A search result has no view.courses entry, so its blocked terms
        // come from the card search (or the sidebar) fetched.
        const blocked = knownCards[action.code]?.hardBlocked ?? searchBlocked[action.code];
        const target = dropTargets(before, action.code, blocked).find((t) => t.term === action.term);
        if (target && !target.allowed) {
          if (target.reason) setAnnouncement(target.reason);
          return;
        }
      }
      // From the view before the change: it still knows where the course was.
      const step = historyStep(before, action);
      const result = await apply(action);
      if (isError(result)) {
        setAnnouncement(result.error);
        return;
      }
      commitView(result);
      commitHistory(recordStep(historyRef.current, step));
      showToast({ mode: "edit", message: step.message, knockOn: knockOnText(newlyBroken(before, result, actedOn(action))) });
    });
  }

  // One plan change in flight at a time, in the order asked for: an undo
  // pressed during an edit applies to that edit, not to the one before.
  function enqueue(work: () => Promise<void>): Promise<void> {
    setBusy((n) => n + 1);
    const run = queueRef.current.then(work).finally(() => setBusy((n) => n - 1));
    queueRef.current = run.catch(() => {});
    return run;
  }

  // Applies each action in order, keeping every one that lands. On a
  // failure the view stays at the last good result; placing is an upsert
  // and the rest set a value, so trying the whole list again is safe.
  async function applyInOrder(actions: PlanAction[]): Promise<string | null> {
    for (const action of actions) {
      const result = await apply(action);
      if (isError(result)) return result.error;
      commitView(result);
    }
    return null;
  }

  // The header buttons, the toast and the shortcuts all come here. A step
  // that fails stays where it was, and its toast comes back to retry from.
  function undo(): Promise<void> {
    return enqueue(async () => {
      const step = historyRef.current.past.at(-1);
      if (!step) return;
      const before = viewRef.current;
      setHistoryPending("undo");
      try {
        const error = await applyInOrder(step.undo);
        if (error) {
          setAnnouncement(error);
          showToast({ mode: "edit", message: step.message, knockOn: "" });
          return;
        }
        commitHistory(undoStep(historyRef.current));
        const knockOn = knockOnText(newlyBroken(before, viewRef.current, actedOn(step.redo)));
        showToast({ mode: "undone", message: step.message, knockOn });
      } finally {
        setHistoryPending(null);
      }
    });
  }

  function redo(): Promise<void> {
    return enqueue(async () => {
      const step = historyRef.current.future.at(-1);
      if (!step) return;
      const before = viewRef.current;
      setHistoryPending("redo");
      try {
        const error = await applyInOrder([step.redo]);
        if (error) {
          setAnnouncement(error);
          showToast({ mode: "undone", message: step.message, knockOn: "" });
          return;
        }
        commitHistory(redoStep(historyRef.current));
        const knockOn = knockOnText(newlyBroken(before, viewRef.current, actedOn(step.redo)));
        showToast({ mode: "edit", message: step.message, knockOn });
      } finally {
        setHistoryPending(null);
      }
    });
  }

  // The toast is role=status, so what it says is also what gets announced.
  function showToast(next: NonNullable<typeof toast>) {
    setToast(next);
    startUndoTimer();
  }

  // A fresh full timeout each time, unless the toast is being held.
  function startUndoTimer() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    if (undoHeld.current.hover || undoHeld.current.focus) return;
    undoTimer.current = setTimeout(() => setToast(null), UNDO_TIMEOUT_MS);
  }

  function holdUndo(kind: "hover" | "focus", held: boolean) {
    undoHeld.current[kind] = held;
    startUndoTimer();
  }

  // A toast that goes while hovered or focused fires no leave event, so
  // the next one mustn't inherit the hold.
  useEffect(() => {
    if (!toast) undoHeld.current = { hover: false, focus: false };
  }, [toast]);

  const readout = completedReadout(view.plan.cutoff, view.terms);
  const linked = details.code ? linkedHighlights(view, details.code, knownCards[details.code]) : null;

  useTouchDrag(plannerRef, {
    onDragStart: setDraggingCode,
    onDragEnd: () => setDraggingCode(null),
    onDrop: (target, code) => {
      void runAction(target.kind === "term" ? actionFor(view, code, target.term) : { kind: "remove", code });
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
              draggingCode={draggingCode}
              draggingBlocked={draggingCode ? searchBlocked[draggingCode] : undefined}
              draggingTwoSemester={
                draggingCode
                  ? (view.courses[draggingCode]?.twoSemester ?? searchTwoSemester[draggingCode] ?? false)
                  : false
              }
              onAction={runAction}
              onDragStart={setDraggingCode}
              onDragEnd={() => setDraggingCode(null)}
              showPrereqLinks={showPrereqLinks}
              openMenuCode={openMenuCode}
              onMenuOpenChange={(code, next) => setOpenMenuCode(next ? code : null)}
              locateRequest={locateRequest}
              onLocateCourse={(code, part) => setLocateRequest({ code, part, token: Date.now() })}
              onShowGroup={(id) => showInSidebar("group", id)}
              focusGroupId={focusGroupId}
              onOpenDetails={openDetails}
              openCode={details.code}
              linked={linked}
            />
          </div>
          <Sidebar
            view={view}
            planId={view.plan.id}
            onAnnounce={setAnnouncement}
            onAction={runAction}
            onDragStart={setDraggingCode}
            onDragEnd={() => setDraggingCode(null)}
            onSearchResults={(courses) => {
              setKnownCards((prev) => ({ ...prev, ...Object.fromEntries(courses.map((course) => [course.code, course])) }));
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
            onDropRemove={(code) => void runAction({ kind: "remove", code })}
            showRequest={showRequest}
            onShowInSidebar={showInSidebar}
            onFocusGroup={setFocusGroupId}
            onOpenDetails={openDetails}
            openCode={details.code}
            linked={linked}
          />
          <ReqsResizeHandle reqs={reqs} split={split} fit={fit} onChange={updatePanels} />
        </div>
      </div>
      {details.code && (
        <CourseDetailsPanel
          view={view}
          details={details}
          card={view.courses[details.code] ?? knownCards[details.code] ?? fetched.data?.course ?? null}
          fetched={fetched}
          onOpen={(code) => openDetails(code)}
          onBack={() => setDetails((s) => stepHistory(s, -1))}
          onForward={() => setDetails((s) => stepHistory(s, 1))}
          onClose={() => setDetails(closeDetails)}
          onPlace={(term) => void runAction(actionFor(view, details.code!, term))}
          onRemove={() => void runAction({ kind: "remove", code: details.code! })}
          onAction={runAction}
        />
      )}
      {toast && (
        <div
          class={fit === 0 && reqs.collapsed ? "undo-toast undo-toast-above-bar" : "undo-toast"}
          role="status"
          onMouseEnter={() => holdUndo("hover", true)}
          onMouseLeave={() => holdUndo("hover", false)}
          onFocusIn={() => holdUndo("focus", true)}
          onFocusOut={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) holdUndo("focus", false);
          }}
        >
          <span>
            {toast.mode === "undone" ? "Undid: " : ""}
            {toast.message}.{toast.knockOn}
          </span>
          {toast.mode === "edit" ? (
            <button type="button" disabled={busy > 0} onClick={() => void undo()}>
              {historyPending === "undo" ? "Undoing…" : "Undo"}
            </button>
          ) : (
            <button type="button" disabled={busy > 0} onClick={() => void redo()}>
              {historyPending === "redo" ? "Redoing…" : "Redo"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
