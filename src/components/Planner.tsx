import { useEffect, useRef, useState } from "preact/hooks";
import type { CourseCard, CourseDetailsView, PlanView } from "../lib/domain/view";
import { isError, placeCourse, removeCourse, setCutoff, setPin } from "./api";
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
import { actionFor, changesNothing, knockOnText, newlyBroken, type PlanAction, type UndoEntry, undoEntry } from "./plan-actions";
import { completedReadout, dropTargets, linkedHighlights } from "./planner-logic";
import { useReqsFit } from "./reqs-fit";
import ReqsResizeHandle from "./ReqsResizeHandle";
import Sidebar, { type ShowRequest } from "./Sidebar";
import type { Panels } from "./split-resize";
import Timeline, { type LocateRequest } from "./Timeline";
import { useTouchDrag } from "./touch-drag";
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
  useEffect(() => {
    history.replaceState(null, "", withCourseParam(location.href, details.code));
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
  const [undo, setUndo] = useState<{ entry: UndoEntry; knockOn: string } | null>(null);
  const [cutoffPending, setCutoffPending] = useState(false);
  const [undoPending, setUndoPending] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The toast's timeout waits while the pointer is over it or focus is in
  // it (WCAG 2.2.1), so reading it and reaching Undo can't be cut short.
  const undoHeld = useRef({ hover: false, focus: false });
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

  function apply(action: PlanAction) {
    return action.kind === "remove"
      ? removeCourse(view.plan.id, action.code)
      : placeCourse(view.plan.id, action.code, action.term);
  }

  // The one path every place, move and remove takes — drag (mouse or touch),
  // card menu, suggestion, Place in…, the details sidebar — so each is
  // refused by the same rule as dragging and each offers the same Undo.
  async function runAction(action: PlanAction): Promise<void> {
    if (changesNothing(view, action)) return;
    if (action.kind === "remove") {
      if (!view.placements.some((p) => p.code === action.code)) return;
    } else {
      // A search result has no view.courses entry, so its blocked terms
      // come from the card search (or the sidebar) fetched.
      const blocked = knownCards[action.code]?.hardBlocked ?? searchBlocked[action.code];
      const target = dropTargets(view, action.code, blocked).find((t) => t.term === action.term);
      if (target && !target.allowed) {
        if (target.reason) setAnnouncement(target.reason);
        return;
      }
    }
    // From the view before the change: it still knows where the course was.
    const entry = undoEntry(view, action);
    const result = await apply(action);
    if (isError(result)) {
      setAnnouncement(result.error);
      return;
    }
    setView(result);
    // The toast is role=status, so this is also what gets announced.
    setUndo({ entry, knockOn: knockOnText(newlyBroken(view, result, action.code)) });
    startUndoTimer();
  }

  // A fresh full timeout each time, unless the toast is being held.
  function startUndoTimer() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    if (undoHeld.current.hover || undoHeld.current.focus) return;
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_TIMEOUT_MS);
  }

  function holdUndo(kind: "hover" | "focus", held: boolean) {
    undoHeld.current[kind] = held;
    startUndoTimer();
  }

  // A toast that goes while hovered or focused fires no leave event, so
  // the next one mustn't inherit the hold.
  useEffect(() => {
    if (!undo) undoHeld.current = { hover: false, focus: false };
  }, [undo]);

  // Undoing offers no undo of its own: the toast just goes.
  async function handleUndo() {
    if (!undo || undoPending) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const { entry } = undo;
    setUndoPending(true);
    setUndo(null);
    try {
      const undone = await apply(entry.undo);
      if (isError(undone)) {
        setAnnouncement(undone.error);
        return;
      }
      if (!entry.restorePin) {
        setView(undone);
      } else {
        const pinned = await setPin(view.plan.id, entry.undo.code, entry.restorePin);
        setView(isError(pinned) ? undone : pinned);
      }
      setAnnouncement(`Undone: ${entry.message}`);
    } finally {
      setUndoPending(false);
    }
  }

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
            onChanged={setView}
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
          onChanged={setView}
          onAnnounce={setAnnouncement}
        />
      )}
      {undo && (
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
            {undo.entry.message}.{undo.knockOn}
          </span>
          <button type="button" disabled={undoPending} onClick={handleUndo}>
            {undoPending ? "Undoing…" : "Undo"}
          </button>
        </div>
      )}
    </div>
  );
}
