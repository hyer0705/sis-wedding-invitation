// SIS-22 / RS-04 — 회신 목록을 CSV 로 내보낸다. 식수 조율에 쓴다.
//
// 서버가 없으므로 브라우저에서 파일을 만든다. 정적 배포 그대로다.
//
// ⚠ **이 파일에는 하객의 이름과 연락처가 담긴다.** 내려받은 뒤 어디에 두는지가
// 곧 개인정보 관리이며, 메신저·메일로 옮기면 그 대화방에 그대로 남는다. 화면에서
// 내려받기 버튼 옆에 이 사실을 함께 적는다.
import type { RsvpRow } from "./adminRsvp";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 열 순서. 고객이 지정한 순서 그대로다(2026-08-18). */
const HEADERS = ["제출시각", "신랑·신부측", "참석여부", "이름", "인원", "식사", "연락처"] as const;

/**
 * 숫자만 남은 연락처에 하이픈을 넣는다.
 *
 * 보기 좋으라고 하는 것이 아니다. **엑셀이 `01012345678` 을 숫자로 읽어 앞의 0 을
 * 지운다** — 열어 보면 `1012345678` 이 되어 있고, 그 상태로는 전화를 걸 수 없다.
 * 하이픈이 하나라도 있으면 엑셀이 텍스트로 두므로 0 이 살아남는다.
 *
 * 저장값 자체는 숫자만으로 통일되어 있다(rsvp.ts 의 normalizePhone). 여기서
 * 되돌리는 것은 내보낼 때뿐이며 DB 값은 건드리지 않는다.
 *
 * 아는 형태가 아니면 원본을 그대로 둔다. 억지로 끊어 놓으면 잘못된 번호를 맞는
 * 번호처럼 보이게 만든다.
 */
export function formatPhone(digits: string): string {
  if (!/^\d+$/.test(digits)) return digits;

  // 서울(02)만 국번이 두 자리다.
  if (digits.startsWith("02")) {
    if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    if (digits.length === 10) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    return digits;
  }
  if (digits.length === 11) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits;
}

/**
 * DB 의 UTC 시각을 KST 로 옮겨 `2026-08-18 21:03` 으로 적는다.
 *
 * 한국은 서머타임이 없어 9시간을 더하는 것만으로 정확하다 — countdown.ts 가 같은
 * 방식을 쓴다. `toLocaleString` 을 쓰지 않는 이유는 결과가 실행 환경의 시간대와
 * 로캘에 따라 달라지기 때문이다. 내려받는 사람의 노트북 설정에 따라 시각이
 * 달라지면 식수 대조가 어긋난다.
 */
export function formatKst(iso: string): string {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return iso;

  const kst = new Date(ms + KST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())} ` +
    `${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`
  );
}

/**
 * 엑셀·구글 시트가 **수식으로 해석하는 시작 문자**.
 *
 * 이름은 하객이 자유롭게 적는 칸이고 DB 제약도 길이(1~20자)뿐이라, `=…` 로 적어
 * 보내면 그대로 CSV 에 실린다. 앞에 작은따옴표를 붙이면 그 칸은 글자로만 읽힌다.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

/**
 * CSV 한 칸을 안전하게 감싼다.
 *
 * 이름에 쉼표가 들어갈 일은 드물지만, 한 건이라도 섞이면 그 행부터 열이 통째로
 * 밀려 명단 전체를 손으로 맞춰야 한다. 큰따옴표는 두 번 적어 escape 한다.
 *
 * 수식 방어를 함께 한다. `=1+1` 이 이름 자리에 들어오면 엑셀에서는 `2` 로 그려져
 * 원래 무엇이 적혀 있었는지 파일만 봐서는 알 수 없고, `=HYPERLINK(…)` 면 이름이
 * 클릭 가능한 링크가 된다.
 *
 * 인원·시각·연락처는 이 문자로 시작할 일이 없어 영향을 받지 않는다.
 */
function cell(value: string | number): string {
  const raw = String(value);
  const text = FORMULA_LEAD.test(raw) ? `'${raw}` : raw;

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * 회신 목록을 CSV 본문으로 만든다 (BOM 없음 — 붙이는 것은 rsvpCsvBlob 이다).
 *
 * 줄바꿈이 CRLF 인 것은 엑셀 때문이다. LF 만 쓰면 옛 엑셀에서 한 줄로 붙어 보인다.
 *
 * **미참석 회신의 인원은 빈칸으로 둔다.** DB 의 count 는 not null 이라 미참석에도
 * 1 이 들어가 있는데(rsvp.ts 의 toRsvpPayload), 그 자리표시 값을 그대로 내보내면
 * 명단을 훑는 사람이 「못 오는데 1명」으로 읽는다. 식사도 같은 이유로 비운다.
 */
export function toRsvpCsv(rows: readonly RsvpRow[]): string {
  const lines = [HEADERS.join(",")];

  for (const row of rows) {
    const attending = row.attend === "참석";
    lines.push(
      [
        cell(formatKst(row.created_at)),
        cell(row.side),
        cell(row.attend),
        cell(row.name),
        cell(attending ? row.count : ""),
        cell(attending ? row.meal : ""),
        cell(formatPhone(row.phone)),
      ].join(","),
    );
  }
  return lines.join("\r\n");
}

/**
 * 다운로드용 Blob. **UTF-8 BOM 을 앞에 붙인다.**
 *
 * 없으면 엑셀이 한글을 깨서 연다(`ì°¸ì„`). 엑셀은 BOM 이 없는 CSV 를 시스템
 * 기본 인코딩으로 읽기 때문이다. 메모장·구글 시트는 BOM 이 있어도 문제없다.
 *
 * 글자 그대로 적지 않고 `\uFEFF` 로 두는 것은 **눈에 보이지 않는 문자**라서다.
 * 소스에 그냥 넣으면 빈 문자열처럼 보여, 다음 사람이 지워도 아무도 알아채지
 * 못한다 — 엑셀에서 한글이 깨지고 나서야 드러난다.
 */
export function rsvpCsvBlob(rows: readonly RsvpRow[]): Blob {
  return new Blob(["\uFEFF", toRsvpCsv(rows)], { type: "text/csv;charset=utf-8" });
}

/** `rsvp-` 뒤에 `YYYY-MM-DD` 를 붙인다. 날짜는 내려받는 시점의 KST 기준이다. */
export function rsvpCsvFileName(now: number = Date.now()): string {
  return `rsvp-${formatKst(new Date(now).toISOString()).slice(0, 10)}.csv`;
}
