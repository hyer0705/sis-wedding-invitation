import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom에는 IntersectionObserver가 없다. Reveal의 whileInView가 이를 사용하므로
// 모든 섹션 테스트가 여기서 막힌다. 관측 즉시 "화면에 들어온" 것으로 처리해
// 스크롤 리빌 이후의 최종 상태를 검증 대상으로 삼는다.
class ImmediateIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly scrollMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];

  constructor(private readonly callback: IntersectionObserverCallback) {}

  observe(target: Element): void {
    this.callback(
      [
        {
          target,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRect: target.getBoundingClientRect(),
          rootBounds: null,
          time: 0,
        },
      ],
      this,
    );
  }

  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

globalThis.IntersectionObserver = ImmediateIntersectionObserver;

// 테스트 간 DOM 잔여물 제거 — 컴포넌트 테스트가 서로 간섭하지 않게 한다
afterEach(() => {
  cleanup();
});
