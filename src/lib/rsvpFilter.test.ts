import { describe, expect, it } from "vitest";
import type { RsvpRow } from "./adminRsvp";
import { countByAttend, countBySide, EMPTY_FILTER, filterRsvp, isFiltered, type RsvpFilter } from "./rsvpFilter";

function row(overrides: Partial<RsvpRow> = {}): RsvpRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    side: "신랑측",
    attend: "참석",
    name: "홍길동",
    count: 2,
    meal: "식사함",
    phone: "01012345678",
    created_at: "2026-08-18T12:03:00.000Z",
    ...overrides,
  };
}

function filter(overrides: Partial<RsvpFilter> = {}): RsvpFilter {
  return { ...EMPTY_FILTER, ...overrides };
}

describe("filterRsvp", () => {
  it("기본 필터는 한 건도 거르지 않는다", () => {
    const rows = [row(), row({ attend: "미참석", side: "신부측" })];
    expect(filterRsvp(rows, EMPTY_FILTER)).toEqual(rows);
  });

  it("참석 여부로 거른다", () => {
    const 참석 = row({ id: "a" });
    const 미참석 = row({ id: "b", attend: "미참석" });

    expect(filterRsvp([참석, 미참석], filter({ attend: "참석" }))).toEqual([참석]);
    expect(filterRsvp([참석, 미참석], filter({ attend: "미참석" }))).toEqual([미참석]);
  });

  it("양가로 거른다", () => {
    const 신랑측 = row({ id: "a" });
    const 신부측 = row({ id: "b", side: "신부측" });

    expect(filterRsvp([신랑측, 신부측], filter({ side: "신부측" }))).toEqual([신부측]);
  });

  it("조건 두 개는 함께 걸린다", () => {
    const rows = [
      row({ id: "a", side: "신랑측", attend: "참석" }),
      row({ id: "b", side: "신랑측", attend: "미참석" }),
      row({ id: "c", side: "신부측", attend: "참석" }),
    ];

    const result = filterRsvp(rows, filter({ side: "신랑측", attend: "참석" }));
    expect(result.map((r) => r.id)).toEqual(["a"]);
  });

  it("원본 순서를 바꾸지 않는다", () => {
    const rows = [row({ id: "a" }), row({ id: "b" }), row({ id: "c" })];
    expect(filterRsvp(rows, EMPTY_FILTER).map((r) => r.id)).toEqual(["a", "b", "c"]);
  });

  describe("검색", () => {
    it("이름 일부로 찾는다", () => {
      const 김민준 = row({ id: "a", name: "김민준" });
      const 이서연 = row({ id: "b", name: "이서연" });

      expect(filterRsvp([김민준, 이서연], filter({ query: "김" }))).toEqual([김민준]);
    });

    it("앞뒤 공백은 무시한다", () => {
      const rows = [row({ name: "김민준" })];
      expect(filterRsvp(rows, filter({ query: "  김민준  " }))).toEqual(rows);
    });

    it("공백만 적으면 거르지 않는다", () => {
      const rows = [row({ name: "김민준" }), row({ name: "이서연" })];
      expect(filterRsvp(rows, filter({ query: "   " }))).toEqual(rows);
    });

    // 저장값은 숫자만인데 화면에는 하이픈이 붙어 보인다. 보이는 대로 적어도 걸려야 한다.
    it("화면에 보이는 하이픈 형태로도 연락처를 찾는다", () => {
      const rows = [row({ phone: "01012345678" })];
      expect(filterRsvp(rows, filter({ query: "010-1234" }))).toEqual(rows);
    });

    it("숫자만 적어도 연락처를 찾는다", () => {
      const rows = [row({ phone: "01012345678" })];
      expect(filterRsvp(rows, filter({ query: "5678" }))).toEqual(rows);
    });

    it("숫자가 없는 검색어는 연락처를 보지 않는다", () => {
      const rows = [row({ name: "김민준", phone: "01012345678" })];
      expect(filterRsvp(rows, filter({ query: "홍" }))).toEqual([]);
    });

    it("맞는 것이 없으면 빈 목록이다", () => {
      const rows = [row({ name: "김민준" })];
      expect(filterRsvp(rows, filter({ query: "박" }))).toEqual([]);
    });
  });
});

describe("isFiltered", () => {
  it("기본 상태는 걸린 조건이 없다", () => {
    expect(isFiltered(EMPTY_FILTER)).toBe(false);
  });

  it("공백만 적은 검색어는 조건으로 세지 않는다", () => {
    expect(isFiltered(filter({ query: "   " }))).toBe(false);
  });

  it.each([
    ["참석 여부", filter({ attend: "참석" })],
    ["양가", filter({ side: "신부측" })],
    ["검색어", filter({ query: "김" })],
  ])("%s가 걸리면 true 다", (_label, value) => {
    expect(isFiltered(value)).toBe(true);
  });
});

describe("countByAttend", () => {
  it("전체는 건수 그대로이고 나머지는 참석 여부별로 센다", () => {
    const rows = [row(), row({ attend: "미참석" }), row({ attend: "미참석" })];

    expect(countByAttend(rows)).toEqual({ 전체: 3, 참석: 1, 미참석: 2 });
  });

  it("빈 목록은 전부 0 이다", () => {
    expect(countByAttend([])).toEqual({ 전체: 0, 참석: 0, 미참석: 0 });
  });
});

describe("countBySide", () => {
  it("양가는 건수 그대로이고 나머지는 측별로 센다", () => {
    const rows = [row(), row({ side: "신부측" }), row({ side: "신부측" })];

    expect(countBySide(rows)).toEqual({ 양가: 3, 신랑측: 1, 신부측: 2 });
  });
});
