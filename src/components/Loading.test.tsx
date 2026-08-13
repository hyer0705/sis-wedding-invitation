import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { renderWithMotion } from "../test/renderWithMotion";
import Loading, { MAX_VISIBLE_MS, MIN_VISIBLE_MS, useCoverReady } from "./Loading";
import { COVER_SIZES } from "./Cover";

// 커버 사진의 도착 시점을 테스트가 직접 쥔다. 실제 preloadImage 는 Image 객체를 만드는데,
// 여기서 보려는 것은 그 뒤의 타이밍(최소 표시 시간·상한)이라 로드 자체를 갈아끼운다.
const { preloadImage, deliverCover } = vi.hoisted(() => {
  let resolvePreload: (() => void) | undefined;
  return {
    preloadImage: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePreload = resolve;
        }),
    ),
    deliverCover: () => resolvePreload?.(),
  };
});

vi.mock("../lib/preloadImage", () => ({ preloadImage }));

function Harness() {
  return <span>{useCoverReady() ? "걷힘" : "로딩 중"}</span>;
}

describe("useCoverReady", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    preloadImage.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("커버 사진이 도착해도 최소 표시 시간 전에는 걷지 않는다", async () => {
    render(<Harness />);
    expect(screen.getByText("로딩 중")).toBeInTheDocument();

    await act(async () => {
      deliverCover();
    });
    // 사진이 캐시에서 즉시 와도 진행선이 차오를 틈은 준다 — 없으면 깜빡임으로 보인다
    expect(screen.getByText("로딩 중")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(MIN_VISIBLE_MS - 1);
    });
    expect(screen.getByText("로딩 중")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText("걷힘")).toBeInTheDocument();
  });

  // R2 가 죽었거나 회선이 끊긴 경우다. 상한이 없으면 청첩장을 통째로 못 본다
  it("커버 사진이 오지 않아도 상한에서 걷는다", async () => {
    render(<Harness />);

    await act(async () => {
      vi.advanceTimersByTime(MAX_VISIBLE_MS - 1);
    });
    expect(screen.getByText("로딩 중")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText("걷힘")).toBeInTheDocument();
  });

  // 프리로드가 화면의 <img> 와 다른 후보를 고르면 사진을 두 장 내려받는다.
  // Cover 가 export 하는 상수를 그대로 쓰는지 본다
  it("커버와 같은 사진·sizes 로 프리로드한다", () => {
    render(<Harness />);

    expect(preloadImage).toHaveBeenCalledWith(
      expect.stringContaining("1_main-960.webp"),
      expect.stringContaining("1_main-480.webp 480w"),
      COVER_SIZES,
    );
  });
});

describe("Loading", () => {
  // 토스트 컨테이너도 status 라 이름으로 집는다 (renderWithMotion 이 ToastProvider 를 감싼다)
  it("진행 상황을 알리는 status 로 노출된다", () => {
    renderWithMotion(<Loading />);

    expect(screen.getByRole("status", { name: "청첩장을 불러오는 중" })).toBeInTheDocument();
  });

  // 로딩이 걷히면 커버 최상단의 같은 글씨로 이어진다. 문구가 달라지면 화면이 튄다
  it("커버와 같은 문구를 보여 준다", () => {
    renderWithMotion(<Loading />);

    expect(screen.getByText("The wedding of")).toBeInTheDocument();
  });
});
