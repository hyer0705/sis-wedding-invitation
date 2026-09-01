import { describe, expect, it } from "vitest";
import { LARGE_SCALE, NORMAL_SCALE, scaled } from "./typeScale";

describe("scaled", () => {
  it("글자 크기에 배율 변수를 물린다", () => {
    expect(scaled(14.5)).toBe("calc(14.5px * var(--type-scale))");
  });

  it("정수 크기도 소수점 없이 그대로 쓴다", () => {
    expect(scaled(13)).toBe("calc(13px * var(--type-scale))");
  });
});

describe("배율 값", () => {
  it("큰 글씨는 노년 하객 권장 하한(본문 19px)을 넘긴다", () => {
    expect(14.5 * LARGE_SCALE).toBeGreaterThanOrEqual(19);
  });

  it("기본 배율은 크기를 바꾸지 않는다", () => {
    expect(NORMAL_SCALE).toBe(1);
  });
});
