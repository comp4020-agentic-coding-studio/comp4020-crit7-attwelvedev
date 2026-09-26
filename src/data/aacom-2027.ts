import type { GroupDef, ProgramDef } from "../lib/domain/types";
// A static import, not readFileSync: the Dockerfile only copies
// node_modules, dist and drizzle (see astro.config.ts / NFR "bundled data"),
// so a runtime fs read of data/2027/tdp.json ENOENTs in production. The
// bundler inlines a static JSON import into dist instead.
import tdp from "../../data/2027/tdp.json";

export const KNOWN_MISSING: string[] = [];

const COMP_4000: GroupDef["filter"] = { prefixes: ["COMP"], minLevel: 4000, maxLevel: 4000 };

// ML (MACL-SPEC) was merged into ARIN from 2027; MACL-SPEC 2027 is a 404 on
// P&C. The AACOM page's "Machine Learning" specialisation line is stale.
const specialisations: GroupDef[] = [
  {
    id: "arin",
    label: "Artificial Intelligence",
    kind: "specialisation",
    ruleType: "UNITS",
    unitsRequired: 24,
    unitsMax: 24,
    children: [
      {
        id: "arin-a",
        label: "Artificial Intelligence — foundations (max 12)",
        kind: "specialisation",
        ruleType: "UNITS",
        unitsRequired: 0,
        unitsMax: 12,
        courses: ["COMP2620", "COMP3242", "COMP3620", "COMP3670"],
      },
      {
        id: "arin-b",
        label: "Artificial Intelligence — advanced (min 12)",
        kind: "specialisation",
        ruleType: "UNITS",
        unitsRequired: 12,
        courses: ["COMP4528", "COMP4620", "COMP4650", "COMP4670", "COMP4680", "COMP4691"],
      },
    ],
  },
  {
    id: "hccc",
    label: "Human-Centred & Creative Computing",
    kind: "specialisation",
    ruleType: "UNITS",
    unitsRequired: 24,
    unitsMax: 24,
    children: [
      {
        id: "hccc-core",
        label: "HCCC core",
        kind: "specialisation",
        ruleType: "ALL",
        unitsRequired: 6,
        courses: ["COMP3900"],
      },
      {
        id: "hccc-b",
        label: "HCCC — advanced (min 12)",
        kind: "specialisation",
        ruleType: "UNITS",
        unitsRequired: 12,
        courses: ["COMP4020", "COMP4350", "COMP4528", "COMP4610"],
      },
      {
        id: "hccc-c",
        label: "HCCC — foundations (max 6)",
        kind: "specialisation",
        ruleType: "UNITS",
        unitsRequired: 0,
        unitsMax: 6,
        courses: ["COMP3540", "COMP3670"],
      },
    ],
  },
  {
    id: "syar",
    label: "Systems & Architecture",
    kind: "specialisation",
    ruleType: "UNITS",
    unitsRequired: 24,
    unitsMax: 24,
    children: [
      {
        id: "syar-b",
        label: "Systems & Architecture — advanced (min 12)",
        kind: "specialisation",
        ruleType: "UNITS",
        unitsRequired: 12,
        courses: ["COMP4045", "COMP4300", "COMP4712"],
      },
      {
        id: "syar-a",
        label: "Systems & Architecture — foundations (max 12)",
        kind: "specialisation",
        ruleType: "UNITS",
        unitsRequired: 0,
        unitsMax: 12,
        courses: ["COMP3300", "COMP3310", "COMP3320", "COMP3610"],
      },
    ],
  },
  {
    id: "thcs",
    label: "Theoretical Computer Science",
    kind: "specialisation",
    ruleType: "UNITS",
    unitsRequired: 24,
    unitsMax: 24,
    children: [
      {
        id: "thcs-b",
        label: "Theoretical Computer Science — advanced (min 12)",
        kind: "specialisation",
        ruleType: "UNITS",
        unitsRequired: 12,
        courses: ["COMP4011", "COMP4600", "MATH4343"],
      },
      {
        id: "thcs-a",
        label: "Theoretical Computer Science — foundations (max 12)",
        kind: "specialisation",
        ruleType: "UNITS",
        unitsRequired: 0,
        unitsMax: 12,
        courses: ["COMP2620", "COMP3610", "COMP3630", "COMP4712"],
      },
    ],
  },
];

