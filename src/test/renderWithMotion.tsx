import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { LazyMotion, domMax, MotionConfig } from "motion/react";
import { ToastProvider } from "../components/Toast";

// main.tsx와 동일한 Motion 컨텍스트를 재현하되, reducedMotion="always"로 애니메이션을 무력화한다.
// 이렇게 해야 whileInView·transition 대기 없이 최종 상태를 바로 검증할 수 있다.
//
// 토스트는 화면 전체가 함께 쓰는 것이라 main.tsx처럼 여기서도 감싼다 — 그러지 않으면
// useToast를 쓰는 섹션이 테스트에서만 다른 환경에 놓인다.
function MotionProviders({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="always">
        <ToastProvider>{children}</ToastProvider>
      </MotionConfig>
    </LazyMotion>
  );
}

export function renderWithMotion(ui: ReactElement) {
  return render(ui, { wrapper: MotionProviders });
}
