import Field from "./Field";
import type { FormVariant } from "./variant";

/**
 * 한 줄 입력 칸. RSVP 와 방명록이 함께 쓴다.
 *
 * register 가 돌려주는 props 를 그대로 받도록 ref 를 넘긴다. RHF 는 이 ref 로 입력을
 * 잡아 오류가 난 첫 칸에 포커스를 준다.
 */
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
  /**
   * 라벨 아래에 남는 안내 문구 (SIS-36).
   *
   * hint 를 넓혀 쓰지 않은 이유가 둘이다. placeholder 는 글자를 적는 순간 사라져
   * 정작 적는 동안에는 보이지 않고, 그 문자열은 review-guard.mjs 의 예시 번호
   * 목록에 등록되어 검토 게이트를 통과한다 — 바꾸면 가드까지 함께 봐야 한다.
   */
  help?: string;
  /** 형식 예시. placeholder 는 이것만 담는다. */
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
