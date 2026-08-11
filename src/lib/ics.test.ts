import { describe, expect, it } from "vitest";
import { buildIcs, type CalendarEvent } from "./ics";

// .ics 는 하객의 캘린더 앱이 읽는 파일이라, 틀려도 우리 화면에는 아무 표시가 나지 않는다.
// 규격에서 실제로 앱이 거부하는 지점(CRLF·줄 길이·이스케이프)과 시각 변환을 못 박는다.

const EVENT: CalendarEvent = {
  startISO: "2027-01-24T11:00:00+09:00",
  durationMin: 120,
  title: "결혼식",
  location: "신도림 웨스턴베니비스",
  url: "https://example.test",
  uid: "wedding-test@example.test",
};

const NOW = Date.UTC(2026, 7, 11, 3, 0, 0);

/** 접힌 줄(다음 줄이 공백으로 시작)을 원래 한 줄로 되돌린다. */
function unfold(ics: string): string[] {
  const out: string[] = [];
  for (const line of ics.split("\r\n")) {
    if (line.startsWith(" ") && out.length > 0) out[out.length - 1] += line.slice(1);
    else if (line !== "") out.push(line);
  }
  return out;
}

const valueOf = (ics: string, key: string) =>
  unfold(ics)
    .find((l) => l.startsWith(`${key}:`))
    ?.slice(key.length + 1);

describe("buildIcs", () => {
  it("VCALENDAR·VEVENT 로 감싼다", () => {
    const lines = unfold(buildIcs(EVENT, NOW));

    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines.at(-1)).toBe("END:VCALENDAR");
    expect(lines).toContain("BEGIN:VEVENT");
    expect(lines).toContain("END:VEVENT");
    expect(lines).toContain("VERSION:2.0");
  });

  it("줄을 CRLF 로 끝낸다", () => {
    const ics = buildIcs(EVENT, NOW);

    // LF 만 있는 줄바꿈이 하나도 없어야 한다 — 이것만으로 파일을 거부하는 앱이 있다.
    expect(ics.replace(/\r\n/g, "")).not.toContain("\n");
    expect(ics.endsWith("\r\n")).toBe(true);
  });

  it("KST 예식 시각을 UTC 로 적는다", () => {
    const ics = buildIcs(EVENT, NOW);

    // 11:00 +09:00 = 02:00 Z
    expect(valueOf(ics, "DTSTART")).toBe("20270124T020000Z");
    expect(valueOf(ics, "DTSTAMP")).toBe("20260811T030000Z");
  });

  it("소요 시간만큼 뒤를 끝 시각으로 적는다", () => {
    expect(valueOf(buildIcs(EVENT, NOW), "DTEND")).toBe("20270124T040000Z");
    expect(valueOf(buildIcs({ ...EVENT, durationMin: 30 }, NOW), "DTEND")).toBe("20270124T023000Z");
  });

  it("쉼표·세미콜론·역슬래시를 이스케이프한다", () => {
    const ics = buildIcs({ ...EVENT, location: "구로구 새말로 97, 7F; 지하 1층\\연결" }, NOW);

    // 역슬래시를 먼저 바꾸지 않으면 앞서 넣은 이스케이프까지 다시 이스케이프된다.
    expect(valueOf(ics, "LOCATION")).toBe("구로구 새말로 97\\, 7F\\; 지하 1층\\\\연결");
  });

  it("줄바꿈을 \\n 으로 눕힌다", () => {
    const ics = buildIcs({ ...EVENT, title: "결혼식\n오전 11시" }, NOW);

    expect(valueOf(ics, "SUMMARY")).toBe("결혼식\\n오전 11시");
  });

  it("긴 한글 줄을 75옥텟 안에서 접되 글자를 쪼개지 않는다", () => {
    const location = "신도림 웨스턴베니비스 다이너스티홀 7층 서울특별시 구로구 새말로 97 신도림테크노마트";
    const ics = buildIcs({ ...EVENT, location }, NOW);

    const encoder = new TextEncoder();
    for (const line of ics.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    // 접기는 표현 방식일 뿐이다. 되돌리면 원문이 그대로 나와야 한다.
    expect(valueOf(ics, "LOCATION")).toBe(location);
    // 글자 중간에서 잘렸다면 여기에 U+FFFD 가 섞인다.
    expect(ics).not.toContain("�");
  });
});
