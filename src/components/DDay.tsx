import { useEffect, useState } from "react";
import { INVITE } from "../invite";
import { AFTER_MESSAGE, WEDDING_DAY_MESSAGE, countdownAt, type Countdown } from "../lib/countdown";
import { scaled } from "../lib/textSize";

// CV-04 D-Day 카운트다운.
//
// 카드도 Reveal 도 여기서 감싸지 않는다 — Calendar 카드 안에 얹히기 때문이다(SIS-10).
// 예전에는 이 컴포넌트가 독립 카드였다. 고객이 달력·일시·장소·D-Day 를 한 카드로
// 합치기로 정하면서(2026-08-11) 껍데기만 걷어내고 알맹이는 그대로 두었다.
//
// 남은 시간은 useCountdown 이 세고, 그리는 일만 이 컴포넌트가 한다. Calendar 도 같은
// 값을 보아야 하기 때문이다 — 예식이 지나면 「캘린더에 저장」 버튼을 감춰야 하는데,
// 각자 타이머를 돌리면 자정을 넘길 때 한쪽만 갱신돼 버튼이 남는다.

const boxStyle = { flex: 1, background: "var(--surface)", borderRadius: 16, padding: "16px 4px" } as const;
const numStyle = { fontSize: 28, fontWeight: 700, lineHeight: 1 } as const;
const labelStyle = { fontSize: scaled(11.5), letterSpacing: "0.1em", color: "var(--text-body)", marginTop: 8 } as const;

/** 예식까지 남은 시간을 1초마다 센다. 예식이 지난 뒤에는 타이머를 걸지 않는다. */
export function useCountdown(): Countdown {
  const [t, setT] = useState(() => countdownAt(INVITE.dateISO, Date.now()));

  useEffect(() => {
    // 예식이 지난 뒤에는 셀 것이 없다. 남은 한 달 동안 1초마다 리렌더하지 않는다.
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
