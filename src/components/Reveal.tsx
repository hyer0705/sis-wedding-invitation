import { m } from "motion/react";
import type { ReactNode } from "react";

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
