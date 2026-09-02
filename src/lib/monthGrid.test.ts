import { describe, expect, it } from "vitest";
import { WEEKDAY_LABELS, monthGridOf } from "./monthGrid";

describe("monthGridOf", () => {
  it("모든 주가 7칸이고 그 달의 날짜가 빠짐없이 들어간다", () => {
    const grid = monthGridOf("2027-01-24T11:00:00+09:00");

    for (const week of grid.weeks) expect(week).toHaveLength(7);
    expect(grid.weeks.flat().filter((d) => d !== null)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });

  it("1일을 그 달 1일의 요일 칸에 놓는다", () => {
    const grid = monthGridOf("2027-01-24T11:00:00+09:00");

    expect(grid.weeks[0]).toEqual([null, null, null, null, null, 1, 2]);
    expect(WEEKDAY_LABELS[5]).toBe("금");
  });

  it("예식일을 그날의 요일 칸에 놓는다", () => {
    const grid = monthGridOf("2027-01-24T11:00:00+09:00");
    const week = grid.weeks.find((w) => w.includes(grid.weddingDay));

    expect(grid.weddingDay).toBe(24);
    expect(week?.indexOf(24)).toBe(0);
    expect(WEEKDAY_LABELS[0]).toBe("일");
  });

  it("남는 주를 만들지 않는다", () => {
    const grid = monthGridOf("2027-02-14T11:00:00+09:00");

    expect(grid.weeks).toHaveLength(5);
    expect(grid.weeks[0]).toEqual([null, 1, 2, 3, 4, 5, 6]);
  });

  it("윤년 2월의 29일을 빠뜨리지 않는다", () => {
    const grid = monthGridOf("2028-02-29T11:00:00+09:00");

    expect(grid.weeks.flat()).toContain(29);
    expect(grid.weddingDay).toBe(29);
  });

  it("KST 자정 직후를 그날로 읽는다", () => {
    const grid = monthGridOf("2027-01-01T00:30:00+09:00");

    expect(grid.year).toBe(2027);
    expect(grid.month).toBe(1);
    expect(grid.weddingDay).toBe(1);
  });

  it("KST 자정 직전을 다음 날로 넘기지 않는다", () => {
    const grid = monthGridOf("2027-01-31T23:30:00+09:00");

    expect(grid.month).toBe(1);
    expect(grid.weddingDay).toBe(31);
  });
});
