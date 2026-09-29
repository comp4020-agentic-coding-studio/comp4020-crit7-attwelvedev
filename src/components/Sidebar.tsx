import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { RefObject } from "preact";
import type { GroupView, PlanView } from "../lib/domain/view";
import AvailableCourseCard from "./AvailableCourseCard";
import type { DetailsFocus } from "./details-state";
import type { PlanAction } from "./plan-actions";
import PlacedCourseRow from "./PlacedCourseRow";
import {
  groupBarTarget,
  groupPath,
  type LinkedHighlights,
  checkNote,
  outstandingItems,
  outstandingTarget,
  progressSegments,
} from "./planner-logic";
import ProgressBar from "./ProgressBar";
import SidebarSection from "./SidebarSection";

// A request, from "Counts toward" or "What's left", to reveal and flash a
// group or check row; a token so repeating the same jump re-triggers it.
export interface ShowRequest {
  kind: "group" | "check";
  id: string;
  token: number;
}

interface Props {
  view: PlanView;
  // Place in… on a group's card, and a group's choice.
  onAction: (action: PlanAction) => Promise<void>;
  onDragStart?: (code: string) => void;
  onDragEnd?: () => void;
  openMenuCode: string | null;
  onMenuOpenChange: (code: string, open: boolean) => void;
  onLocateCourse: (code: string, part?: 2) => void;
  // Collapses the sidebar to its rail.
  onHide: () => void;
  // Expands the sidebar from its rail back to its saved width.
  onShow: () => void;
  // True while a *placed* course is being dragged — the only drag the
  // sidebar accepts (dropping it here removes it from the plan).
  dropReady: boolean;
  // Removes a placed course dropped here, through the same path as a touch
  // drop, so both offer the undo toast.
  onDropRemove: (code: string) => void;
  showRequest: ShowRequest | null;
  // Asks Planner to reveal and jump to a group or check row.
  onShowInSidebar: (kind: ShowRequest["kind"], id: string) => void;
  // The group whose heading is hovered or focused, so the timeline can
  // recede every card outside it; null when none is.
  onFocusGroup: (groupId: string | null) => void;
  // Opens a course in the details sidebar.
  onOpenDetails: (code: string, focus?: DetailsFocus) => void;
  // The course open in the details sidebar, whose titles say so.
  openCode: string | null;
  // What the open course links to, so its groups can say so.
  linked: LinkedHighlights | null;
}

interface GroupProps {
  view: PlanView;
  group: GroupView;
  readOnly: boolean;
  depth: number;
  onAction: (action: PlanAction) => Promise<void>;
  onDragStart?: (code: string) => void;
  onDragEnd?: () => void;
  openMenuCode: string | null;
  onMenuOpenChange: (code: string, open: boolean) => void;
  onLocateCourse: (code: string, part?: 2) => void;
  onFocusGroup: (groupId: string | null) => void;
  // Opens a course in the details sidebar.
  onOpenDetails: (code: string, focus?: DetailsFocus) => void;
  // The course open in the details sidebar, whose titles say so.
  openCode: string | null;
  linked: LinkedHighlights | null;
  // Only top-level groups are compactable; nested ones go with their parent.
  compact?: boolean;
  onToggleCompact?: () => void;
}

// A group never shows more card columns than it has courses. The list
// carries that count as `data-columns` (and `--cols`, for the track
// formula), and CSS fits as many 13rem columns as the sidebar's width
// allows up to it, stretching the cards to fill the width in between.
const MAX_COLUMNS = 3;

// Per-viewer convenience only: which sections this browser has compacted.
// Storage can be missing or throw (private windows, blocked site data), in
// which case every section just starts expanded.
const COMPACT_KEY = "sidebar-compact";

