// DT-03 캘린더 저장 — iCalendar(.ics) 파일을 만든다.
//
// 구글 캘린더 링크가 아니라 .ics 인 이유: 하객의 절반 가까이가 iOS 기본 캘린더를 쓰는데
// 구글 캘린더 템플릿 주소는 구글 계정이 있어야 하고 iOS 기본 캘린더로는 들어가지 않는다.
// .ics 는 iOS·안드로이드·PC 가 모두 자기 기본 캘린더로 연다.
//
// ⚠ 카카오톡 인앱 브라우저에서 Blob 다운로드가 막힐 수 있다. PC·데스크톱 브라우저로는
//   확인되지 않는 지점이라 CLAUDE.md 배포 전 체크리스트에 실기기 항목으로 올려 두었다.
//   막히는 것이 확인되면 구글 캘린더 링크를 함께 두는 쪽으로 바꾼다.
//
// RFC 5545 를 따른다. 규격을 어겨도 캘린더 앱이 대충 열어 주는 경우가 많지만, 어떤 앱이
// 조용히 거부할지는 앱마다 달라 규격대로 만드는 편이 싸게 먹힌다.

export type CalendarEvent = {
  /** 예식 시각. 오프셋이 포함된 ISO 문자열이어야 한다 (INVITE.dateISO). */
  startISO: string;
  /** 예식 소요 시간(분). */
  durationMin: number;
  title: string;
  location: string;
  /** 캘린더 항목에서 청첩장으로 돌아올 주소. */
  url: string;
  /**
   * 항목을 식별하는 고정값. 같은 예식을 두 번 저장해도 캘린더가 같은 일정으로 보게 한다.
   * 시각을 바꾸면 UID 도 함께 바뀌어야 새 일정으로 들어간다.
   */
  uid: string;
};

/** `20270124T020000Z` 형태의 UTC 타임스탬프. */
function toUtcStamp(epochMs: number): string {
  return new Date(epochMs)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/**
 * TEXT 값 이스케이프 (RFC 5545 §3.3.11).
 *
 * 백슬래시를 가장 먼저 바꾼다. 나중에 하면 앞서 넣은 이스케이프의 백슬래시까지 다시
 * 이스케이프해 `\\,` 처럼 망가진다.
 */
function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

/**
 * 한 줄을 75옥텟으로 접는다 (RFC 5545 §3.1). 이어지는 줄은 공백 한 칸으로 시작한다.
 *
 * 길이를 문자 수가 아니라 **UTF-8 바이트 수**로 세고, 글자 중간에서 자르지 않는다.
 * 한글은 한 글자가 3바이트라 문자 수로 자르면 규격을 넘고, 바이트로 잘라 놓고 글자 경계를
 * 무시하면 깨진 글자가 나온다 — 예식장 이름과 안내 문구가 전부 한글이라 실제로 걸린다.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  // 이어지는 줄은 앞의 공백 한 칸도 75옥텟에 포함된다.
  let limit = 75;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      out.push(current);
      current = "";
      bytes = 0;
      limit = 74;
    }
    current += char;
    bytes += size;
  }
  out.push(current);

  return out.join("\r\n ");
}

/**
 * .ics 본문을 만든다. `now` 는 DTSTAMP(항목 작성 시각)에 쓰며, 테스트에서 고정하기 위해
 * 인자로 받는다.
 */
export function buildIcs(event: CalendarEvent, now: number): string {
  const start = new Date(event.startISO).getTime();
  const end = start + event.durationMin * 60_000;

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    // PRODID 는 만든 곳을 알리는 값이다. 규격상 필수라 비워 둘 수 없다.
    "PRODID:-//hb-hj-wedding//invitation//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeText(event.uid)}`,
    `DTSTAMP:${toUtcStamp(now)}`,
    `DTSTART:${toUtcStamp(start)}`,
    `DTEND:${toUtcStamp(end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `LOCATION:${escapeText(event.location)}`,
    `URL:${escapeText(event.url)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  // 규격이 CRLF 를 요구한다. LF 만 쓰면 일부 캘린더 앱이 파일을 통째로 거부한다.
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/**
 * .ics 를 내려받게 한다. 성공 여부를 돌려준다.
 *
 * 파일로 저장한 뒤 사용자가 열어야 캘린더에 들어간다. `text/calendar` 로 내려보내면
 * iOS 는 저장 없이 바로 캘린더 추가 화면을 띄운다.
 */
export function downloadIcs(filename: string, content: string): boolean {
  try {
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // 즉시 revoke 하면 클릭이 처리되기 전에 주소가 죽는 브라우저가 있다.
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    return true;
  } catch {
    return false;
  }
}