const capstoneOptions: GroupDef[] = [
  {
    id: "cap-research",
    label: "Research project",
    kind: "core",
    ruleType: "ALL",
    unitsRequired: 24,
    courses: ["COMP4550"], // 12+12, two-semester
  },
  {
    id: "cap-team",
    label: "Team project",
    kind: "core",
    ruleType: "UNITS",
    unitsRequired: 24,
    unitsMax: 24,
    children: [
      {
        id: "cap-team-proj",
        label: "Team project course",
        kind: "core",
        ruleType: "ALL",
        unitsRequired: 12,
        courses: ["COMP4500"], // 6+6, two-semester
      },
      {
        id: "cap-team-4k",
        label: "Further 4000-level COMP",
        kind: "core",
        ruleType: "UNITS",
        unitsRequired: 12,
        filter: COMP_4000,
      },
    ],
  },
  {
    id: "cap-intern",
    label: "Internship",
    kind: "core",
    ruleType: "UNITS",
    unitsRequired: 24,
    unitsMax: 24,
    children: [
      {
        id: "cap-intern-proj",
        label: "Internship course",
        kind: "core",
        ruleType: "ALL",
        unitsRequired: 12,
        courses: ["COMP4820"],
      },
      {
        id: "cap-intern-4k",
        label: "Further 4000-level COMP",
        kind: "core",
        ruleType: "UNITS",
        unitsRequired: 12,
        filter: COMP_4000,
      },
    ],
  },
];

export const AACOM_2027: ProgramDef = {
  code: "AACOM",
  name: "Bachelor of Advanced Computing (Honours)",
  year: 2027,
  totalUnits: 192,
  groups: [
    {
      id: "prog-a",
      label: "Programming as Problem Solving",
      kind: "core",
      ruleType: "UNITS",
      unitsRequired: 6,
      courses: ["COMP1100", "COMP1130"],
    },
    {
      id: "prog-b",
      label: "Structured Programming",
      kind: "core",
      ruleType: "UNITS",
      unitsRequired: 6,
      courses: ["COMP1110", "COMP1140"],
    },
    {
      id: "math-disc",
      label: "Discrete mathematics",
      kind: "core",
      ruleType: "UNITS",
      unitsRequired: 6,
      courses: ["MATH1005", "MATH2222"],
    },
    {
      id: "compulsory",
      label: "Compulsory courses",
      kind: "core",
      ruleType: "ALL",
      unitsRequired: 48,
      courses: ["COMP2100", "COMP2120", "COMP2300", "COMP2310", "COMP2400", "COMP3600", "COMP3630", "COMP4450"],
    },
    {
      id: "spec",
      label: "Specialisation",
      kind: "specialisation",
      ruleType: "UNITS",
      unitsRequired: 24,
      selectable: true,
      children: specialisations,
    },
    {
      id: "comp-upper",
      label: "3000/4000-level COMP",
      kind: "elective",
      ruleType: "UNITS",
      unitsRequired: 18,
      filter: { prefixes: ["COMP"], minLevel: 3000, maxLevel: 4000 },
    },
    {
      id: "ict",
      label: "ICT-related courses",
      kind: "elective",
      ruleType: "UNITS",
      unitsRequired: 12,
      courses: [
        "ARTH2181", "ASIA3032", "DESN2010", "ENGN1211", "ENVS2015", "INFS2024",
        "INFS3002", "INFS3024", "MATH1013", "MATH1115", "MATH2301", "MATH2307",
        "MGMT2009", "MUSI3309", "SCOM3029", "SOCY2038", "SOCY2166", "STAT1003", "STAT1008",
      ],
    },
    {
      id: "capstone",
      label: "Capstone",
      kind: "core",
      ruleType: "UNITS",
      unitsRequired: 24,
      selectable: true,
      children: capstoneOptions,
    },
    {
      id: "electives",
      label: "Electives",
      kind: "elective",
      ruleType: "UNITS",
      unitsRequired: 48,
      filter: {},
    },
  ],
  checks: [
    { id: "lvl1000-max", label: "At most 60 units at 1000-level", bound: "max", units: 60, filter: { minLevel: 1000, maxLevel: 1000 } },
    { id: "comp4000-min", label: "At least 48 units of 4000-level COMP", bound: "min", units: 48, filter: COMP_4000 },
    { id: "tdp-min", label: "At least 12 units of TDP-tagged courses", bound: "min", units: 12, filter: { tdp: true } },
  ],
  tdpCourses: tdp.courses,
};
