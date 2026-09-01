import type { FormVariant } from "./variant";

/** 오류 한 줄. role="alert" 로 새로 뜬 오류가 스크린리더에 바로 읽히게 한다. */
export default function FieldError({ id, message, variant = "rsvp" }: { id: string; message: string; variant?: FormVariant }) {
  return (
    <p id={id} className={`${variant}-error`} role="alert">
      {message}
    </p>
  );
}
