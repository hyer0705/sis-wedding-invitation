import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { m } from "motion/react";
import { confirmRows, type RsvpPayload } from "../../lib/rsvp";
import { CONFIRM_BACK, CONFIRM_CLOSE, CONFIRM_LEAD, CONFIRM_SEND, CONFIRM_TITLE } from "./messages";

export default function RsvpConfirmDialog({
  payload,
  sending,
  onBack,
  onConfirm,
}: {
  payload: RsvpPayload;
  sending: boolean;
  onBack: () => void;
  onConfirm: () => void;
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
        onBack();
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
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [onBack]);

  return createPortal(
    <m.div
      className="rsvp-confirm-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div
        ref={ref}
        className="rsvp-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={leadId}
        tabIndex={-1}
      >
        <button type="button" className="rsvp-confirm-close" onClick={onBack} aria-label={CONFIRM_CLOSE}>
          ✕
        </button>

        <h3 id={titleId} className="rsvp-confirm-title">
          {CONFIRM_TITLE}
        </h3>
        <p id={leadId} className="rsvp-confirm-lead">
          {CONFIRM_LEAD}
        </p>

        <dl className="rsvp-confirm-summary">
          {confirmRows(payload).map((row) => (
            <div key={row.label} style={{ display: "contents" }}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className="rsvp-confirm-actions">
          <button type="button" className="rsvp-confirm-btn rsvp-confirm-back" onClick={onBack}>
            {CONFIRM_BACK}
          </button>
          <button type="button" className="rsvp-confirm-btn rsvp-confirm-send" onClick={onConfirm} disabled={sending}>
            {sending ? "전하는 중…" : CONFIRM_SEND}
          </button>
        </div>
      </div>
    </m.div>,
    document.body,
  );
}
