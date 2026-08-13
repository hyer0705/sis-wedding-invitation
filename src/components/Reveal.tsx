import { m } from "motion/react";
import type { ReactNode } from "react";

// 시안의 data-reveal(IntersectionObserver 스크롤 리빌)을 대체하는 공통 래퍼
//
// onInView 는 섹션이 화면에 들어올 때 한 번만 불린다(viewport once). 이 래퍼가 이미
// 관찰자를 달고 있으므로, 하객이 그 자리까지 내려온 뒤에야 받아도 되는 것을 미리
// 준비시키는 데 쓴다 — 지금은 공유 SDK 하나뿐이다(Share.tsx).
export default function Reveal({ children, onInView }: { children: ReactNode; onInView?: () => void }) {
  return (
    <m.section
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      onViewportEnter={onInView}
      transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
      style={{ padding: "14px 20px" }}
    >
      {children}
    </m.section>
  );
}
