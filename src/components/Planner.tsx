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
  applyLayoutPrefs,
  applySplit,
  DEFAULT_LAYOUT_PREFS,
  DEFAULT_SPLIT,
  loadLayoutPrefs,
  parseSplit,
  type ReqsState,
  saveLayoutPrefs,
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
import ReqsResizeHandle from "./ReqsResizeHandle";
import SearchPalette from "./SearchPalette";
import Sidebar, { type ShowRequest } from "./Sidebar";
import type { Panels } from "./split-resize";
import Timeline, { type LocateRequest } from "./Timeline";
import { useTouchDrag } from "./touch-drag";
import {
  EMPTY_HISTORY,
  type History,
  historyShortcut,
  isTextEntry,
  recordStep,
  redoStep,
  undoStep,
} from "./undo-history";
import { useContainerWidth } from "./use-container-width";
import { useCourseDetails } from "./use-course-details";
import WorkspaceDivider from "./WorkspaceDivider";
import {
  computeLayout,
  DETAILS_DEFAULT,
  DETAILS_SNAPS,
  DETAILS_TWO_COLUMN,
  DETAILS_WIDE,
  type LayoutInput,
  type LayoutPrefs,
  reqsSnapTargets,
  unfoldPrefs,
} from "./workspace-layout";

// How long "Undo" stays offered after a change — long enough to notice and
// act on without thinking, short enough that it isn't still sitting there
// (offering to restore a now-stale course) minutes into unrelated work.
const UNDO_TIMEOUT_MS = 8000;

// The More options and completed-semesters panels share openMenuCode with
// the course menus, so only one is ever open; course codes (four letters,
// four digits) never look like these.
const MORE_OPTIONS = "more-options";
const COMPLETED_MENU = "completed-menu";

