import { useState } from "preact/hooks";
import type { PlacementView, PlanView } from "../lib/domain/view";
import CourseCardHeader from "./CourseCardHeader";
import type { DetailsFocus } from "./details-state";
import MoreOptions from "./MoreOptions";
import { actionFor, type PlanAction } from "./plan-actions";
import {
  familyOf,
  groupLabel,
  type LinkedHighlights,
  menuTargets,
  partOneMarker,
  placedStatus,
  unplacedCount,
  verifyBadgeText,
} from "./planner-logic";

interface Props {
  view: PlanView;
  placement: PlacementView;
  // Moves, removes and suggestions all go through Planner's runAction.
  onAction: (action: PlanAction) => Promise<void>;
  onDragStart?: (code: string) => void;
  onDragEnd?: () => void;
  openMenuCode: string | null;
  onMenuOpenChange: (code: string, open: boolean) => void;
  onShowGroup: (groupId: string) => void;
  // A two-semester card's marker term asks for its part 2 stub through
  // this, as the sidebar row's part 2 button does.
  onLocateCourse: (code: string, part?: 2) => void;
  // Outside the sidebar group under hover or focus.
  receded: boolean;
  // Opens this course in the details sidebar.
  onOpenDetails: (code: string, focus?: DetailsFocus) => void;
  // This course is the one open in the details sidebar.
  current: boolean;
  // What the open course links to: this card may be its prerequisite or
  // need it, or be the open course itself.
  linked: LinkedHighlights | null;
}

