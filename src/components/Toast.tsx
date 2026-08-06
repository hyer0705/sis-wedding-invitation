import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "motion/react";

// c안의 토스트(§TOAST). 복사처럼 화면이 바뀌지 않는 동작의 결과를 알린다.
// 계좌 복사(AC-02)도 같은 것을 쓸 예정이라 컴포넌트로 떼어 뒀다.

const VISIBLE_MS = 1800;

/**
 * 토스트 문구와 그것을 띄우는 함수를 돌려준다.
 *
 * 이미 떠 있는 동안 다시 부르면 시간을 새로 센다 — 버튼을 연달아 누르면 마지막 것이
 * 기준이 된다.
 */
export function useToast(duration = VISIBLE_MS) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const clear = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const show = useCallback(
    (text: string) => {
      clear();
      setMessage(text);
      timerRef.current = window.setTimeout(() => setMessage(null), duration);
    },
    [duration],
  );

  // 섹션을 벗어난 뒤에 타이머가 깨어 setState 를 부르지 않도록 정리한다.
  useEffect(() => clear, []);

  return { message, show };
}

export default function Toast({ message }: { message: string | null }) {
  // body 에 직접 그린다. 섹션 안에 두면 스크롤 리빌이 조상에 transform 을 거는 동안
  // 그것이 position:fixed 의 기준이 되어, 토스트가 화면 아래가 아니라 섹션 어딘가에 뜬다.
  // 애니메이션이 끝나면 Motion 이 transform 을 지우므로 평소에는 드러나지 않지만,
  // 리빌이 끝나기 전에 버튼을 누르면 어긋난다.
  return createPortal(
    <AnimatePresence>
      {message && (
        <m.div
          key="toast"
          // 스크린리더에는 이 영역의 변화만 읽힌다. 복사는 화면이 그대로라 이 알림이
          // 없으면 눈으로 보지 않는 사람은 성공 여부를 알 수 없다.
          role="status"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
          style={{
            position: "fixed",
            left: "50%",
            bottom: 40,
            // translateX 는 Motion 이 건드리는 y 와 겹치지 않게 여기서만 준다.
            x: "-50%",
            background: "var(--text)",
            color: "var(--on-primary)",
            padding: "13px 26px",
            borderRadius: 40,
            fontSize: 14,
            zIndex: 95,
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          {message}
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
