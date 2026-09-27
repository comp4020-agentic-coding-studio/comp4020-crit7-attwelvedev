import { useEffect, useState } from "preact/hooks";
import type { GroupView, PlanView } from "../lib/domain/view";
import AvailableCourseCard from "./AvailableCourseCard";
import { isError, removeCourse, setChoice } from "./api";
import CourseSearch from "./CourseSearch";
import { outstandingItems } from "./planner-logic";
import ProgressBar from "./ProgressBar";
import SidebarSection from "./SidebarSection";

interface Props {
  view: PlanView;
  planId: string;
  onChanged: (view: PlanView) => void;
  onAnnounce: (message: string) => void;
  onDragStart?: (code: string) => void;
  onDragEnd?: () => void;
  openMenuCode: string | null;
  onMenuOpenChange: (code: string, open: boolean) => void;
  onLocateCourse: (code: string) => void;
}

interface GroupProps {
  view: PlanView;
  group: GroupView;
  planId: string;
  readOnly: boolean;
  depth: number;
  onChanged: (view: PlanView) => void;
  onAnnounce: (message: string) => void;
  onDragStart?: (code: string) => void;
  onDragEnd?: () => void;
  openMenuCode: string | null;
  onMenuOpenChange: (code: string, open: boolean) => void;
  onLocateCourse: (code: string) => void;
  // Only top-level groups are compactable; nested ones go with their parent.
  compact?: boolean;
  onToggleCompact?: () => void;
}

// A group with more courses than fit one row would otherwise get an
// invisible trailing "phantom" grid column from `auto-fill` sizing to the
// (shared, uniform) sidebar width, which throws off `justify-content:
// center`'s centering for any group with fewer courses than that. Capping to
// the group's own course count keeps every group's grid exactly as wide as
// its own content, still centered within the shared sidebar width.
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
  planId,
  readOnly,
  depth,
  onChanged,
  onAnnounce,
  onDragStart,
  onDragEnd,
  openMenuCode,
  onMenuOpenChange,
  onLocateCourse,
  compact = false,
  onToggleCompact,
}: GroupProps) {
  const [choicePending, setChoicePending] = useState(false);

  async function choose(childId: string | null) {
    setChoicePending(true);
    try {
      const result = await setChoice(planId, group.id, childId);
      if (isError(result)) onAnnounce(result.error);
      else onChanged(result);
    } finally {
      setChoicePending(false);
    }
  }

  // Placed courses stay in the list (dimmed, ticked, non-draggable) rather
  // than disappearing, so a student can still compare them against the
  // group's unplaced courses instead of losing track of which ones they'd
  // already decided on.
  const placedByCode = new Map(view.placements.map((p) => [p.code, p]));
  const courses = group.children.length === 0 ? group.courses : [];
  const columns = Math.min(courses.length, MAX_COLUMNS) || 1;

  const progress = (
    <ProgressBar
      label={group.label}
      completed={group.completed}
      planned={group.planned}
      required={group.unitsRequired}
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
      {courses.length > 0 && (
        <ul class="available-courses" style={{ "--group-columns": columns }}>
          {courses.map((code) => (
            <AvailableCourseCard
              key={code}
              view={view}
              code={code}
              placement={placedByCode.get(code) ?? null}
              planId={planId}
              onChanged={onChanged}
              onAnnounce={onAnnounce}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              openMenuCode={openMenuCode}
              onMenuOpenChange={onMenuOpenChange}
              onLocateCourse={onLocateCourse}
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
              planId={planId}
              readOnly={readOnly}
              depth={depth + 1}
              onChanged={onChanged}
              onAnnounce={onAnnounce}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              openMenuCode={openMenuCode}
              onMenuOpenChange={onMenuOpenChange}
              onLocateCourse={onLocateCourse}
            />
          ))}
        </ul>
      )}
    </>
  );

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
    <li>
      <Heading>{group.label}</Heading>
      {progress}
      {body}
    </li>
  );
}

export default function Sidebar({
  view,
  planId,
  onChanged,
  onAnnounce,
  onDragStart,
  onDragEnd,
  openMenuCode,
  onMenuOpenChange,
  onLocateCourse,
}: Props) {
  const readOnly = view.plan.readOnly;
  const outstanding = outstandingItems(view);

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

  const sectionProps = (id: string) => ({
    id,
    compact: compact.has(id),
    onToggle: () => setSectionCompact(id, !compact.has(id)),
  });

  return (
    <aside
      aria-label="requirements"
      onDragOver={(event) => event.preventDefault()}
      onDrop={async (event) => {
        event.preventDefault();
        onDragEnd?.();
        if (readOnly) return;
        const code = event.dataTransfer?.getData("text/plain");
        if (!code || !view.placements.some((p) => p.code === code)) return;
        const result = await removeCourse(planId, code);
        if (isError(result)) onAnnounce(result.error);
        else onChanged(result);
      }}
    >
      <ul class="requirements-scroll">
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
              {outstanding.map((item) => (
                <li key={item.id}>{item.text}</li>
              ))}
            </ul>
          )}
        </SidebarSection>
        <CourseSearch
          view={view}
          planId={planId}
          onChanged={onChanged}
          onAnnounce={onAnnounce}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          openMenuCode={openMenuCode}
          onMenuOpenChange={onMenuOpenChange}
          compact={compact.has("search")}
          onToggleCompact={() => setSectionCompact("search", !compact.has("search"))}
          onExpand={() => setSectionCompact("search", false)}
        />
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
                <li key={check.id}>
                  <h4>{check.label}</h4>
                  {check.ok === null ? (
                    <p>not tracked — verify on P&C</p>
                  ) : (
                    <ProgressBar
                      label={check.label}
                      completed={check.completed}
                      planned={check.planned}
                      required={check.units}
                      bound={check.bound}
                    />
                  )}
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
            planId={planId}
            readOnly={readOnly}
            depth={0}
            onChanged={onChanged}
            onAnnounce={onAnnounce}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            openMenuCode={openMenuCode}
            onMenuOpenChange={onMenuOpenChange}
            onLocateCourse={onLocateCourse}
            compact={compact.has(`group-${group.id}`)}
            onToggleCompact={() => setSectionCompact(`group-${group.id}`, !compact.has(`group-${group.id}`))}
          />
        ))}
      </ul>
    </aside>
  );
}
