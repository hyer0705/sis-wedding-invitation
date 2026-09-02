import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { LazyMotion, domMax, MotionConfig } from "motion/react";
import "./styles/tokens.css";
import "./styles/global.css";
import App from "./App";
import { ToastProvider } from "./components/Toast";
import { resolveRoute } from "./lib/route";
import { restoreTextSize } from "./lib/textSize";

restoreTextSize();

const Admin = lazy(() => import("./pages/Admin"));

function Invitation() {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <App />
        </ToastProvider>
      </MotionConfig>
    </LazyMotion>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {resolveRoute(window.location.pathname) === "admin" ? (
      <Suspense fallback={null}>
        <Admin />
      </Suspense>
    ) : (
      <Invitation />
    )}
  </StrictMode>,
);
