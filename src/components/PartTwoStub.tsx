import type { Family } from "../lib/domain/types";
import { type PlacedPart, unitsLabel } from "./planner-logic";

interface Props {
  code: string;
  part1: PlacedPart;
  // Per semester: this stub holds one semester's worth.
  units: number;
  family: Family | null;
  receded: boolean;
  onLocate: () => void;
}

// The second semester of a two-semester course, in the column after its
// card: part 1's card in miniature. Not draggable and no menu, because part
// 1 is the one to move. Its term goes to part 1, as part 1's goes here.
export default function PartTwoStub({ code, part1, units, family, receded, onLocate }: Props) {
  const label = unitsLabel({ units, twoSemester: false });
  return (
    <li class={`part-two-stub${receded ? " part-two-stub-receded" : ""}`} data-part-two={code} data-family={family ?? undefined}>
      <div class="course-card-head">
        <strong class="course-card-code">{code}</strong>
        <span class="course-card-unit-count">
          <span aria-hidden="true">{label.short}</span>
          <span class="visually-hidden">{label.full}</span>
        </span>
      </div>
      <p class="course-card-part">
        Part 2 of 2 · continued from{" "}
        <button
          type="button"
          class="course-card-term-link course-card-part-term"
          onClick={onLocate}
          aria-label={`${code} ${part1.spoken} — locate it on the timeline`}
        >
          {part1.termLabel}
        </button>
      </p>
    </li>
  );
}
