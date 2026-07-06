import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { LazyMotion, domMax, MotionConfig } from "motion/react";
import "./styles/tokens.css";
import "./styles/global.css";
import App from "./App";

// LazyMotion + m 컴포넌트로 번들 최소화, domMax는 라이트박스 drag 제스처용
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </LazyMotion>
  </StrictMode>,
);
