import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { m } from "motion/react";

const FOCUSABLE = "button:not(:disabled), input:not(:disabled), textarea:not(:disabled)";

export default function GuestbookDialog({
  title,
  lead,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  lead: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const leadId = useId();

  // onClose 는 호출부가 인라인 화살표로 넘기는 일이 많아 렌더마다 새 함수다. 그것을
  // effect 의존성에 두면 부모가 다시 렌더될 때마다 정리·재실행이 돌아, cleanup 의
  // opener.focus() 가 입력 중인 칸에서 초점을 빼앗는다. 최신 값만 ref 로 들고
  // effect 는 마운트에 한 번만 돌게 한다.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const opener = document.activeElement;
    node.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const targets = node.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (targets.length === 0) return;

      const first = targets[0];
      const last = targets[targets.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || active === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    node.addEventListener("keydown", onKeyDown);
    return () => {
      node.removeEventListener("keydown", onKeyDown);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);

  return createPortal(
    <m.div
      className="gb-dialog-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        ref={ref}
        className="gb-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={leadId}
        tabIndex={-1}
      >
        <button type="button" className="gb-dialog-close" onClick={onClose} aria-label={closeLabel}>
          ✕
        </button>

        <h3 id={titleId} className="gb-dialog-title">
          {title}
        </h3>
        <p id={leadId} className="gb-dialog-lead">
          {lead}
        </p>

        {children}
      </div>
    </m.div>,
    document.body,
  );
}
