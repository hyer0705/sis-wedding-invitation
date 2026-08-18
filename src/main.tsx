import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { LazyMotion, domMax, MotionConfig } from "motion/react";
import "./styles/tokens.css";
import "./styles/global.css";
import App from "./App";
import { ToastProvider } from "./components/Toast";
import { isAdminPath } from "./lib/route";

// SIS-22 — 관리자 페이지는 **반드시 lazy 로 가른다.** 하객은 이 화면을 평생 열지
// 않는데, 함께 묶으면 목록·CSV·인증 코드까지 모두가 내려받게 된다.
const Admin = lazy(() => import("./pages/Admin"));

// LazyMotion + m 컴포넌트로 번들 최소화, domMax는 라이트박스 drag 제스처용
function Invitation() {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">
        {/* 토스트는 화면에 하나만 둔다 — 이유는 components/Toast.tsx 머리말 참고 */}
        <ToastProvider>
          <App />
        </ToastProvider>
      </MotionConfig>
    </LazyMotion>
  );
}

// 라우팅 라이브러리를 쓰지 않는다. 화면이 둘뿐이고 서로 오갈 링크도 없어서,
// react-router 를 넣었더니 **하객 번들이 667KB → 708KB 로 늘었다.** 관리자 화면을
// 가른 목적이 바로 그 번들을 지키는 것이었으므로 앞뒤가 맞지 않는다.
//
// 경로가 늘어 중첩·전환·링크가 필요해지면 그때 라이브러리를 들인다.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isAdminPath(window.location.pathname) ? (
      // fallback 이 null 인 것은 일부러다. index.html 의 부트 화면이 아직 떠 있어
      // 그것이 곧 로딩 화면 노릇을 하며, 여기에 무언가를 그리면 부트 위에 겹쳐
      // 두 화면이 동시에 보인다. 부트는 Admin 이 뜬 뒤 걷힌다.
      <Suspense fallback={null}>
        <Admin />
      </Suspense>
    ) : (
      <Invitation />
    )}
  </StrictMode>,
);
