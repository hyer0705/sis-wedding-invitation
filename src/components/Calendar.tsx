import Reveal from "./Reveal";
import DDay, { useCountdown } from "./DDay";
import { useToast } from "./Toast";
import { INVITE } from "../invite";
import { WEEKDAY_LABELS, monthGridOf } from "../lib/monthGrid";
import { buildIcs, downloadIcs, type CalendarEvent } from "../lib/ics";
import { scaled } from "../lib/textSize";

// DT-01·DT-02·DT-03 — 예식 일시 표기 · 달력 · 캘린더 저장.
//
// 원래 When & Where 그린 카드(DT-01)와 D-Day 카드(CV-04)가 따로 있었다. 고객이 달력을
// 넣기로 하면서 날짜 정보가 세 카드에 흩어지게 되어, 하나로 합치기로 확정했다
// (2026-08-11). 그래서 이 카드가 그린 카드를 대체하고 DDay 를 안에 품는다.

const grid = monthGridOf(INVITE.dateISO);

const WEDDING_EVENT: CalendarEvent = {
  startISO: INVITE.dateISO,
  // 예식 소요 시간 2시간 — 고객 확정값(2026-08-11).
  durationMin: 120,
  title: `${INVITE.groom.name} ♥ ${INVITE.bride.name} 결혼식`,
  location: `${INVITE.venue} ${INVITE.hall} (${INVITE.address})`,
  url: INVITE.siteUrl,
  // 시각이 바뀌면 UID 도 바뀐다 — 캘린더가 옛 일정을 덮어쓰지 않고 새로 넣게 하기 위함이다.
  uid: `wedding-${INVITE.dateISO}@${new URL(INVITE.siteUrl).hostname}`,
};

const ICS_FILENAME = "wedding.ics";

export default function Calendar() {
  const showToast = useToast();
  const countdown = useCountdown();
  // 페이지는 예식 후 한 달간 열려 있다(CM-08). 그동안 지난 일정을 캘린더에 넣으라고
  // 권할 이유가 없으므로 저장 버튼과 그 아래 구분선을 함께 거둔다.
  const isOver = countdown.phase === "after";

  const handleSave = () => {
    const ok = downloadIcs(ICS_FILENAME, buildIcs(WEDDING_EVENT, Date.now()));
    showToast(ok ? "캘린더 앱에서 일정을 확인해 주세요" : "캘린더 저장에 실패했습니다\n일시를 직접 등록해 주세요");
  };

  return (
    <Reveal>
      <div className="card">
        <div className="script-title" style={{ marginBottom: 8 }}>
          Calendar
        </div>
        <div style={{ fontSize: scaled(15), color: "var(--text-body)", letterSpacing: "0.12em" }}>
          {grid.year} . {String(grid.month).padStart(2, "0")}
        </div>

        {/* div 격자가 아니라 표로 짠다. 스크린리더에서 "1월 24일 · 일요일"처럼 요일과
            날짜가 함께 읽혀야 하는데, 그 연결을 만들어 주는 것이 th/td 관계다. */}
        <table className="calendar">
          <caption className="sr-only">
            {grid.year}년 {grid.month}월 달력. {grid.weddingDay}일이 예식일입니다.
          </caption>
          <thead>
            <tr>
              {WEEKDAY_LABELS.map((label) => (
                <th key={label} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.weeks.map((week, weekIndex) => (
              <tr key={weekIndex}>
                {week.map((day, dayIndex) =>
                  day === null ? (
                    <td key={dayIndex} />
                  ) : (
                    <td key={dayIndex}>
                      <span className={day === grid.weddingDay ? "day wedding" : "day"}>
                        {day === grid.weddingDay && <span className="sr-only">예식일 </span>}
                        {day}
                      </span>
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {/* 375px 이상에서는 한 줄이지만 320px 에서는 들어가지 않는다. 그냥 두면
            "…오전 11" / "시" 로 끊겨 마지막 한 글자만 다음 줄에 남는다.
            날짜와 시각을 각각 inline-block 으로 묶어, 넘칠 때 그 사이에서만 갈라지게 한다. */}
        <div style={{ marginTop: 18, fontSize: scaled(16), color: "var(--text-body)", wordBreak: "keep-all" }}>
          <span style={{ display: "inline-block" }}>{INVITE.dateText}</span>{" "}
          <span style={{ display: "inline-block" }}>{INVITE.dayText}</span>
        </div>

        <div style={{ width: 30, height: 1, background: "var(--input-border)", margin: "24px auto 18px" }} />

        <div style={{ fontSize: scaled(18), fontWeight: 700 }}>{INVITE.venue}</div>
        <div style={{ fontSize: scaled(14.5), color: "var(--text-body)", marginTop: 6 }}>{INVITE.hall}</div>

        {!isOver && (
          <button
            type="button"
            onClick={handleSave}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              height: 48,
              marginTop: 24,
              border: "1px solid var(--input-border)",
              borderRadius: "var(--radius-control)",
              background: "transparent",
              color: "var(--on-surface)",
              fontFamily: "var(--font-serif)",
              fontSize: scaled(15),
              cursor: "pointer",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1.6" y="2.9" width="12.8" height="11.5" rx="2.2" stroke="currentColor" strokeWidth="1.2" />
              <path d="M1.6 6.4h12.8M5.2 1.6v2.6M10.8 1.6v2.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            캘린더에 저장
          </button>
        )}

        <div className="heart-rule" aria-hidden="true">
          <svg width="13" height="12" viewBox="0 0 14 13" fill="currentColor">
            <path d="M7 12.2 1.7 7.1A3.4 3.4 0 0 1 7 2.8a3.4 3.4 0 0 1 5.3 4.3L7 12.2Z" />
          </svg>
        </div>

        <DDay countdown={countdown} />
      </div>
    </Reveal>
  );
}
