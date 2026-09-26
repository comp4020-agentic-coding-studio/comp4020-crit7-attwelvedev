import type { CatalogueCourse, CourseFilter } from "./types";

export function matchesFilter(course: CatalogueCourse, f: CourseFilter, tdp: Set<string> | null): boolean {
  if (f.codes && !f.codes.includes(course.code)) return false;
  if (f.excludeCodes?.includes(course.code)) return false;
  if (f.prefixes && !f.prefixes.some((p) => course.code.startsWith(p))) return false;
  if (f.minLevel !== undefined && course.level < f.minLevel) return false;
  if (f.maxLevel !== undefined && course.level > f.maxLevel) return false;
  if (f.tdp) {
    if (tdp === null || !tdp.has(course.code)) return false;
  }
  return true;
}

export function filterLabel(f: CourseFilter): string {
  if (f.codes) return f.codes.join(" or ");
  const parts: string[] = [];
  if (f.prefixes) parts.push(f.prefixes.join("/"));
  if (f.tdp) parts.push("TDP-tagged");
  if (f.minLevel !== undefined) {
    parts.push(f.minLevel === f.maxLevel ? `${f.minLevel}-level` : `${f.minLevel}–${f.maxLevel}-level`);
  }
  parts.push("courses");
  return parts.join(" ");
}
