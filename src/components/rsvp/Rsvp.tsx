import { useState } from "react";
import { AnimatePresence, m } from "motion/react";
import Reveal from "../Reveal";
import RsvpForm from "./RsvpForm";
import { CLOSED_MESSAGE, DONE_MESSAGE, LEAD, OPEN_LABEL } from "./messages";
import { alreadySubmitted, isRsvpClosed } from "../../lib/rsvp";
import { scaled } from "../../lib/typeScale";

export default function Rsvp() {
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
