import { useEffect, useState } from "react";
import Reveal from "./Reveal";
import { INVITE } from "../invite";
import { AFTER_MESSAGE, WEDDING_DAY_MESSAGE, countdownAt } from "../lib/countdown";

const boxStyle = { flex: 1, background: "var(--surface)", borderRadius: 16, padding: "16px 4px" } as const;
const numStyle = { fontSize: 28, fontWeight: 700, lineHeight: 1 } as const;
const labelStyle = { fontSize: 10.5, letterSpacing: "0.1em", color: "var(--muted-2)", marginTop: 8 } as const;

export default function DDay() {
  const [t, setT] = useState(() => countdownAt(INVITE.dateISO, Date.now()));

  useEffect(() => {
    // 예식이 지난 뒤에는 셀 것이 없다. 남은 한 달 동안 1초마다 리렌더하지 않는다.
    if (t.phase === "after") return;
    const iv = setInterval(() => setT(countdownAt(INVITE.dateISO, Date.now())), 1000);
    return () => clearInterval(iv);
  }, [t.phase]);

  return (
    <Reveal>
      <div className="card">
        <div className="script-title" style={{ marginBottom: 26 }}>
          D-Day
        </div>
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
        <p style={{ margin: t.phase === "after" ? 0 : "24px 0 0", fontSize: 14, color: "var(--text-sub)", lineHeight: 1.7 }}>
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
      </div>
    </Reveal>
  );
}
