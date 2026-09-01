import { useId } from "react";
import FieldError from "./FieldError";
import type { FormVariant } from "./variant";

/** 입력 칸에 물릴 속성. 라벨 연결·오류 표시·보조 문구 연결이 전부 여기서 나온다. */
export interface FieldControl {
  id: string;
  className: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
}

/**
 * 라벨 + 보조 문구 + 오류 한 줄로 입력 칸을 감싼다. 안쪽에 무엇을 두는지는 부르는
 * 쪽이 정한다 — input 은 TextField 가, textarea 와 글자 수 표시는 방명록이 넣는다.
 *
 * 접근성 배선(htmlFor, aria-describedby, aria-invalid)을 이 한 곳에 모은다. RSVP 와
 * 방명록이 각자 배선을 들고 있으면 한쪽만 고쳐지고 어긋난다.
 */
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
  /** 라벨 아래 여백을 좁힐 때만 준다. 기본값은 CSS 가 정한다. */
  labelGap?: number;
  help?: string;
  error?: string;
  children: (control: FieldControl) => React.ReactNode;
}) {
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();

  // 안내와 오류가 함께 있으면 둘 다 읽힌다. 안내를 먼저 두어 「무엇을 적는 칸인지」가
  // 「무엇이 틀렸는지」보다 앞에 오게 한다.
  const describedBy = [help ? helpId : null, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div>
      {/* 라벨을 칸 위에 그대로 보인다. c안은 placeholder 를 라벨로 썼는데, 그러면
          글자를 적는 순간 무엇을 적는 칸이었는지가 화면에서 사라진다 — 나중에
          확인하려 할 때 알 길이 없고, 폼에 익숙하지 않을수록 크게 걸린다. */}
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
