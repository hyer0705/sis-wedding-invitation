// CV-04 D-Day 카운트다운 계산.
//
// 컴포넌트에 두지 않고 여기로 분리한 이유는 경계(예식 당일 0시·예식 다음 날 0시)
// 전환을 테스트로 고정하기 위함이다 (docs/WORKFLOW.md §7).
//
// 페이지는 예식 후 1개월간 유지되므로(CM-08) "예식 이후" 상태가 실제로 노출된다.
// 남은 시간을 0으로 깎아 "결혼식까지 0일"을 계속 보여주면 안 된다.

const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 예식 시각을 기준으로 한 세 가지 상태. 판정 기준은 시각이 아니라 KST 날짜다. */
export type CountdownPhase = "before" | "wedding-day" | "after";

export type Countdown = {
  phase: CountdownPhase;
  /** 예식까지 남은 일수. 예식 시각을 지나면 0이다. */
  days: number;
  /** 이하 셋은 두 자리로 채운 표시용 문자열이다. */
  hours: string;
  mins: string;
  secs: string;
};

// 예식 당일/이후 문구. 고객 확정값(2026-08-04)이라 화면과 테스트가 같은 상수를 본다.
export const WEDDING_DAY_MESSAGE = "오늘은 저희가 결혼하는 날입니다";
export const AFTER_MESSAGE = "저희 두 사람의 결혼식에 함께해 주셔서 감사합니다";

/**
 * KST 자정을 경계로 하는 날짜 일련번호.
 *
 * Intl로 날짜 문자열을 뽑으면 실행 환경의 ICU 빌드·로케일에 결과가 흔들린다.
 * 한국은 서머타임이 없어 오프셋이 항상 +09:00이므로, 9시간을 더한 뒤 하루로
 * 나누는 것만으로 KST 날짜가 정확히 나온다.
 */
function kstDayIndex(epochMs: number): number {
  return Math.floor((epochMs + KST_OFFSET_MS) / DAY_MS);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * `targetISO` 예식 시각에 대해 `now` 시점의 카운트다운 상태를 계산한다.
 *
 * 상태는 KST 날짜로 가른다 — 예식 시각(11시)이 지나도 그날 안이면 "예식 당일"이고,
 * 자정을 넘겨야 "예식 이후"가 된다.
 */
export function countdownAt(targetISO: string, now: number): Countdown {
  const target = new Date(targetISO).getTime();
  const dayDiff = kstDayIndex(now) - kstDayIndex(target);
  const phase: CountdownPhase = dayDiff < 0 ? "before" : dayDiff === 0 ? "wedding-day" : "after";

  let remaining = Math.max(0, target - now);
  const days = Math.floor(remaining / DAY_MS);
  remaining -= days * DAY_MS;
  const hours = Math.floor(remaining / 3_600_000);
  remaining -= hours * 3_600_000;
  const mins = Math.floor(remaining / 60_000);
  const secs = Math.floor((remaining - mins * 60_000) / 1000);

  return { phase, days, hours: pad(hours), mins: pad(mins), secs: pad(secs) };
}
