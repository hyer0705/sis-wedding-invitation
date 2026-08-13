import { describe, expect, it } from "vitest";
import { formatParentName, formatParents } from "./parents";

describe("formatParentName", () => {
  it("IN-04 고인 성함 앞에 故 를 붙인다", () => {
    expect(formatParentName({ name: "홍길동", deceased: true })).toBe("故 홍길동");
  });

  it("생존한 혼주 성함은 그대로 둔다", () => {
    expect(formatParentName({ name: "홍길동", deceased: false })).toBe("홍길동");
  });
});

describe("formatParents", () => {
  it("IN-03 두 분을 가운뎃점으로 잇는다", () => {
    const line = formatParents([
      { name: "홍길동", deceased: false },
      { name: "성춘향", deceased: false },
    ]);
    expect(line).toBe("홍길동 · 성춘향");
  });

  it("한 분뿐이면 가운뎃점을 붙이지 않는다", () => {
    // 신랑측이 이 경우다 — 어머니를 표기하지 않기로 확정했다(2026-08-11).
    expect(formatParents([{ name: "홍길동", deceased: false }])).toBe("홍길동");
  });

  it("고인 표기와 가운뎃점이 함께 쓰인다", () => {
    // 신부측이 이 경우다.
    const line = formatParents([
      { name: "홍길동", deceased: true },
      { name: "성춘향", deceased: false },
    ]);
    expect(line).toBe("故 홍길동 · 성춘향");
  });

  it("성함이 빈 항목은 자리째로 걷어낸다", () => {
    // 환경변수가 빈 채로 들어온 경우다. 그대로 두면 "故 " 나 가운뎃점만 남은 줄이
    // 하객에게 보인다.
    const line = formatParents([
      { name: "홍길동", deceased: false },
      { name: "   ", deceased: true },
    ]);
    expect(line).toBe("홍길동");
  });

  it("아무도 없으면 빈 문자열이다", () => {
    expect(formatParents([])).toBe("");
  });
});
