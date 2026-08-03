import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { LazyMotion, domMax, MotionConfig } from "motion/react";

// main.tsx와 동일한 Motion 컨텍스트를 재현하되, reducedMotion="always"로 애니메이션을 무력화한다.
// 이렇게 해야 whileInView·transition 대기 없이 최종 상태를 바로 검증할 수 있다.
function MotionProviders({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="always">{children}</MotionConfig>
    </LazyMotion>
  );
}

export function renderWithMotion(ui: ReactElement) {
  return render(ui, { wrapper: MotionProviders });
}
