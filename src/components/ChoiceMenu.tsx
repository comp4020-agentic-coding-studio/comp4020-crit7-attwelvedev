import type { ComponentChildren } from "preact";
import { useEffect, useId, useRef } from "preact/hooks";

interface Props<T> {
  // Names this instance's classes (`${name}-menu`, `-toggle`, `-panel`):
  // the header's menu keeps the exact markup it had before this was shared.
  name: string;
  options: { value: T; label: string }[];
  value: T;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (value: T) => void;
  // What the toggle shows; the panel lists `options` by label.
  toggle: ComponentChildren;
  // Heard with the toggle, for when what it shows is abbreviated.
  description?: string;
  disabled?: boolean; // the toggle
  pending?: boolean; // the options, while a choice is being saved
}

// A pick-one menu drawn in More options' design, not a native <select>,
// whose picker looks out of place beside the rest of the page. A disclosure
// of buttons rather than an ARIA listbox: the current choice is marked with
// aria-current, Escape closes it onto its toggle, and a press outside closes
// it.
export default function ChoiceMenu<T>({
  name,
  options,
  value,
  open,
  onOpenChange,
  onChoose,
  toggle,
  description,
  disabled = false,
  pending = false,
}: Props<T>) {
  const panelId = useId();
  const descriptionId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePress(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open]);

  return (
    <div
      class={`${name}-menu`}
      ref={rootRef}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || !open) return;
        // Handled here, so an enclosing Escape handler (the details
        // sidebar's) doesn't also act on it.
        event.stopPropagation();
        onOpenChange(false);
        toggleRef.current?.focus();
      }}
    >
      <button
        type="button"
        class={`${name}-toggle`}
        ref={toggleRef}
        aria-expanded={open}
        aria-controls={panelId}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => onOpenChange(!open)}
      >
        {toggle}
        <svg class="section-toggle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div id={panelId} class={`${name}-panel`} hidden={!open}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            aria-current={option.value === value ? "true" : undefined}
            disabled={pending}
            onClick={() => {
              onChoose(option.value);
              onOpenChange(false);
              toggleRef.current?.focus();
            }}
          >
            {option.value === value && (
              <span class="choice-check" aria-hidden="true">
                ✓
              </span>
            )}
            {option.label}
          </button>
        ))}
      </div>
      {description && (
        <span id={descriptionId} class="visually-hidden">
          {description}
        </span>
      )}
    </div>
  );
}