function loadCompact(): Set<string> {
  try {
    const raw = localStorage.getItem(COMPACT_KEY);
    const ids: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

function saveCompact(ids: Set<string>) {
  try {
    localStorage.setItem(COMPACT_KEY, JSON.stringify([...ids]));
  } catch {
    // Not persisting is fine — the toggle still works for this page view.
  }
}

function Group({
  view,
  group,
  readOnly,
  depth,
  onAction,
  onDragStart,
  onDragEnd,
  openMenuCode,
  onMenuOpenChange,
  onLocateCourse,
  onFocusGroup,
  onOpenDetails,
  openCode,
  linked,
  compact = false,
  onToggleCompact,
}: GroupProps) {
  const [choicePending, setChoicePending] = useState(false);

  async function choose(childId: string | null) {
    setChoicePending(true);
    try {
      await onAction({ kind: "choice", groupId: group.id, childId });
    } finally {
      setChoicePending(false);
    }
  }

  // Placed courses stay in the group, as compact rows below the cards
  // ("Completed"/"Planned <term>", non-draggable), rather than disappearing,
  // so a student can still compare them against the group's unplaced
  // courses instead of losing track of which ones they'd already decided on.
  const placedByCode = new Map(view.placements.map((p) => [p.code, p]));
  const courses = group.children.length === 0 ? group.courses : [];
  const unplaced = courses.filter((c) => !placedByCode.has(c));
  const placed = courses.filter((c) => placedByCode.has(c));
  const columns = Math.min(unplaced.length, MAX_COLUMNS) || 1;

  const target = groupBarTarget(group);
  const progress = (
    <ProgressBar
      label={group.label}
      completed={group.completed}
      planned={group.planned}
      required={target.required}
      bound={target.bound}
      family={group.family}
    />
  );

  const body = (
    <>
      {group.selectable && (
        <fieldset aria-busy={choicePending}>
          <legend>Choose {group.label}</legend>
          {group.options.map((option) => (
            <label key={option.id}>
              <input
                type="radio"
                name={`choice-${group.id}`}
                checked={group.chosenId === option.id}
                disabled={readOnly || choicePending}
                onChange={() => choose(option.id)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      )}
      {unplaced.length > 0 && (
        <ul class="available-courses" data-columns={columns} style={`--cols: ${columns}`}>
          {unplaced.map((code) => (
            <AvailableCourseCard
              key={code}
              view={view}
              code={code}
              onAction={onAction}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              openMenuCode={openMenuCode}
              onMenuOpenChange={onMenuOpenChange}
              onOpenDetails={onOpenDetails}
              current={openCode === code}
            />
          ))}
        </ul>
      )}
      {placed.length > 0 && (
        <ul class="placed-rows">
          {placed.map((code) => (
            <PlacedCourseRow
              key={code}
              view={view}
              code={code}
              placement={placedByCode.get(code)!}
              onLocateCourse={onLocateCourse}
              onOpenDetails={onOpenDetails}
              current={openCode === code}
            />
          ))}
        </ul>
      )}
      {group.children.length > 0 && (
        <ul class="group-children">
          {group.children.map((child) => (
            <Group
              key={child.id}
              view={view}
              group={child}
              readOnly={readOnly}
              depth={depth + 1}
              onAction={onAction}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              openMenuCode={openMenuCode}
              onMenuOpenChange={onMenuOpenChange}
              onLocateCourse={onLocateCourse}
              onFocusGroup={onFocusGroup}
              onOpenDetails={onOpenDetails}
              openCode={openCode}
              linked={linked}
            />
          ))}
        </ul>
      )}
    </>
  );

  const isHome = linked !== null && linked.home === group.id;
  const tag =
    linked === null ? null : isHome ? (
      <span class="group-tag">{linked.code} counts here</span>
    ) : linked.could.includes(group.id) ? (
      <span class="group-tag">{linked.code} could count here</span>
    ) : null;

  // A top-level group keeps its progress bar visible when compacted — the
  // bar is what a student scans the sidebar for; the course list is detail.
  if (depth === 0) {
    return (
      <SidebarSection
        id={`group-${group.id}`}
        label={group.label}
        compact={compact}
        onToggle={() => onToggleCompact?.()}
        summary={progress}
        family={group.family}
        groupId={group.id}
        onHeadingActive={(active) => onFocusGroup(active ? group.id : null)}
        linked={isHome}
        tag={tag}
      >
        {body}
      </SidebarSection>
    );
  }

  // Depth becomes the heading level (h3 for a top-level group's children,
  // following SidebarSection's h2, h4 for theirs, etc.) instead of a bullet
  // list — every level renders its own fixed tag, so the sequence never
  // skips a level.
  const Heading = `h${Math.min(depth + 2, 6)}` as "h3" | "h4" | "h5" | "h6";

  return (
    <li
      data-group={group.id}
      class={isHome ? "group-linked" : undefined}
      // Only while linked, so no other [data-family] rule reaches groups.
      data-family={isHome ? group.family : undefined}
    >
      {/* Not a tab stop, but focusable so a jump can land focus here. */}
      <Heading
        tabIndex={-1}
        onMouseEnter={() => onFocusGroup(group.id)}
        onMouseLeave={() => onFocusGroup(null)}
      >
        {group.label}
      </Heading>
      {tag}
      {progress}
      {body}
    </li>
  );
}

export default function Sidebar({
  view,
  onAction,
  onDragStart,
  onDragEnd,
  openMenuCode,
  onMenuOpenChange,
  onLocateCourse,
  onHide,
  onShow,
  dropReady,
  onDropRemove,
  showRequest,
  onShowInSidebar,
  onFocusGroup,
  onOpenDetails,
  openCode,
  linked,
}: Props) {
  const readOnly = view.plan.readOnly;
  const outstanding = outstandingItems(view);
  const hideRef = useRef<HTMLButtonElement>(null);
  const railRef = useRef<HTMLButtonElement>(null);
  // Hiding hands focus to the rail and showing hands it back, but the
  // control only appears once Planner has re-rendered with the new layout,
  // so the move waits for a render that shows it (a layout effect, so it
  // lands before anything else can see focus on the hidden control).
  const focusNext = useRef<RefObject<HTMLButtonElement> | null>(null);
  useLayoutEffect(() => {
    const target = focusNext.current?.current;
    if (!target || target.offsetParent === null) return;
    target.focus();
    focusNext.current = null;
  });
  const { completedPct, plannedPct } = progressSegments(
    view.total.completed,
    view.total.planned,
    view.total.required,
  );

  // Starts empty on the server render and on first hydration so the two
  // agree, then picks up this browser's saved state once mounted.
  const [compact, setCompact] = useState<Set<string>>(() => new Set());
  useEffect(() => setCompact(loadCompact()), []);

  function setSectionCompact(id: string, value: boolean) {
    setCompact((prev) => {
      if (prev.has(id) === value) return prev;
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      saveCompact(next);
      return next;
    });
  }

  useEffect(() => {
    if (!showRequest) return;
    const { kind, id } = showRequest;
    const sectionId = kind === "check" ? "total" : groupPath(view, id)[0]?.id;
    if (!sectionId) return;
    setSectionCompact(kind === "check" ? "total" : `group-${sectionId}`, false);
    let el: HTMLElement | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // After the render that un-compacts the section: until then a nested
    // target is inside a hidden body and has no box to scroll to or focus.
    const frame = requestAnimationFrame(() => {
      el = document.querySelector<HTMLElement>(kind === "check" ? `[data-check="${id}"]` : `[data-group="${id}"]`);
      if (!el) return;
      const heading = el.querySelector<HTMLElement>(
        ":scope > h2 .section-toggle, :scope > h3, :scope > h4, :scope > h5, :scope > h6",
      );
      el.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
      // preventScroll: focus()'s own jump would fight the scroll above.
      heading?.focus({ preventScroll: true });
      el.classList.add("requirement-highlighted");
      timer = setTimeout(() => el?.classList.remove("requirement-highlighted"), 2000);
    });
    // A newer request cancels this one, so it has to clear its own
    // highlight, as Timeline's locate effect does.
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      el?.classList.remove("requirement-highlighted");
    };
  }, [showRequest]);

  const sectionProps = (id: string) => ({
    id,
    compact: compact.has(id),
    onToggle: () => setSectionCompact(id, !compact.has(id)),
  });

  return (
    <>
      {/* Outside the aside, which scrolls: the button rides the resize
          handle instead of floating over the requirements or taking a row
          above them. Its chip is drawn in CSS. */}
      <button
        type="button"
        class="reqs-hide"
        ref={hideRef}
        aria-controls="requirements-content"
        aria-expanded="true"
        title="Hide requirements"
        onClick={() => {
          focusNext.current = railRef;
          onHide();
        }}
      >
        <svg class="section-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m15 6-6 6 6 6" />
        </svg>
        <span class="visually-hidden">Hide requirements</span>
      </button>
      <aside
        id="requirements"
        aria-label="requirements"
        class={dropReady ? "region reqs-drop-ready" : "region"}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onDragEnd?.();
          if (readOnly) return;
          const code = event.dataTransfer?.getData("text/plain");
          if (!code || !view.placements.some((p) => p.code === code)) return;
          onDropRemove(code);
        }}
      >
        <button
          type="button"
          class="reqs-rail"
          ref={railRef}
          aria-controls="requirements-content"
          aria-expanded="false"
          onClick={() => {
            focusNext.current = hideRef;
            onShow();
          }}
        >
          {/* One span for the whole name: the rail is a flex container, so each
              child is blockified and the name algorithm would put a space
              between separate spans ("Show requirements : …"). */}
          <span class="visually-hidden">
            Show requirements: {view.total.completed} completed, {view.total.planned} planned of {view.total.required}
          </span>
          <span class="reqs-rail-label" aria-hidden="true">
            Requirements
          </span>
          {/* The rail draws the fill vertically and the stacked bar
              horizontally, from the same two numbers. */}
          <span class="reqs-rail-bar" aria-hidden="true" style={`--completed: ${completedPct}%; --planned: ${plannedPct}%`}>
            <span class="reqs-rail-completed" />
            <span class="reqs-rail-planned" />
          </span>
        </button>
        <ul class="requirements-scroll" id="requirements-content">
          <SidebarSection
            {...sectionProps("outstanding")}
            label="What's left"
            class="outstanding-panel"
            compactSummary={
              <p class={outstanding.length === 0 ? "outstanding-done" : "outstanding-count"}>
                {outstanding.length === 0
                  ? "Nothing outstanding"
                  : `${outstanding.length} item${outstanding.length === 1 ? "" : "s"} outstanding`}
              </p>
            }
          >
            {outstanding.length === 0 ? (
              <p class="outstanding-done">
                Every requirement is satisfied or planned — nothing outstanding here.
              </p>
            ) : (
              <ul class="outstanding-list">
                {outstanding.map((item) => {
                  const target = outstandingTarget(item.id);
                  return (
                    <li key={item.id}>
                      {target ? (
                        <button
                          type="button"
                          class="outstanding-link"
                          onClick={() => onShowInSidebar(target.kind, target.id)}
                        >
                          {item.text}
                        </button>
                      ) : (
                        item.text
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </SidebarSection>
          <SidebarSection
            {...sectionProps("total")}
            label="Total"
            summary={
              <ProgressBar
                label="Total"
                completed={view.total.completed}
                planned={view.total.planned}
                required={view.total.required}
              />
            }
          >
            <section aria-label="program checks">
              <h3>Checks</h3>
              <ul class="checks-list">
                {view.checks.map((check) => (
                  <li key={check.id} data-check={check.id}>
                    <h4 tabIndex={-1}>{check.label}</h4>
                    {check.ok !== null && (
                      <ProgressBar
                        label={check.label}
                        completed={check.completed}
                        planned={check.planned}
                        required={check.units}
                        bound={check.bound}
                        figuresOnly
                      />
                    )}
                    <p class="check-note">{checkNote(check)}</p>
                  </li>
                ))}
              </ul>
            </section>
          </SidebarSection>
          {view.groups.map((group) => (
            <Group
              key={group.id}
              view={view}
              group={group}
              readOnly={readOnly}
              depth={0}
              onAction={onAction}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              openMenuCode={openMenuCode}
              onMenuOpenChange={onMenuOpenChange}
              onLocateCourse={onLocateCourse}
              onFocusGroup={onFocusGroup}
              onOpenDetails={onOpenDetails}
              openCode={openCode}
              linked={linked}
              compact={compact.has(`group-${group.id}`)}
              onToggleCompact={() => setSectionCompact(`group-${group.id}`, !compact.has(`group-${group.id}`))}
            />
          ))}
        </ul>
      </aside>
    </>
  );
}
