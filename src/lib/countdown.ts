const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export type CountdownPhase = "before" | "wedding-day" | "after";

export type Countdown = {
  phase: CountdownPhase;
  days: number;
  hours: string;
  mins: string;
  secs: string;
};

export const WEDDING_DAY_MESSAGE = "오늘은 저희가 결혼하는 날입니다";
export const AFTER_MESSAGE = "저희 두 사람의 결혼식에 함께해 주셔서 감사합니다";

function kstDayIndex(epochMs: number): number {
  return Math.floor((epochMs + KST_OFFSET_MS) / DAY_MS);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

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
