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

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const opener = document.activeElement;
    node.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
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
  }, [onClose]);

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
