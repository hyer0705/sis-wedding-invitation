import Field from "./Field";
import type { FormVariant } from "./variant";

export default function TextField({
  variant,
  label,
  labelGap,
  help,
  hint,
  error,
  inputMode,
  autoComplete,
  ref,
  ...field
}: {
  variant?: FormVariant;
  label: string;
  labelGap?: number;
  help?: string;
  hint?: string;
  error?: string;
  inputMode?: "numeric" | "tel";
  autoComplete?: string;
} & React.ComponentPropsWithRef<"input">) {
  return (
    <Field variant={variant} label={label} labelGap={labelGap} help={help} error={error}>
      {(control) => (
        <input {...field} {...control} ref={ref} placeholder={hint} inputMode={inputMode} autoComplete={autoComplete} />
      )}
    </Field>
  );
}
