import { useState } from "preact/hooks";
import type { GroupView, PlanView } from "../lib/domain/view";
import AvailableCourseCard from "./AvailableCourseCard";
import { isError, removeCourse, setChoice } from "./api";
import CourseSearch from "./CourseSearch";
import { outstandingItems } from "./planner-logic";
import ProgressBar from "./ProgressBar";

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
}

// A group with more courses than fit one row would otherwise get an
// invisible trailing "phantom" grid column from `auto-fill` sizing to the
// (shared, uniform) sidebar width, which throws off `justify-content:
// center`'s centering for any group with fewer courses than that. Capping to
// the group's own course count keeps every group's grid exactly as wide as
// its own content, still centered within the shared sidebar width.
const MAX_COLUMNS = 3;

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

  // Depth becomes the heading level (h2 for top-level, following the page's
  // single h1, h3 for its children, etc.) instead of a bullet list — every
  // level renders its own fixed tag, so the sequence never skips a level.
  const Heading = `h${Math.min(depth + 2, 6)}` as "h2" | "h3" | "h4" | "h5" | "h6";

  return (
    <li class={depth === 0 ? "requirement-group" : undefined}>
      <Heading>{group.label}</Heading>
      <ProgressBar
        label={group.label}
        completed={group.completed}
        planned={group.planned}
        required={group.unitsRequired}
      />
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
        <li class="requirement-group outstanding-panel">
          <h2>What's left</h2>
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
        </li>
        <li class="requirement-group">
          <CourseSearch
            view={view}
            planId={planId}
            onChanged={onChanged}
            onAnnounce={onAnnounce}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            openMenuCode={openMenuCode}
            onMenuOpenChange={onMenuOpenChange}
          />
        </li>
        <li class="requirement-group">
          <h2>Total</h2>
          <ProgressBar
            label="Total"
            completed={view.total.completed}
            planned={view.total.planned}
            required={view.total.required}
          />
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
        </li>
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
          />
        ))}
      </ul>
    </aside>
  );
}
