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
    // 화면 폭을 꽉 채운 이 줄이 캡슐을 가운데 세운다.
    //
    // 캡슐에 left:50% + translateX(-50%) 를 주는 흔한 방법을 쓰지 않는 이유가 있다.
    // 그러면 브라우저가 캡슐의 폭을 "left 지점부터 화면 오른쪽 끝까지"인 절반 안에서만
    // 잡아, 문구가 실제 여유보다 훨씬 좁게 눌려 세 줄로 끊긴다. translateX 는 폭이
    // 정해진 뒤에 걸리는 것이라 이를 되돌려 주지 못한다.
    <div
      // 스크린리더에는 이 영역의 변화만 읽힌다. 복사는 화면이 그대로라 이 알림이 없으면
      // 눈으로 보지 않는 사람은 성공 여부를 알 수 없다. 캡슐이 아니라 늘 붙어 있는 이
      // 줄에 거는 것은, 라이브 영역이 미리 자리 잡고 있어야 안에 들어온 문구가 읽히기
      // 때문이다 — 영역째로 나타나면 놓치는 스크린리더가 있다.
      role="status"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 40,
        display: "flex",
        justifyContent: "center",
        padding: "0 20px",
        zIndex: 95,
        pointerEvents: "none",
      }}
    >
      <AnimatePresence>
        {message && (
          <m.div
            key="toast"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
            style={{
              background: "var(--text)",
              color: "var(--on-primary)",
              padding: "13px 26px",
              borderRadius: 40,
              fontSize: 14,
              lineHeight: 1.5,
              textAlign: "center",
              // 문구에 넣은 줄 나눔을 그대로 살린다. 브라우저에 맡기면 320px 에서 마지막
              // 한 글자만 다음 줄로 넘어가는 모양이 나온다.
              whiteSpace: "pre-line",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
            }}
          >
            {message}
          </m.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
