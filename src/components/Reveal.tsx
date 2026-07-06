import { m } from "motion/react";
import type { ReactNode } from "react";

// 시안의 data-reveal(IntersectionObserver 스크롤 리빌)을 대체하는 공통 래퍼
export default function Reveal({ children }: { children: ReactNode }) {
  return (
    <m.section
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
      style={{ padding: "14px 20px" }}
    >
      {children}
    </m.section>
  );
}
