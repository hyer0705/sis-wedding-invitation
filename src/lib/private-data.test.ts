import { describe, expect, it } from "vitest";
import { orMock, parseAccounts } from "./private-data";

describe("parseAccounts", () => {
  // 픽스처의 계좌번호는 모든 자리가 같은 숫자여야 한다. 진짜 형식으로 적으면
  // 검토 게이트(scripts/review-guard.mjs)가 개인정보로 보고 커밋을 막는다.
  it("계좌 하나를 파싱한다", () => {
    expect(parseAccounts("신랑|국민은행|000000-00-000000|홍길동")).toEqual([
      { role: "신랑", bank: "국민은행", number: "000000-00-000000", holder: "홍길동" },
    ]);
  });

  it("세미콜론으로 여러 계좌를 나눈다", () => {
    const parsed = parseAccounts("신랑|국민|111|홍길동;신랑 아버지|신한|222|홍아무");
    expect(parsed).toHaveLength(2);
    expect(parsed[1].role).toBe("신랑 아버지");
  });

  it("적은 순서를 유지한다", () => {
    // 화면 표시 순서가 이 순서를 그대로 따른다.
    const parsed = parseAccounts("신부|카뱅|333|가;신부 어머니|하나|444|나");
    expect(parsed.map((a) => a.role)).toEqual(["신부", "신부 어머니"]);
  });

  it("항목 주변 공백을 걷어낸다", () => {
    const [account] = parseAccounts("  신랑 | 국민은행 | 111-222 | 홍길동  ");
    expect(account).toEqual({ role: "신랑", bank: "국민은행", number: "111-222", holder: "홍길동" });
  });

  it("값이 없으면 빈 배열이다 — 호출부는 mock으로 메우지 않는다", () => {
    expect(parseAccounts(undefined)).toEqual([]);
    expect(parseAccounts("")).toEqual([]);
    expect(parseAccounts("   ")).toEqual([]);
  });

  it("형식이 깨진 항목만 버리고 나머지는 살린다", () => {
    // 계좌 하나가 잘못됐다고 섹션 전체를 날리지 않는다.
    const parsed = parseAccounts("신랑|국민|111|홍길동;망가진항목;신부|카뱅|222|김아무");
    expect(parsed.map((a) => a.role)).toEqual(["신랑", "신부"]);
  });

  it("빈 칸이 섞인 항목은 버린다", () => {
    expect(parseAccounts("신랑||111|홍길동")).toEqual([]);
  });
});

describe("orMock", () => {
  it("환경변수 값이 있으면 그것을 쓴다", () => {
    expect(orMock("김실제", "박목업")).toBe("김실제");
  });

  it("비어 있거나 공백뿐이면 mock으로 폴백한다", () => {
    expect(orMock(undefined, "박목업")).toBe("박목업");
    expect(orMock("", "박목업")).toBe("박목업");
    expect(orMock("   ", "박목업")).toBe("박목업");
  });
});
