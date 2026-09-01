import { useId } from "react";
import FieldError from "./FieldError";
import type { FormVariant } from "./variant";

/**
 * 선택 버튼 묶음. 라디오가 아니라 토글 버튼(aria-pressed)으로 둔 것은 c안의 모양을
 * 지키기 위해서다. fieldset·legend 로 묶어야 스크린리더가 "무엇을 고르는 버튼인지"를
 * 읽는다 — 버튼 이름만으로는 「신랑측 하객」이 어느 질문의 답인지 알 수 없다.
 */
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
