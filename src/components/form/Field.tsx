import { useId } from "react";
import FieldError from "./FieldError";
import type { FormVariant } from "./variant";

export interface FieldControl {
  id: string;
  className: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
}

export default function Field({
  variant = "rsvp",
  label,
  labelGap,
  help,
  error,
  children,
}: {
  variant?: FormVariant;
  label: string;
  labelGap?: number;
  help?: string;
  error?: string;
  children: (control: FieldControl) => React.ReactNode;
}) {
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();

  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div>
      <label
        className={`${variant}-label`}
        htmlFor={inputId}
        style={labelGap === undefined ? undefined : { marginBottom: labelGap }}
      >
        {label}
      </label>
      {help && (
        <span id={helpId} className={`${variant}-help`}>
          {help}
        </span>
      )}
      {children({
        id: inputId,
        className: `${variant}-input${error ? ` ${variant}-invalid` : ""}`,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}
      {error && <FieldError id={errorId} message={error} variant={variant} />}
    </div>
  );
}
