import { useId } from "react";
import FieldError from "./FieldError";
import type { FormVariant } from "./variant";

export default function PickGroup({
  legend,
  options,
  value,
  error,
  onPick,
  variant,
}: {
  legend: string;
  options: readonly { value: string; label: string }[];
  value: string;
  error?: string;
  onPick: (value: string) => void;
  variant?: FormVariant;
}) {
  const errorId = useId();

  return (
    <div>
      <fieldset className="pick-group" aria-describedby={error ? errorId : undefined}>
        <legend className="sr-only">{legend}</legend>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="pick-btn"
            aria-pressed={value === option.value}
            onClick={() => onPick(option.value)}
          >
            {option.label}
          </button>
        ))}
      </fieldset>
      {error && <FieldError id={errorId} message={error} variant={variant} />}
    </div>
  );
}
