import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, m } from "motion/react";
import { scaled } from "../lib/typeScale";

const VISIBLE_MS = 1800;

const ToastContext = createContext<((text: string) => void) | null>(null);

export function ToastProvider({ children, duration = VISIBLE_MS }: { children: ReactNode; duration?: number }) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const clear = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const show = useCallback(
    (text: string) => {
      clear();
      setMessage(text);
      timerRef.current = window.setTimeout(() => setMessage(null), duration);
    },
    [duration],
  );

  useEffect(() => clear, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <Toast message={message} />
    </ToastContext.Provider>
  );
}

export function useToast(): (text: string) => void {
  const show = useContext(ToastContext);
  if (!show) throw new Error("useToast 는 ToastProvider 안에서만 쓸 수 있습니다");
  return show;
}

function Toast({ message }: { message: string | null }) {
  return createPortal(
    <div
      role="status"
      data-testid="toast"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: "calc(var(--text-size-bar-h) + env(safe-area-inset-bottom, 0px) + 16px)",
        maxWidth: "var(--page-max)",
        margin: "0 auto",
        display: "flex",
        justifyContent: "center",
        padding: "0 20px",
        zIndex: 95,
        pointerEvents: "none",
      }}
    >
      <AnimatePresence>
        {message && (
          <m.div
            key="toast"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
            style={{
              background: "var(--text)",
              color: "var(--on-primary)",
              padding: "13px 26px",
              borderRadius: 40,
              fontSize: scaled(14),
              lineHeight: 1.5,
              textAlign: "center",
              whiteSpace: "pre-line",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
            }}
          >
            {message}
          </m.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
