import type { Family } from "../lib/domain/types";

interface Props {
  code: string;
  startLabel: string;
  family: Family | null;
  receded: boolean;
  onLocate: () => void;
}

// The second semester of a two-semester course, in the column after its
// card. Not draggable and no menu: part 1 is the one to move, so activating
// the stub goes to part 1 instead.
export default function PartTwoStub({ code, startLabel, family, receded, onLocate }: Props) {
  return (
    <li class={`part-two-stub${receded ? " part-two-stub-receded" : ""}`} data-part-two={code} data-family={family ?? undefined}>
      <button type="button" aria-label={`${code} part 2 of 2, continued from ${startLabel}`} onClick={onLocate}>
        <strong>{code}</strong> · part 2 of 2
      </button>
    </li>
  );
}
