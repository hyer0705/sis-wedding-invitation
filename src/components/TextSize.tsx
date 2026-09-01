import { useSyncExternalStore } from "react";
import { m } from "motion/react";
import { isLargeText, setLargeText, subscribeTextSize } from "../lib/textSize";

// 「변경」이 아니라 **무슨 일이 일어나는지**를 적는다 — 어른 하객이 누르기 전에 결과를
// 알아야 누른다. 왼쪽의 작은 「가」·큰 「가」가 같은 말을 그림으로 한 번 더 하며, 켜면
// 두 글자의 순서가 뒤집혀 이번에는 줄어든다는 것을 보여 준다.
const LABEL_ON = "글씨 크게 보기";
const LABEL_OFF = "글씨 원래대로";

function useLargeText() {
  return useSyncExternalStore(subscribeTextSize, isLargeText, () => false);
}

/**
 * 화면 아래에 붙박이로 서는 글자 크기 바.
 *
 * 처음에는 우상단 원형 아이콘과 커버 아래 버튼 둘로 두었는데, **이 기능이 필요한
 * 하객일수록 작은 아이콘을 눌러 볼 생각을 하지 않는다**(2026-09-01 고객 지적).
 * 그래서 화면 아래에 글자로 적힌 바 하나로 바꿨다 — 어디를 보고 있든 눈에 남고,
 * 무엇을 하는 버튼인지 글이 그대로 말한다.
 *
 * 커버 아래 버튼은 함께 걷었다. 이 바가 첫 화면부터 늘 떠 있어 같은 일을 두 번
 * 하는 데다, 같은 문구의 버튼이 한 화면에 둘이면 서로 다른 기능으로 읽힌다.
 */
export function TextSizeBar() {
  const large = useLargeText();

  return (
    <div className="text-size-bar">
      <m.button
        type="button"
        className="text-size-bar-button"
        onClick={() => setLargeText(!large)}
        whileTap={{ scale: 0.98 }}
        aria-pressed={large}
      >
        <span className="text-size-bar-mark" aria-hidden="true">
          <span className="text-size-bar-mark-small">가</span>
          <span className="text-size-bar-mark-large">가</span>
        </span>
        {large ? LABEL_OFF : LABEL_ON}
      </m.button>
    </div>
  );
}
