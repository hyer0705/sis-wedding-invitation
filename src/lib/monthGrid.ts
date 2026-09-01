const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export type MonthGrid = {
  year: number;
  month: number;
  weddingDay: number;
  weeks: (number | null)[][];
};

function kstParts(epochMs: number): { year: number; month: number; day: number } {
  const shifted = new Date(epochMs + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function monthGridOf(weddingISO: string): MonthGrid {
  const { year, month, day } = kstParts(new Date(weddingISO).getTime());

  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const lastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: (number | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: lastDate }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return { year, month, weddingDay: day, weeks };
}
