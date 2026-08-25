import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function AdminConfirmDialog({
  title,
  confirmLabel,
  runningLabel,
  fallbackError,
  onClose,
  onConfirm,
  onError,
  children,
}: {
  title: string;
  confirmLabel: string;
  runningLabel: string;
  fallbackError: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onError: (message: string) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const opener = document.activeElement;
    node.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const targets = node.querySelectorAll<HTMLElement>("button:not(:disabled)");
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

      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus();
        return;
      }
      document.querySelector<HTMLElement>(".admin-rows .admin-row-del")?.focus();
    };
  }, [onClose]);

  async function confirm() {
    setRunning(true);
    try {
      await onConfirm();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : fallbackError);
      onClose();
    }
  }

  return createPortal(
    <div className="admin-dialog-overlay">
      <div ref={ref} className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <h2 id={titleId}>{title}</h2>

        {children}

        <div className="admin-dialog-actions">
          <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>
            취소
          </button>
          <button type="button" className="admin-btn admin-btn-danger" onClick={confirm} disabled={running}>
            {running ? runningLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
