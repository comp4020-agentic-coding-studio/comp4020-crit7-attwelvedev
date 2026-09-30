import type { CheckAnswer } from "../lib/domain/types";
import type { CourseCard, CourseDetailsView, PlanView } from "../lib/domain/view";
import type { WhatIfView } from "../lib/domain/what-if";

export type ApiResult = PlanView | { error: string };

export type SearchResult = {
  status: "found" | "fetched" | "not_found" | "error" | "invalid";
  courses: CourseCard[];
  message?: string;
};

async function request(path: string, init: RequestInit): Promise<ApiResult> {
  const res = await fetch(path, init);
  const body = (await res.json()) as PlanView | { error: string };
  if (!res.ok) return { error: "error" in body ? body.error : "Request failed" };
  return body;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export function placeCourse(planId: string, code: string, term: number): Promise<ApiResult> {
  return request(`/api/plans/${planId}/placements`, jsonInit("POST", { code, term }));
}

export function removeCourse(planId: string, code: string): Promise<ApiResult> {
  return request(`/api/plans/${planId}/placements/${code}`, { method: "DELETE" });
}

export function setCutoff(planId: string, cutoff: number): Promise<ApiResult> {
  return request(`/api/plans/${planId}/cutoff`, jsonInit("PUT", { cutoff }));
}

export function setChoice(planId: string, groupId: string, childId: string | null): Promise<ApiResult> {
  return request(`/api/plans/${planId}/choices`, jsonInit("PUT", { groupId, childId }));
}

export function setPin(planId: string, code: string, groupId: string | null): Promise<ApiResult> {
  return request(`/api/plans/${planId}/pins`, jsonInit("PUT", { code, groupId }));
}

export function setCheck(planId: string, code: string, item: string, answer: CheckAnswer | null): Promise<ApiResult> {
  return request(`/api/plans/${planId}/checks`, jsonInit("PUT", { code, item, answer }));
}

export function isError(result: ApiResult): result is { error: string } {
  return "error" in result;
}

export async function searchCourses(q: string, planId?: string): Promise<SearchResult> {
  const params = new URLSearchParams({ q });
  if (planId) params.set("plan", planId);
  const res = await fetch(`/api/courses/search?${params.toString()}`);
  return (await res.json()) as SearchResult;
}

export async function fetchCourseDetails(code: string, planId?: string): Promise<CourseDetailsView | { error: string }> {
  const params = new URLSearchParams();
  if (planId) params.set("plan", planId);
  const res = await fetch(`/api/courses/${encodeURIComponent(code)}?${params.toString()}`);
  const body = (await res.json()) as CourseDetailsView | { error: string };
  if (!res.ok) return { error: "error" in body ? body.error : "Request failed" };
  return body;
}

export async function fetchWhatIf(planId: string, groupId: string, optionId: string): Promise<WhatIfView | { error: string }> {
  const params = new URLSearchParams({ group: groupId, option: optionId });
  const res = await fetch(`/api/plans/${encodeURIComponent(planId)}/what-if?${params.toString()}`);
  const body = (await res.json()) as WhatIfView | { error: string };
  if (!res.ok) return { error: "error" in body ? body.error : "Request failed" };
  return body;
}
