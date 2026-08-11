import { describe, expect, it } from "vitest";
import { WEEKDAY_LABELS, monthGridOf } from "./monthGrid";

// 예식일이 실제 요일 칸에 놓이는지가 이 모듈의 전부다. 한 칸만 밀려도 화면은 멀쩡해
// 보이므로(달력은 원래 빈칸으로 시작한다) 눈으로는 잡히지 않는다.
//
// INVITE.dateISO 를 쓰지 않고 날짜를 직접 적는다 — 예식일이 바뀌어도 격자 계산이
// 옳다는 사실은 그대로여야 하기 때문이다. INVITE 와의 연결은 Calendar 테스트가 본다.

describe("monthGridOf", () => {
  it("모든 주가 7칸이고 그 달의 날짜가 빠짐없이 들어간다", () => {
    const grid = monthGridOf("2027-01-24T11:00:00+09:00");

    for (const week of grid.weeks) expect(week).toHaveLength(7);
    expect(grid.weeks.flat().filter((d) => d !== null)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  });

  it("1일을 그 달 1일의 요일 칸에 놓는다", () => {
    // 2027-01-01 은 금요일이라 앞이 다섯 칸 비어야 한다.
    const grid = monthGridOf("2027-01-24T11:00:00+09:00");

    expect(grid.weeks[0]).toEqual([null, null, null, null, null, 1, 2]);
    expect(WEEKDAY_LABELS[5]).toBe("금");
  });

  it("예식일을 그날의 요일 칸에 놓는다", () => {
    // 2027-01-24 은 일요일 — INVITE.dayText 와 같아야 하는 지점이다.
    const grid = monthGridOf("2027-01-24T11:00:00+09:00");
    const week = grid.weeks.find((w) => w.includes(grid.weddingDay));

    expect(grid.weddingDay).toBe(24);
    expect(week?.indexOf(24)).toBe(0);
    expect(WEEKDAY_LABELS[0]).toBe("일");
  });

  it("남는 주를 만들지 않는다", () => {
    // 2027-02-01 은 월요일, 28일까지다. 1 + 28 = 29 → 35칸(5주)이면 충분하다.
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
    // UTC 로는 아직 2026-12-31 이다. 실행 환경 시간대를 따라가면 12월 달력이 나온다.
    const grid = monthGridOf("2027-01-01T00:30:00+09:00");

    expect(grid.year).toBe(2027);
    expect(grid.month).toBe(1);
    expect(grid.weddingDay).toBe(1);
  });

  it("KST 자정 직전을 다음 날로 넘기지 않는다", () => {
    // 그 달의 마지막 날 늦은 밤. 하루 밀리면 달이 통째로 2월로 넘어간다.
    const grid = monthGridOf("2027-01-31T23:30:00+09:00");

    expect(grid.month).toBe(1);
    expect(grid.weddingDay).toBe(31);
  });
});
