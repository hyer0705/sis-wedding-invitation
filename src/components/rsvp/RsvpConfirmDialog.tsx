import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { m } from "motion/react";
import { confirmRows, type RsvpPayload } from "../../lib/rsvp";
import { CONFIRM_BACK, CONFIRM_CLOSE, CONFIRM_LEAD, CONFIRM_SEND, CONFIRM_TITLE } from "./messages";

/**
 * 제출 확인 팝업 (SIS-36). 회신은 전송하면 고칠 창구가 없어, 나가기 전에 한 번 되짚는다.
 *
 * body 에 직접 그린다. 토스트와 같은 이유다 — 섹션 안에 두면 스크롤 리빌이 조상에 건
 * transform 이 position:fixed 의 기준이 되어, 팝업이 화면이 아니라 카드 어딘가에 뜬다.
 *
 * 「뒤로」·X·Esc 어느 쪽으로 닫아도 **폼은 채운 그대로 남는다** — 이 컴포넌트는 값을
 * 들고만 있고 폼 상태를 건드리지 않는다.
 */
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

    // 팝업 밖으로 돌아갈 자리를 기억해 둔다. 닫으면 눌렀던 제출 버튼으로 되돌린다 —
    // 그러지 않으면 초점이 문서 맨 앞으로 떨어져, 키보드로 훑던 사람이 폼을 다시
    // 찾아 내려와야 한다.
    const opener = document.activeElement;

    // 상자 자체에 초점을 준다. 「확인」에 바로 주면 엔터 한 번에 전송되고, 스크린리더도
    // 제목보다 버튼 이름을 먼저 읽는다.
    node.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onBack();
        return;
      }
      if (event.key !== "Tab") return;

      // 초점을 팝업 안에 가둔다. 뒤에 폼이 그대로 살아 있어, 막지 않으면 탭이 가려진
      // 입력 칸으로 빠져나가 어디에 있는지 알 수 없게 된다.
      // 이 팝업에 초점을 받는 것은 버튼뿐이고, 전송 중에는 「확인」이 빠진다.
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
      {/* 배경을 눌러도 닫지 않는다. 되돌아가는 길은 「뒤로」와 X 둘로 정해져 있고
          (2026-08-18 확정), 화면을 꽉 채운 팝업에서는 배경을 누를 자리가 손가락이
          미끄러진 자리와 구분되지 않는다. */}
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
          {/* 보내는 중에도 닫을 수 있게 둔다. 「확인」만 잠근다 — 요청에 시간 제한이
              없어, 셋 다 잠그면 응답이 늦는 동안 팝업에 갇힌다. 닫고 나가도 요청은
              그대로 끝나 성공이면 완료 카드가, 실패면 토스트가 뜬다. */}
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
