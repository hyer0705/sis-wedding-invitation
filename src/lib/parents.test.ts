import { describe, expect, it } from "vitest";
import { formatParentName, parentNameLines } from "./parents";

describe("formatParentName", () => {
  it("IN-04 고인 성함 앞에 故 를 붙인다", () => {
    expect(formatParentName({ name: "홍길동", deceased: true })).toBe("故 홍길동");
  });

  it("생존한 혼주 성함은 그대로 둔다", () => {
    expect(formatParentName({ name: "홍길동", deceased: false })).toBe("홍길동");
  });
});

describe("parentNameLines", () => {
  it("IN-03 두 분을 한 분에 한 줄씩 세운다", () => {
    // 2026-09-01 고객 요청으로 한 줄에 잇던 것을 두 줄로 갈랐다.
    const lines = parentNameLines([
      { name: "홍길동", deceased: false },
      { name: "성춘향", deceased: false },
    ]);
    expect(lines).toEqual(["홍길동", "성춘향"]);
  });

  it("한 분뿐이면 줄도 하나뿐이다", () => {
    // 신랑측이 이 경우다 — 어머니를 표기하지 않기로 확정했다(2026-08-11).
    expect(parentNameLines([{ name: "홍길동", deceased: false }])).toEqual(["홍길동"]);
  });

  it("고인 표기는 그 분의 줄에만 붙는다", () => {
    // 신부측이 이 경우다.
    const lines = parentNameLines([
      { name: "홍길동", deceased: true },
      { name: "성춘향", deceased: false },
    ]);
    expect(lines).toEqual(["故 홍길동", "성춘향"]);
  });

  it("성함이 빈 항목은 자리째로 걷어낸다", () => {
    // 환경변수가 빈 채로 들어온 경우다. 그대로 두면 "故 " 만 남은 줄이 하객에게 보인다.
    const lines = parentNameLines([
      { name: "홍길동", deceased: false },
      { name: "   ", deceased: true },
    ]);
    expect(lines).toEqual(["홍길동"]);
  });

  it("아무도 없으면 줄도 없다", () => {
    expect(parentNameLines([])).toEqual([]);
  });
});