// Beside Completed through: icon buttons named by what they'd do next, so
// a screen reader (and the tooltip) says which edit, not just "Undo".
function HistoryControls({
  history,
  disabled,
  onUndo,
  onRedo,
}: {
  history: History;
  disabled: boolean;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const undoing = history.past.at(-1);
  const redoing = history.future.at(-1);
  const undoName = undoing ? `Undo: ${undoing.message}` : "Undo";
  const redoName = redoing ? `Redo: ${redoing.message}` : "Redo";
  return (
    <div class="history-controls">
      <button
        type="button"
        class="history-button"
        aria-label={undoName}
        title={undoName}
        disabled={disabled || !undoing}
        onClick={onUndo}
      >
        <svg class="details-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
        </svg>
      </button>
      <button
        type="button"
        class="history-button"
        aria-label={redoName}
        title={redoName}
        disabled={disabled || !redoing}
        onClick={onRedo}
      >
        <svg class="details-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m15 14 5-5-5-5" />
          <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
        </svg>
      </button>
    </div>
  );
}

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
  const [searchOpen, setSearchOpen] = useState(false);
  // A touch drag started from a palette result: the palette hides so the
  // terms under the finger are what elementFromPoint finds.
  const [paletteDragging, setPaletteDragging] = useState(false);
  // For the history shortcuts' listener, which is registered once.
  const searchOpenRef = useRef(false);
  searchOpenRef.current = searchOpen;
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  // "Ctrl K" until hydrated, so the server and first client render agree.
  const [onMac, setOnMac] = useState(false);
  useEffect(() => setOnMac(/Mac|iP/.test(navigator.platform)), []);
  const [openMenuCode, setOpenMenuCode] = useState<string | null>(null);
  const [locateRequest, setLocateRequest] = useState<LocateRequest | null>(null);
  const [showRequest, setShowRequest] = useState<ShowRequest | null>(null);
  // The sidebar group whose heading is under hover or focus; the timeline
  // recedes every card outside it.
  const [focusGroupId, setFocusGroupId] = useState<string | null>(null);
  // The one toast: the latest edit or redo ("edit", offering Undo), the
  // latest undo ("undone", offering Redo), or a layout change the student
  // didn't ask for ("notice", offering nothing).
  const [toast, setToast] = useState<{ mode: "edit" | "undone" | "notice"; message: string; knockOn: string } | null>(
    null,
  );
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
  const layoutRef = useRef<HTMLDivElement>(null);
  const containerPx = useContainerWidth(layoutRef);
  const readOnly = view.plan.readOnly;
  // Queued work runs after renders it wasn't called from, so it reads the
  // latest view and history from these rather than from its own closure.
  const viewRef = useRef(view);
  const historyRef = useRef(history);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  // busy, for the keyboard listener, which is registered once.
  const busyRef = useRef(0);
  function commitView(next: PlanView) {
    viewRef.current = next;
    setView(next);
  }
  function commitHistory(next: History) {
    historyRef.current = next;
    setHistory(next);
  }

  // The saved widths, and a divider drag's preview of new ones (saved only
  // on release).
  const [prefs, setPrefs] = useState<LayoutPrefs>(DEFAULT_LAYOUT_PREFS);
  const [preview, setPreview] = useState<LayoutPrefs | null>(null);
  const [split, setSplit] = useState<SplitStop>(DEFAULT_SPLIT);
  const [remPx, setRemPx] = useState(16);
  // What the card grids take beyond their cards: never less than the
  // 4.5rem the column widths were budgeted with, but a deeper nesting
  // measured at a drag's start can raise it, so its grid keeps its columns
  // at a snap target.
  const [measuredOverheadPx, setMeasuredOverheadPx] = useState(0);
  // The <head> script already painted the stored state; this just brings
  // Preact's copy in line after hydration (server render + first client
  // render stay equal, as with Sidebar's compaction state).
  useEffect(() => {
    setPrefs(loadLayoutPrefs());
    setSplit(parseSplit(document.documentElement.dataset.split));
    setRemPx(parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
  }, []);

  const layoutInput: LayoutInput = {
    containerPx,
    remPx,
    detailsOpen: details.code !== null,
    prefs: preview ?? prefs,
    gridOverheadPx: Math.max(4.5 * remPx, measuredOverheadPx),
  };
  const layout = computeLayout(layoutInput);
  // Until the planner is measured nothing is known about its width, so the
  // CSS defaults lay the panes out and nothing treats them as stacked.
  const measured = containerPx > 0;
  const stacked = measured && layout.mode === "stacked";
  const sideBySide = measured && layout.mode === "side-by-side";
  const reqsTargets = reqsSnapTargets(remPx, layoutInput.gridOverheadPx);
  const reqs: ReqsState = { collapsed: prefs.reqsFolded };

  function commitPrefs(next: LayoutPrefs) {
    setPreview(null);
    setPrefs(next);
    applyLayoutPrefs(document.documentElement, next);
    saveLayoutPrefs(next);
  }

  function foldRequirements(folded: boolean) {
    commitPrefs({ ...prefs, reqsFolded: folded });
  }

  // Off the rail, whether the student folded it or details did. Where
  // unfolding as saved would only fold again beside details, it unfolds at
  // one column and narrows details to fit, or says why neither fits.
  function unfoldRequirements() {
    const unfolded = { ...prefs, reqsFolded: false };
    const input = { ...layoutInput, prefs: unfolded };
    if (!computeLayout(input).autoFolded) return commitPrefs(unfolded);
    const result = unfoldPrefs(input);
    if ("error" in result) setAnnouncement(result.error);
    else commitPrefs(result.prefs);
  }

  // A fold details forced is said once, as it happens: not for a page that
  // loaded folded, and not mid-drag, where the size label already says it.
  const lastFold = useRef({ measured: false, autoFolded: false });
  useEffect(() => {
    const was = lastFold.current;
    lastFold.current = { measured, autoFolded: layout.autoFolded };
    if (was.measured && !was.autoFolded && layout.autoFolded && preview === null) {
      showToast({ mode: "notice", message: "Requirements folded to make room for course details", knockOn: "" });
    }
  }, [measured, layout.autoFolded]);

  // The widest gap between a requirements grid and the sidebar's edge.
  function measureOverhead() {
    const aside = document.getElementById("requirements");
    if (!aside || layout.reqsPx === "rail") return;
    const width = aside.getBoundingClientRect().width;
    const gaps = [...aside.querySelectorAll<HTMLElement>(".available-courses")]
      .filter((grid) => grid.clientWidth > 0)
      .map((grid) => width - grid.clientWidth);
    if (gaps.length > 0) setMeasuredOverheadPx(Math.max(...gaps));
  }

  // Revealing a hidden sidebar is Planner's job; Sidebar does the rest
  // (expanding the section, scrolling, focus, highlight) from the request.
  function showInSidebar(kind: ShowRequest["kind"], id: string) {
    if (layout.reqsPx === "rail") unfoldRequirements();
    setShowRequest({ kind, id, token: Date.now() });
  }

  // The stacked split handle. The fold applies as it's previewed, since the
  // stacked CSS reads it from <html>; it's saved on release.
  function updatePanels(next: Panels, commit: boolean) {
    const nextPrefs = { ...prefs, reqsFolded: next.reqs.collapsed };
    setPrefs(nextPrefs);
    applyLayoutPrefs(document.documentElement, nextPrefs);
    if (commit) saveLayoutPrefs(nextPrefs);
    setSplit(next.split);
    applySplit(document.documentElement, next.split);
    if (commit) saveSplit(next.split);
  }

  const detailsWidth = layout.details.mode === "docked" ? layout.details.px : 0;
  function toggleWideDetails() {
    commitPrefs({ ...prefs, detailsWidthPx: detailsWidth >= DETAILS_TWO_COLUMN ? DETAILS_DEFAULT : DETAILS_WIDE });
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
    busyRef.current++;
    setBusy((n) => n + 1);
    const run = queueRef.current.then(work).finally(() => {
      busyRef.current--;
      setBusy((n) => n - 1);
    });
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

  // Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z (or Ctrl+Y) anywhere on the page, except
  // where they already undo typing. Registered once: undo and redo read
  // everything that changes through refs, so the first render's copies
  // stay correct.
  useEffect(() => {
    if (readOnly) return;
    const mac = /Mac|iP/.test(navigator.platform);
    function onKeyDown(event: KeyboardEvent) {
      const which = historyShortcut(event, mac);
      // The palette covers the plan it would change, so it's out of reach.
      if (!which || searchOpenRef.current || isTextEntry(event.target as HTMLElement | null)) return;
      event.preventDefault();
      if (busyRef.current > 0) return;
      void (which === "undo" ? undo() : redo());
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [readOnly]);

  // Focus goes back to the trigger however the palette closes, so the
  // keyboard never lands on <body>.
  function closeSearch() {
    setSearchOpen(false);
    searchTriggerRef.current?.focus();
  }

  // ⌘K or Ctrl-K opens and closes the palette from anywhere, including its
  // own input.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      if (searchOpenRef.current) closeSearch();
      else setSearchOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Search results can be courses outside the plan's tree; remember what
  // the drag highlights and the sidebar need to know about them.
  function rememberSearchResults(courses: CourseCard[]) {
    setKnownCards((prev) => ({ ...prev, ...Object.fromEntries(courses.map((course) => [course.code, course])) }));
    setSearchBlocked((prev) => ({
      ...prev,
      ...Object.fromEntries(courses.map((course) => [course.code, course.hardBlocked])),
    }));
    setSearchTwoSemester((prev) => ({
      ...prev,
      ...Object.fromEntries(courses.map((course) => [course.code, course.twoSemester])),
    }));
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
    onDragStart: (code) => {
      setDraggingCode(code);
      if (searchOpenRef.current) setPaletteDragging(true);
    },
    // Called just before the drop is resolved under the finger; the palette
    // only re-renders afterwards, so it's still hidden then.
    onDragEnd: () => {
      setDraggingCode(null);
      if (!searchOpenRef.current) return;
      setPaletteDragging(false);
      closeSearch();
    },
    spanOf: (code) => ((view.courses[code]?.twoSemester ?? searchTwoSemester[code]) ? 2 : 1),
    onDrop: (target, code) => {
      void runAction(target.kind === "term" ? actionFor(view, code, target.term) : { kind: "remove", code });
    },
  });

  // Docked, the panel is the panes' last grid column; as a drawer it lies
  // over the timeline's end inside them. As the stacked sheet, and before
  // the planner is measured, it stays outside the size container, whose
  // containment would pin its fixed position.
  const detailsInPanes = sideBySide && (layout.details.mode === "docked" || layout.details.mode === "drawer");
  const detailsPanel = details.code && (
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
      mode={layout.details.mode}
      wide={detailsWidth >= DETAILS_TWO_COLUMN}
      onToggleWide={toggleWideDetails}
    />
  );

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
          <button
            type="button"
            class="search-trigger"
            ref={searchTriggerRef}
            aria-haspopup="dialog"
            aria-label="Search courses"
            aria-keyshortcuts="Meta+K Control+K"
            title={`Search courses (${onMac ? "⌘K" : "Ctrl K"})`}
            onClick={() => setSearchOpen(true)}
          >
            {/* An icon button, not a field: styled as an input it promised
                typing in place. The palette's own label says what it
                searches. */}
            <svg class="search-trigger-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            <kbd class="search-trigger-key" aria-hidden="true">
              {onMac ? "⌘K" : "Ctrl K"}
            </kbd>
          </button>
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
          {!readOnly && (
            <HistoryControls
              history={history}
              disabled={busy > 0}
              onUndo={() => void undo()}
              onRedo={() => void redo()}
            />
          )}
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
      <div class="planner-layout" ref={layoutRef}>
        <div
          class="planner-panes"
          data-measured={measured || undefined}
          data-rail={(sideBySide && layout.reqsPx === "rail") || undefined}
          style={
            sideBySide
              ? {
                  "--reqs-col": `${layout.reqsPx === "rail" ? 3 * remPx : layout.reqsPx}px`,
                  "--div2-col": detailsWidth ? `${remPx}px` : "0px",
                  "--details-col": `${detailsWidth}px`,
                }
              : undefined
          }
        >
          <div class="planner-timeline-area region">
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
            onAction={runAction}
            onDragStart={setDraggingCode}
            onDragEnd={() => setDraggingCode(null)}
            openMenuCode={openMenuCode}
            onMenuOpenChange={(code, next) => setOpenMenuCode(next ? code : null)}
            onLocateCourse={(code, part) => setLocateRequest({ code, part, token: Date.now() })}
            onHide={() => foldRequirements(true)}
            onShow={unfoldRequirements}
            autoFolded={sideBySide && layout.autoFolded}
            dropReady={draggingCode !== null && view.placements.some((p) => p.code === draggingCode)}
            onDropRemove={(code) => void runAction({ kind: "remove", code })}
            showRequest={showRequest}
            onShowInSidebar={showInSidebar}
            onFocusGroup={setFocusGroupId}
            onOpenDetails={openDetails}
            openCode={details.code}
            linked={linked}
          />
          {stacked && <ReqsResizeHandle reqs={reqs} split={split} onChange={updatePanels} />}
          {sideBySide && (
            <WorkspaceDivider
              which="reqs"
              layout={layout}
              input={layoutInput}
              targets={reqsTargets}
              onDragStart={measureOverhead}
              onPreview={setPreview}
              onCommit={(next, release) => (release === "fold" ? foldRequirements(true) : commitPrefs(next))}
              onToggle={() => (layout.reqsPx === "rail" ? unfoldRequirements() : foldRequirements(true))}
              onReset={() => commitPrefs({ ...prefs, reqsFolded: false, reqsWidthPx: null })}
            />
          )}
          {sideBySide && layout.details.mode === "docked" && (
            <WorkspaceDivider
              which="details"
              layout={layout}
              input={layoutInput}
              targets={DETAILS_SNAPS}
              onPreview={setPreview}
              onCommit={(next, release) => {
                if (release !== "close") return commitPrefs(next);
                setPreview(null);
                setDetails(closeDetails);
              }}
              onToggle={toggleWideDetails}
              onReset={() => commitPrefs({ ...prefs, detailsWidthPx: DETAILS_DEFAULT })}
            />
          )}
          {detailsInPanes && detailsPanel}
        </div>
      </div>
      {!detailsInPanes && detailsPanel}
      {/* Inside .planner, so the touch-drag root covers its results, but outside the size container, which would pin it. */}
      <SearchPalette
        view={view}
        planId={view.plan.id}
        open={searchOpen}
        onClose={closeSearch}
        onResults={rememberSearchResults}
        onOpenDetails={(code) => openDetails(code)}
        onAnnounce={setAnnouncement}
        onDragStart={setDraggingCode}
        onDragEnd={() => setDraggingCode(null)}
        openMenuCode={openMenuCode}
        onMenuOpenChange={(code, next) => setOpenMenuCode(next ? code : null)}
        onLocateCourse={(code, part) => setLocateRequest({ code, part, token: Date.now() })}
        onAction={runAction}
        openCode={details.code}
        dragging={paletteDragging}
        stacked={stacked}
      />
      {toast && (
        <div
          class={stacked && reqs.collapsed ? "undo-toast glass undo-toast-above-bar" : "undo-toast glass"}
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
          {toast.mode === "edit" && (
            <button type="button" disabled={busy > 0} onClick={() => void undo()}>
              {historyPending === "undo" ? "Undoing…" : "Undo"}
            </button>
          )}
          {toast.mode === "undone" && (
            <button type="button" disabled={busy > 0} onClick={() => void redo()}>
              {historyPending === "redo" ? "Redoing…" : "Redo"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
