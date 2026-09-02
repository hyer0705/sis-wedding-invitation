import { useSyncExternalStore } from "react";
import { m } from "motion/react";
import { isLargeText, setLargeText, subscribeTextSize } from "../lib/textSize";

const LABEL_ON = "글씨 크게 보기";
const LABEL_OFF = "글씨 원래대로";

function useLargeText() {
  return useSyncExternalStore(subscribeTextSize, isLargeText, () => false);
}

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
