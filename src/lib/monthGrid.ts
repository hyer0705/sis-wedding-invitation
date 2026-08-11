// DT-02 달력 UI — 예식이 있는 달의 날짜 격자를 만든다.
//
// countdown.ts 와 같은 이유로 컴포넌트에서 분리했다. 격자의 앞뒤 빈칸 수는 그 달
// 1일의 요일에 따라 달라지는데, 이것이 어긋나면 예식일이 엉뚱한 요일 자리에 찍힌다.
// 화면만 보고는 알아채기 어려워 테스트로 고정한다 (docs/WORKFLOW.md §7).
//
// 날짜 판정은 전부 KST 다. 실행 환경의 시간대를 따라가면 자정 근처에서 달이
// 통째로 밀릴 수 있다 — CI 는 TZ=Asia/Seoul 이지만 하객의 폰은 그렇지 않다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 일요일 시작. 화면의 요일 헤더와 순서가 같아야 한다. */
export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export type MonthGrid = {
  year: number;
  /** 1~12. Date 의 0-based 월이 아니다 — 화면에 그대로 쓰는 값이다. */
  month: number;
  /** 예식일(1~31). 이 칸만 강조한다. */
  weddingDay: number;
  /** 주 단위 7칸 배열. 그 달에 없는 칸은 null 이다. */
  weeks: (number | null)[][];
};

/** epoch 밀리초를 KST 달력 값으로 읽는다. UTC 게터를 쓰므로 실행 환경 시간대의 영향을 받지 않는다. */
function kstParts(epochMs: number): { year: number; month: number; day: number } {
  const shifted = new Date(epochMs + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/**
 * `weddingISO`(예: INVITE.dateISO)가 속한 달의 격자를 만든다.
 *
 * 앞뒤를 null 로 채워 모든 주가 7칸이 되게 한다. 지난달·다음달 날짜를 흐리게
 * 끼워 넣지 않는 것은 c안에 그런 표현이 없기 때문이다 — 빈칸으로 둔다.
 */
export function monthGridOf(weddingISO: string): MonthGrid {
  const { year, month, day } = kstParts(new Date(weddingISO).getTime());

  // Date.UTC 로 계산하면 로컬 시간대가 끼어들지 않는다.
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  // 다음 달 0일 = 이번 달 마지막 날
  const lastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: lastDate }, (_, i) => i + 1),
  ];
  // 마지막 주를 7칸으로 맞춘다. 남는 주는 만들지 않는다 — 빈 줄이 카드 높이만 늘린다.
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return { year, month, weddingDay: day, weeks };
}
