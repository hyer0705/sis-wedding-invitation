import { useSyncExternalStore } from "react";
import { m } from "motion/react";
import { isLargeText, setLargeText, subscribeTextSize } from "../lib/textSize";

const LABEL_ON = "큰 글씨로 보기";
const LABEL_OFF = "원래 글씨로 보기";

function useLargeText() {
  return useSyncExternalStore(subscribeTextSize, isLargeText, () => false);
}

/** 우상단 고정 버튼. 배경음악 토글과 한 줄에 선다. */
export function TextSizeToggle() {
  const large = useLargeText();

  return (
    <m.button
      type="button"
      className="text-size-toggle"
      onClick={() => setLargeText(!large)}
      whileTap={{ scale: 0.94 }}
      aria-pressed={large}
      aria-label={large ? LABEL_OFF : LABEL_ON}
    >
      <span aria-hidden="true">가</span>
    </m.button>
  );
}

/**
 * 커버 아래 글자 버튼.
 *
 * 우상단 원만 두면 그것이 무엇을 하는 버튼인지 알기 어렵다 — 이 기능이 필요한 하객일수록
 * 작은 아이콘을 짚어 보지 않는다. 첫 화면에서 글로 한 번 알리고, 스크롤한 뒤에는 위쪽
 * 고정 버튼이 같은 일을 맡는다.
 */
export function TextSizeButton() {
  const large = useLargeText();

  return (
    <button type="button" className="text-size-button" onClick={() => setLargeText(!large)} aria-pressed={large}>
      <span className="text-size-button-mark" aria-hidden="true">
        가
      </span>
      {large ? LABEL_OFF : LABEL_ON}
    </button>
  );
}
