import type { GroupView, PlanView } from "../lib/domain/view";
import AvailableCourseCard from "./AvailableCourseCard";
import { isError, removeCourse, setChoice } from "./api";
import ProgressBar from "./ProgressBar";

interface Props {
  view: PlanView;
  planId: string;
  onChanged: (view: PlanView) => void;
  onAnnounce: (message: string) => void;
  onDragStart?: (code: string) => void;
  onDragEnd?: () => void;
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
}

// A group with more courses than fit one row would otherwise get an
// invisible trailing "phantom" grid column from `auto-fill` sizing to the
// (shared, uniform) sidebar width, which throws off `justify-content:
// center`'s centering for any group with fewer courses than that. Capping to
// the group's own course count keeps every group's grid exactly as wide as
// its own content, still centered within the shared sidebar width.
const MAX_COLUMNS = 3;

function Group({ view, group, planId, readOnly, depth, onChanged, onAnnounce, onDragStart, onDragEnd }: GroupProps) {
  async function choose(childId: string | null) {
    const result = await setChoice(planId, group.id, childId);
    if (isError(result)) onAnnounce(result.error);
    else onChanged(result);
  }

  const placedCodes = new Set(view.placements.map((p) => p.code));
  const available = group.children.length === 0 ? group.courses.filter((code) => !placedCodes.has(code)) : [];
  const columns = Math.min(available.length, MAX_COLUMNS) || 1;

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
        <fieldset>
          <legend>Choose {group.label}</legend>
          {group.options.map((option) => (
            <label key={option.id}>
              <input
                type="radio"
                name={`choice-${group.id}`}
                checked={group.chosenId === option.id}
                disabled={readOnly}
                onChange={() => choose(option.id)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
      )}
      {available.length > 0 && (
        <ul class="available-courses" style={{ gridTemplateColumns: `repeat(${columns}, 13rem)` }}>
          {available.map((code) => (
            <AvailableCourseCard
              key={code}
              view={view}
              code={code}
              planId={planId}
              onChanged={onChanged}
              onAnnounce={onAnnounce}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
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
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function Sidebar({ view, planId, onChanged, onAnnounce, onDragStart, onDragEnd }: Props) {
  const readOnly = view.plan.readOnly;

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
        <li class="requirement-group">
          <ProgressBar
            label="Total"
            completed={view.total.completed}
            planned={view.total.planned}
            required={view.total.required}
          />
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
          />
        ))}
        <li class="requirement-group">
          <section aria-label="program checks">
            <h2>Checks</h2>
            <ul class="checks-list">
              {view.checks.map((check) => (
                <li key={check.id}>
                  {check.ok === null ? (
                    <p>{check.label}: not tracked — verify on P&C</p>
                  ) : (
                    <ProgressBar
                      label={check.label}
                      completed={check.completed}
                      planned={check.planned}
                      required={check.units}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        </li>
      </ul>
    </aside>
  );
}
