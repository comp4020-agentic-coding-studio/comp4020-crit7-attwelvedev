// Which course the details sidebar shows, and the back/forward trail
// through courses opened from inside it. Pure, so Planner just holds the
// state and the URL helpers stay testable in node.

export type DetailsFocus = "top" | "requisites";

export interface DetailsState {
  code: string | null;
  history: string[];
  index: number;
  focus: DetailsFocus;
  // Bumped on every open, so re-opening the course already shown still
  // re-runs the panel's focus effect.
  token: number;
}

export const EMPTY_DETAILS: DetailsState = { code: null, history: [], index: -1, focus: "top", token: 0 };

// Same shape the search and course endpoints accept.
const COURSE_CODE = /^[A-Z]{4}\d{4}$/;

export function openCourse(state: DetailsState, code: string, focus: DetailsFocus = "top"): DetailsState {
  const token = state.token + 1;
  if (state.code === code) return { ...state, focus, token };
  // Like a browser: opening something new after stepping back drops the
  // entries ahead of where you are.
  const history = [...state.history.slice(0, state.index + 1), code];
  return { code, history, index: history.length - 1, focus, token };
}

export function stepHistory(state: DetailsState, dir: -1 | 1): DetailsState {
  const index = Math.min(Math.max(state.index + dir, 0), state.history.length - 1);
  if (index === state.index || index < 0) return state;
  return { ...state, code: state.history[index], index, focus: "top", token: state.token + 1 };
}

export function closeDetails(state: DetailsState): DetailsState {
  return { ...state, code: null };
}

export function courseParam(search: string): string | null {
  const code = new URLSearchParams(search).get("course");
  return code && COURSE_CODE.test(code) ? code : null;
}

export function withCourseParam(href: string, code: string | null): string {
  const url = new URL(href);
  if (code) url.searchParams.set("course", code);
  else url.searchParams.delete("course");
  return url.toString();
}
