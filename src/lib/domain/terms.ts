import type { Session, Term } from "./types";

function buildTerms(): Term[] {
  const terms: Term[] = [];
  let year = 2027;
  let session: Session = "S1";
  for (let index = 0; index < 8; index++) {
    terms.push({ index, year, session, label: `${session} ${year}` });
    if (session === "S1") {
      session = "S2";
    } else {
      session = "S1";
      year++;
    }
  }
  return terms;
}

export const TERMS: readonly Term[] = buildTerms();

export function termLabel(index: number): string {
  const term = TERMS[index];
  if (!term) {
    throw new RangeError(`term index out of range: ${index}`);
  }
  return term.label;
}
