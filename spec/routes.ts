// The routes the invariants run against. When you add a page, add its route
// here, or the invariants stop covering it.
export const ROUTES = ["/", "/readme/", "/help/", "/plan/example"];

// A page's other server-rendered states, checked by the invariants too.
// Kept apart from ROUTES, which the layout suite also reuses for page-chrome
// geometry: the interim details drawer covers the whole phone screen by
// design, so it doesn't belong in that check.
export const STATE_ROUTES = [
  "/plan/example?course=COMP2100",
  "/plan/example?spec=ARIN-SPEC",
  "/plan/example?spec=HCCC-SPEC",
];
