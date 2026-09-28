import type { PlanView } from "../lib/domain/view";
import ChoiceMenu from "./ChoiceMenu";
import { completedReadout, cutoffOptions } from "./planner-logic";

interface Props {
  view: PlanView;
  // Controlled from Planner.tsx through the same openMenuCode as More
  // options and the course menus, so only one of them is ever open.
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (cutoff: number) => void;
  pending: boolean;
}

// Not a MoreOptions instance: the page's More options is found by its
// classes, and a second one earlier in the title row would be found first.
export default function CompletedMenu({ view, open, onOpenChange, onChoose, pending }: Props) {
  const cutoff = view.plan.cutoff;
  return (
    <ChoiceMenu
      name="completed"
      options={cutoffOptions(view.terms)}
      value={cutoff}
      open={open}
      onOpenChange={onOpenChange}
      onChoose={onChoose}
      pending={pending}
      description={completedReadout(cutoff, view.terms).full}
      toggle={
        // Every possible label shares one grid cell, so the toggle is as wide
        // as the longest and choosing a semester never shifts the row.
        <span class="completed-toggle-labels">
          {cutoffOptions(view.terms).map(({ value }) =>
            value === cutoff ? (
              <span key={value} data-current>
                {completedReadout(value, view.terms).short}
              </span>
            ) : (
              <span key={value} aria-hidden="true">
                {completedReadout(value, view.terms).short}
              </span>
            ),
          )}
        </span>
      }
    />
  );
}
