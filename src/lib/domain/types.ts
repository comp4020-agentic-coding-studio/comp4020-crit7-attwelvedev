export type Session = "S1" | "S2";
export interface Term { index: number; year: number; session: Session; label: string } // label "S1 2027"
export interface CourseFilter {
  prefixes?: string[]; minLevel?: number; maxLevel?: number;
  codes?: string[]; excludeCodes?: string[]; tdp?: boolean;
}
export type ReqExpr =
  | { kind: "and"; items: ReqExpr[] }
  | { kind: "or"; items: ReqExpr[] }
  | { kind: "course"; code: string; concurrent: boolean }
  | { kind: "units"; units: number; filter: CourseFilter; text: string }
  | { kind: "program"; code: string | null; name: string; satisfied: boolean }
  | { kind: "unverifiable"; text: string };
export interface ParsedRequisites {
  prereq: ReqExpr | null; incompatible: string[];
  unverifiable: string[]; otherPrograms: string[]; parseStatus: "ok" | "partial";
}
export interface Offering { year: number; session: string } // session verbatim, e.g. "First Semester"
export interface CatalogueCourse {
  code: string; title: string; units: number; level: number; description: string; url: string;
  offerings: Offering[]; requisites: ParsedRequisites; requisiteRaw: string;
  twoSemester: boolean; isTdp: boolean; isStub: boolean; scrapedAt: string;
}
export interface Catalogue { courses: Map<string, CatalogueCourse>; horizonYear: number }
export type OfferingStatus = "offered" | "not-offered" | "projected" | "unknown";
export interface Placement { code: string; term: number; pinnedGroupId: string | null }
export type CheckAnswer = "met" | "not-met";
export type PlanChecks = Record<string, Record<string, CheckAnswer>>; // course code -> verify item text -> answer; absent = "Not sure"
export interface PlanState {
  id: string; readOnly: boolean; cutoff: number;
  choices: Record<string, string>; // selectable groupId -> chosen child groupId
  placements: Placement[];
  checks?: PlanChecks;
}
export type GroupKind = "core" | "major" | "minor" | "specialisation" | "elective";
export type RuleType = "ALL" | "UNITS" | "CHOOSE_N";
export type Family = "foundations" | "specialisation" | "advanced" | "ict" | "capstone" | "neutral";
export interface GroupDef {
  id: string; label: string; kind: GroupKind; ruleType: RuleType;
  unitsRequired: number; unitsMax?: number; selectable?: boolean;
  courses?: string[]; filter?: CourseFilter; children?: GroupDef[];
  family?: Family; // top-level groups only; nested groups inherit theirs (view.ts)
}
export interface ProgramCheckDef { id: string; label: string; bound: "min" | "max"; units: number; filter: CourseFilter }
export interface ProgramDef {
  code: string; name: string; year: number; totalUnits: number;
  groups: GroupDef[]; checks: ProgramCheckDef[]; tdpCourses: string[] | null;
}
