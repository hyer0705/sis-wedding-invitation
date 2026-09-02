import { useEffect, useState } from "react";
import { INVITE } from "../invite";
import { AFTER_MESSAGE, WEDDING_DAY_MESSAGE, countdownAt, type Countdown } from "../lib/countdown";
import { scaled } from "../lib/typeScale";

const boxStyle = { flex: 1, background: "var(--surface)", borderRadius: 16, padding: "16px 4px" } as const;
const numStyle = { fontSize: 28, fontWeight: 700, lineHeight: 1 } as const;
const labelStyle = { fontSize: scaled(11.5), letterSpacing: "0.1em", color: "var(--text-body)", marginTop: 8 } as const;

export function useCountdown(): Countdown {
  const [t, setT] = useState(() => countdownAt(INVITE.dateISO, Date.now()));

  useEffect(() => {
    if (t.phase === "after") return;
    const iv = setInterval(() => setT(countdownAt(INVITE.dateISO, Date.now())), 1000);
    return () => clearInterval(iv);
  }, [t.phase]);

  return t;
}

export default function DDay({ countdown: t }: { countdown: Countdown }) {
  return (
    <>
      {t.phase !== "after" && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          <div style={boxStyle}>
            <div style={numStyle}>{t.days}</div>
            <div style={labelStyle}>일</div>
          </div>
          <div style={boxStyle}>
            <div style={numStyle}>{t.hours}</div>
            <div style={labelStyle}>시</div>
          </div>
          <div style={boxStyle}>
            <div style={numStyle}>{t.mins}</div>
            <div style={labelStyle}>분</div>
          </div>
          <div style={{ ...boxStyle, background: "var(--primary)" }}>
            <div style={{ ...numStyle, color: "var(--on-primary)" }}>{t.secs}</div>
            <div style={{ ...labelStyle, color: "var(--on-primary-sub)" }}>초</div>
          </div>
        </div>
      )}
      <p
        style={{
          margin: t.phase === "after" ? 0 : "24px 0 0",
          fontSize: scaled(14.5),
          color: "var(--text-body)",
          lineHeight: 1.7,
        }}
      >
        {t.phase === "before" ? (
          <>
            {INVITE.groom.first}, {INVITE.bride.first}의 결혼식까지{" "}
            <span style={{ color: "var(--primary)", fontWeight: 700 }}>{t.days}</span>일
          </>
        ) : t.phase === "wedding-day" ? (
          WEDDING_DAY_MESSAGE
        ) : (
          AFTER_MESSAGE
        )}
      </p>
    </>
  );
}
