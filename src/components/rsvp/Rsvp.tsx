import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import Reveal from "../Reveal";
import RsvpForm from "./RsvpForm";
import { CLOSED_MESSAGE, DONE_MESSAGE, LEAD, OPEN_LABEL } from "./messages";
import { alreadySubmitted, isRsvpClosed } from "../../lib/rsvp";
import { scaled } from "../../lib/typeScale";

// RS-01 참석 여부 회신 · RS-03 개인정보 수집 동의.
//
// c안 §8 을 옮기면서 달라진 것들:
//   1. 「전하고 싶은 말」을 뺐다 — 방명록(SIS-21)이 같은 역할을 한다(2026-08-18 확정)
//   2. 식사 여부 3택과 연락처를 더했다 — 둘 다 c안에 없던 항목이다
//   3. 폼을 버튼 뒤로 숨기고, 항목을 한 번에 하나씩 내보낸다(2026-08-18 사용자 결정)
//
// 3번의 뼈대는 RsvpForm.tsx 에 있다. 이 파일은 마감·제출 여부로 무엇을 그릴지만 가른다.
export default function Rsvp() {
  // 마감 판정은 그릴 때 한 번만 한다. 하객이 페이지를 열어 둔 채 자정을 넘기는 일은
  // 드물고, 그 한 건을 잡자고 타이머를 돌리면 화면이 폼에서 안내로 갑자기 바뀐다.
  const closed = isRsvpClosed();
  const [submitted, setSubmitted] = useState(alreadySubmitted);
  const [open, setOpen] = useState(false);

  return (
    <Reveal>
      <div className="card">
        <div className="script-title">R.S.V.P</div>
        <p
          style={{
            margin: "10px 0 26px",
            fontSize: scaled(14),
            color: "var(--text-body)",
            lineHeight: 1.8,
            whiteSpace: "pre-line",
          }}
        >
          {LEAD}
        </p>

        {closed ? (
          <Notice title="Thank you" message={CLOSED_MESSAGE} />
        ) : submitted ? (
          <Notice title="Thank you" message={DONE_MESSAGE} />
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {open ? (
              <m.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                <RsvpForm onDone={() => setSubmitted(true)} />
              </m.div>
            ) : (
              // 폼을 여는 버튼 하나만 둔다. 카드가 짧아 다음 섹션이 바로 이어지고,
              // 회신할 사람만 폼을 펼치게 된다.
              <m.div key="opener" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <button type="button" className="rsvp-submit" style={{ width: "100%" }} onClick={() => setOpen(true)}>
                  {OPEN_LABEL}
                </button>
              </m.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </Reveal>
  );
}

/** 완료·마감 안내 카드. c안 §8 의 Thank you 박스를 그대로 쓴다. */
function Notice({ title, message }: { title: string; message: string }) {
  return (
    <div className="rsvp-done">
      <div className="script-title" style={{ fontSize: 30 }}>
        {title}
      </div>
      <p>{message}</p>
    </div>
  );
}
