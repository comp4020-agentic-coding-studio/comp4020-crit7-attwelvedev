// What the details panel shows (a course or a specialisation), and the one
// back/forward trail through everything opened from inside it. Pure, so
// Planner just holds the state and the URL helpers stay testable in node.

export type DetailsFocus = "top" | "requisites";

export type DetailsSubject = { kind: "course"; code: string } | { kind: "spec"; code: string };

export interface DetailsState {
  subject: DetailsSubject | null;
  history: DetailsSubject[];
  index: number;
  focus: DetailsFocus;
  // Bumped on every open, so re-opening the subject already shown still
  // re-runs the panel's focus effect.
  token: number;
}

export const EMPTY_DETAILS: DetailsState = { subject: null, history: [], index: -1, focus: "top", token: 0 };

// Same shape the search and course endpoints accept.
const COURSE_CODE = /^[A-Z]{4}\d{4}$/;
// P&C's subplan codes, as in data/2027/specialisations.json.
const SPEC_CODE = /^[A-Z]{4}-SPEC$/;

const sameSubject = (a: DetailsSubject | null, b: DetailsSubject) => a?.kind === b.kind && a.code === b.code;

export function openSubject(state: DetailsState, subject: DetailsSubject, focus: DetailsFocus = "top"): DetailsState {
  const token = state.token + 1;
  if (sameSubject(state.subject, subject)) return { ...state, focus, token };
  // Like a browser: opening something new after stepping back drops the
  // entries ahead of where you are.
  const history = [...state.history.slice(0, state.index + 1), subject];
  return { subject, history, index: history.length - 1, focus, token };
}

export function stepHistory(state: DetailsState, dir: -1 | 1): DetailsState {
  const index = Math.min(Math.max(state.index + dir, 0), state.history.length - 1);
  if (index === state.index || index < 0) return state;
  return { ...state, subject: state.history[index], index, focus: "top", token: state.token + 1 };
}

export function closeDetails(state: DetailsState): DetailsState {
  return { ...state, subject: null };
}

// ?course= wins when a URL somehow carries both; the page checks that a
// spec code is one it knows.
export function subjectParam(search: string): DetailsSubject | null {
  const params = new URLSearchParams(search);
  const course = params.get("course");
  if (course && COURSE_CODE.test(course)) return { kind: "course", code: course };
  const spec = params.get("spec");
  if (spec && SPEC_CODE.test(spec)) return { kind: "spec", code: spec };
  return null;
}

export function withSubjectParam(href: string, subject: DetailsSubject | null): string {
  const url = new URL(href);
  url.searchParams.delete("course");
  url.searchParams.delete("spec");
  if (subject) url.searchParams.set(subject.kind, subject.code);
  return url.toString();
}

export function courseCode(state: DetailsState): string | null {
  return state.subject?.kind === "course" ? state.subject.code : null;
}

export function specCode(state: DetailsState): string | null {
  return state.subject?.kind === "spec" ? state.subject.code : null;
}
