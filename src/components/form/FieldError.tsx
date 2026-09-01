import type { FormVariant } from "./variant";

export default function FieldError({ id, message, variant = "rsvp" }: { id: string; message: string; variant?: FormVariant }) {
  return (
    <p id={id} className={`${variant}-error`} role="alert">
      {message}
    </p>
  );
}
