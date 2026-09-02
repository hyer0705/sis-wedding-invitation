import type { ReactElement, ReactNode } from "react";
import { render } from "@testing-library/react";
import { LazyMotion, domMax, MotionConfig } from "motion/react";
import { ToastProvider } from "../components/Toast";

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
