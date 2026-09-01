import { afterEach, describe, expect, it, vi } from "vitest";
import { isLargeText, LARGE_SCALE, restoreTextSize, scaled, setLargeText, subscribeTextSize } from "./textSize";

const root = document.documentElement;

afterEach(() => {
  localStorage.clear();
  setLargeText(false);
  vi.restoreAllMocks();
});

describe("scaled", () => {
  it("글자 크기에 배율 변수를 물린다", () => {
    expect(scaled(14.5)).toBe("calc(14.5px * var(--type-scale))");
  });
});

describe("setLargeText", () => {
  it("배율을 올리고 좁은 화면 보정을 위한 표시를 남긴다", () => {
    setLargeText(true);

    expect(root.style.getPropertyValue("--type-scale")).toBe(String(LARGE_SCALE));
    expect(root.dataset.textSize).toBe("large");
  });

  it("끄면 배율과 표시가 모두 돌아온다", () => {
    setLargeText(true);
    setLargeText(false);

    expect(root.style.getPropertyValue("--type-scale")).toBe("1");
    expect(root.dataset.textSize).toBeUndefined();
  });

  it("구독자에게 알린다 — 버튼 둘이 같은 상태를 본다", () => {
    const listener = vi.fn();
    const stop = subscribeTextSize(listener);

    setLargeText(true);

    expect(listener).toHaveBeenCalled();
    expect(isLargeText()).toBe(true);
    stop();
  });
});

describe("restoreTextSize", () => {
  it("지난 방문에서 켜 두었으면 첫 그림부터 큰 글씨다", () => {
    setLargeText(true);
    root.style.removeProperty("--type-scale");

    restoreTextSize();

    expect(root.style.getPropertyValue("--type-scale")).toBe(String(LARGE_SCALE));
    expect(isLargeText()).toBe(true);
  });

  it("저장한 적이 없으면 기본 크기다", () => {
    restoreTextSize();

    expect(isLargeText()).toBe(false);
  });

  it("저장소를 읽지 못해도 기본 크기로 연다", () => {
    // 사파리 사생활 보호 창은 localStorage 접근 자체가 던진다.
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });

    expect(() => restoreTextSize()).not.toThrow();
    expect(isLargeText()).toBe(false);
  });

  it("저장에 실패해도 이번 방문 동안은 켜진 채로 둔다", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    expect(() => setLargeText(true)).not.toThrow();
    expect(root.style.getPropertyValue("--type-scale")).toBe(String(LARGE_SCALE));
  });
});
