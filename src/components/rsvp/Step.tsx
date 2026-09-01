import { useEffect, useRef } from "react";
import { AnimatePresence, m } from "motion/react";

export default function Step({ show, children }: { show: boolean; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const wasShown = useRef(show);
  const pendingReveal = useRef(false);

  useEffect(() => {
    if (show && !wasShown.current) pendingReveal.current = true;
    if (!show) pendingReveal.current = false;
    wasShown.current = show;
  }, [show]);

  const scrollIntoViewAfterReveal = () => {
    if (!pendingReveal.current) return;
    pendingReveal.current = false;
    ref.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  };

  return (
    <AnimatePresence initial={false}>
      {show && (
        <m.div
          ref={ref}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25 }}
          onAnimationComplete={scrollIntoViewAfterReveal}
          style={{ overflow: "hidden" }}
        >
          <div style={{ paddingTop: 12 }}>{children}</div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