export default function CourseCard({
  view,
  placement,
  onAction,
  onDragStart,
  onDragEnd,
  openMenuCode,
  onMenuOpenChange,
  onShowGroup,
  onLocateCourse,
  receded,
  onOpenDetails,
  current,
  linked,
}: Props) {
  const course = view.courses[placement.code];
  const readOnly = view.plan.readOnly;
  // Guards this card's own buttons for the duration of its own in-flight
  // request — not a global lock, so moving one card doesn't freeze others,
  // but does stop a slow connection from inviting a double-click that
  // fires the same move/remove twice.
  const [pending, setPending] = useState(false);

  async function run(action: PlanAction) {
    setPending(true);
    try {
      await onAction(action);
    } finally {
      setPending(false);
    }
  }

  const family = placement.countsToward ? familyOf(view, placement.countsToward) : null;
  const marker = partOneMarker(view, placement);
  const part2 = placedStatus(view, placement).parts[1];

  const { targets, blockedReasons } = menuTargets(view, placement.code, {
    currentTerm: placement.term,
    twoSemester: course?.twoSemester,
  });

  const stateText = {
    hard: "Blocked",
    soft: "Needs prerequisites",
    check: "Check requirements",
    available: "Available",
  }[placement.state];

  return (
    <li
      class={`course-card course-card-${placement.state}${receded ? " course-card-receded" : ""}${linked?.code === placement.code ? " course-card-selected" : ""}`}
      data-placed={placement.code}
      data-family={family ?? undefined}
      aria-busy={pending}
      // Not in the tab order (no ordinary reason to tab onto a card), but
      // focusable programmatically so the sidebar's "locate on timeline"
      // badge can move focus here, not just scroll it into view.
      tabIndex={-1}
      draggable={!readOnly}
      // Native HTML5 drag never fires from a touch gesture on any mobile
      // browser (it's mouse-only) — Planner's touch-drag effect finds
      // draggable cards through this attribute instead, delegated from the
      // planner root so touch dragging works without a second copy of
      // per-card listeners.
      data-drag-code={readOnly ? undefined : placement.code}
      title={placement.reasons.join("; ") || undefined}
      onDragStart={(event) => {
        if (readOnly) {
          event.preventDefault();
          return;
        }
        event.dataTransfer?.setData("text/plain", placement.code);
        onDragStart?.(placement.code);
      }}
      onDragEnd={() => onDragEnd?.()}
    >
      <CourseCardHeader
        code={placement.code}
        title={course?.title ?? placement.code}
        // A timeline card holds one semester, so it shows one semester's
        // units, the amount the term's header counts. A two-semester
        // course's other half shows its own on the stub.
        units={{ units: course?.units ?? 0, twoSemester: false }}
        grip={!readOnly}
        onOpenDetails={() => onOpenDetails(placement.code)}
        current={current}
      />
      {marker && (
        <p class="course-card-part">
          {marker.text}
          {marker.termLabel && part2 && (
            <>
              {" "}
              <button
                type="button"
                class="course-card-term-link course-card-part-term"
                onClick={() => onLocateCourse(placement.code, 2)}
                aria-label={`${placement.code} ${part2.spoken} — locate it on the timeline`}
              >
                {marker.termLabel}
              </button>
            </>
          )}
        </p>
      )}
      {linked?.prereqOf[placement.code] && (
        <p class="badge badge-linked">
          {linked.prereqOf[placement.code] === "ok"
            ? `Prerequisite of ${linked.code}`
            : "Prerequisite, planned too late"}
        </p>
      )}
      {linked?.needs.includes(placement.code) && <p class="badge badge-linked">Needs {linked.code}</p>}
      <p
        class={`badge badge-state-${placement.state}${placement.state === "available" ? " visually-hidden" : ""}`}
      >
        {stateText}
      </p>
      {placement.reasons.length > 0 && (
        <p class="badge badge-reason">{placement.reasons.join("; ")}</p>
      )}
      {placement.verify.length > 0 && (
        <button
          type="button"
          class="badge badge-verify"
          // The badge is about the items to verify, so Details opens at them.
          onClick={() => onOpenDetails(placement.code, "requisites")}
        >
          {verifyBadgeText(placement.verify.length)}
        </button>
      )}
      {placement.conflictWith.length > 0 && (
        <p class="badge badge-conflict">
          {placement.loser ? "Excluded — conflicts with " : "Conflicts with "}
          {placement.conflictWith.join(", ")}
        </p>
      )}
      {course?.offeringUnknown && <p class="badge badge-unknown">No published offering — verify on P&C</p>}
      {course?.projectedTerms.includes(placement.term) && <p class="badge badge-projected">Projected offering</p>}
      {placement.state === "soft" && unplacedCount(view, placement.code) > 0 && (
        <p class="badge badge-unplaced-prereqs">
          {unplacedCount(view, placement.code)} prerequisite{unplacedCount(view, placement.code) === 1 ? "" : "s"} not
          placed
        </p>
      )}
      {placement.state === "soft" && placement.suggestions.length > 0 && (
        <ul class="course-card-suggestions">
          {placement.suggestions.map((suggestion) => (
            <li key={`${suggestion.action}-${suggestion.code}-${suggestion.term}`}>
              <button
                type="button"
                disabled={readOnly || pending}
                onClick={() => run(actionFor(view, suggestion.code, suggestion.term))}
              >
                {suggestion.text}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div class="course-card-foot">
        {/* A link to the group it serves, on read-only plans too: finding
            the requirement isn't an edit. */}
        {placement.countsToward ? (
          <button
            type="button"
            class="course-card-allocation"
            onClick={() => onShowGroup(placement.countsToward!)}
          >
            {family && family !== "neutral" && <span class="family-dot" data-family={family} aria-hidden="true" />}
            Counts toward {groupLabel(view, placement.countsToward)}
            <span class="visually-hidden">, show in requirements</span>
          </button>
        ) : (
          <p class="course-card-allocation">Not counting toward any requirement</p>
        )}
        {/* Rare actions, out of sight until asked for. A read-only plan gets
            no menu at all rather than one full of disabled buttons; its
            title still opens Details. */}
        {!readOnly && (
          <MoreOptions
            class="course-card-menu"
            label={`More options for ${placement.code}`}
            fixed
            open={openMenuCode === placement.code}
            onOpenChange={(open) => onMenuOpenChange(placement.code, open)}
          >
            <button
              type="button"
              onClick={() => {
                onMenuOpenChange(placement.code, false);
                onOpenDetails(placement.code);
              }}
            >
              Details
            </button>
            <p class="card-menu-heading">Move to</p>
            {targets.length === 0 ? (
              <p class="card-menu-empty">
                No available terms{blockedReasons.length > 0 && <> — {blockedReasons.join("; ")}</>}
              </p>
            ) : (
              <ul class="card-menu-terms" aria-label={`Move ${placement.code} to`}>
                {targets.map((target) => (
                  <li key={target.term}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        onMenuOpenChange(placement.code, false);
                        void run({ kind: "move", code: placement.code, term: target.term });
                      }}
                    >
                      {target.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              class="card-menu-remove"
              disabled={pending}
              onClick={() => {
                onMenuOpenChange(placement.code, false);
                void run({ kind: "remove", code: placement.code });
              }}
            >
              {pending ? "Removing…" : "Remove"}
            </button>
          </MoreOptions>
        )}
      </div>
    </li>
  );
}
