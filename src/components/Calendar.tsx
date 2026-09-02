import Reveal from "./Reveal";
import DDay, { useCountdown } from "./DDay";
import { useToast } from "./Toast";
import { INVITE } from "../invite";
import { WEEKDAY_LABELS, monthGridOf } from "../lib/monthGrid";
import { buildIcs, downloadIcs, type CalendarEvent } from "../lib/ics";
import { scaled } from "../lib/typeScale";

const grid = monthGridOf(INVITE.dateISO);

const WEDDING_EVENT: CalendarEvent = {
  startISO: INVITE.dateISO,
  durationMin: 120,
  title: `${INVITE.groom.name} ♥ ${INVITE.bride.name} 결혼식`,
  location: `${INVITE.venue} ${INVITE.hall} (${INVITE.address})`,
  url: INVITE.siteUrl,
  uid: `wedding-${INVITE.dateISO}@${new URL(INVITE.siteUrl).hostname}`,
};

const ICS_FILENAME = "wedding.ics";

export default function Calendar() {
  const showToast = useToast();
  const countdown = useCountdown();
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
