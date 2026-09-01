import { describe, expect, it } from "vitest";
import { clampIndex, scrollLeftAt, slideIndexAt } from "./carousel";

const COUNT = 14;

describe("clampIndex", () => {
  it("범위를 벗어난 값을 첫 장·끝 장으로 가둔다", () => {
    expect(clampIndex(-3, COUNT)).toBe(0);
    expect(clampIndex(0, COUNT)).toBe(0);
    expect(clampIndex(13, COUNT)).toBe(13);
    expect(clampIndex(99, COUNT)).toBe(13);
  });

  it("사진이 없으면 0을 준다", () => {
    expect(clampIndex(5, 0)).toBe(0);
  });
});

describe("slideIndexAt", () => {
  const STEP = 336;

  it("스냅 지점에서 해당 슬라이드를 가리킨다", () => {
    expect(slideIndexAt(0, STEP, COUNT)).toBe(0);
    expect(slideIndexAt(STEP, STEP, COUNT)).toBe(1);
    expect(slideIndexAt(STEP * 5, STEP, COUNT)).toBe(5);
  });

  it("스냅 지점에 정확히 멈추지 않아도 가장 가까운 슬라이드를 고른다", () => {
    expect(slideIndexAt(STEP * 3 - 4, STEP, COUNT)).toBe(3);
    expect(slideIndexAt(STEP * 3 + 4, STEP, COUNT)).toBe(3);
  });

  it("고무줄 스크롤로 범위를 넘겨도 첫 장·끝 장을 벗어나지 않는다", () => {
    expect(slideIndexAt(-80, STEP, COUNT)).toBe(0);
    expect(slideIndexAt(STEP * 20, STEP, COUNT)).toBe(COUNT - 1);
  });

  it("레이아웃 전(step 0)에는 첫 장으로 둔다", () => {
    expect(slideIndexAt(500, 0, COUNT)).toBe(0);
  });
});

describe("scrollLeftAt", () => {
  const STEP = 336;

  it("슬라이드 번호를 스크롤 위치로 바꾼다", () => {
    expect(scrollLeftAt(0, STEP, COUNT)).toBe(0);
    expect(scrollLeftAt(4, STEP, COUNT)).toBe(STEP * 4);
  });

  it("범위를 벗어난 요청은 첫 장·끝 장 위치로 준다", () => {
    expect(scrollLeftAt(-1, STEP, COUNT)).toBe(0);
    expect(scrollLeftAt(COUNT + 5, STEP, COUNT)).toBe(STEP * (COUNT - 1));
  });

  it("레이아웃 전(step 0)에는 움직이지 않는다", () => {
    expect(scrollLeftAt(3, 0, COUNT)).toBe(0);
  });
});
