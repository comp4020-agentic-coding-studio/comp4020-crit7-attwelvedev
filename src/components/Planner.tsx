import type { PlacementView, PlanView } from "../lib/domain/view";

interface Props {
  view: PlanView;
}

export default function Planner({ view }: Props) {
  const placementsByTerm = new Map<number, PlacementView[]>();
  for (const placement of view.placements) {
    const list = placementsByTerm.get(placement.term) ?? [];
    list.push(placement);
    placementsByTerm.set(placement.term, list);
  }

  return (
    <div class="planner" data-cutoff={view.plan.cutoff}>
      <aside aria-label="requirements">
        <ol>
          {view.groups.map((group) => (
            <li key={group.id}>{group.label}</li>
          ))}
        </ol>
      </aside>
      <div class="timeline">
        {view.terms.map((term) => (
          <section key={term.index} data-term={term.index} aria-label={term.label}>
            <h2>{term.label}</h2>
            {term.overload && <p role="status">Overload: {term.units} units</p>}
            <ul>
              {(placementsByTerm.get(term.index) ?? []).map((placement) => {
                const course = view.courses[placement.code];
                return (
                  <li key={placement.code} data-placed={placement.code}>
                    <strong>{placement.code}</strong>
                    {course ? ` — ${course.title}` : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
