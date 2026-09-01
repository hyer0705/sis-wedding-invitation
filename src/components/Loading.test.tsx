import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { renderWithMotion } from "../test/renderWithMotion";
import Loading, { MAX_VISIBLE_MS, MIN_VISIBLE_MS, useCoverReady } from "./Loading";
import { COVER_SIZES } from "./Cover";

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
  it("진행 상황을 알리는 status 로 노출된다", () => {
    renderWithMotion(<Loading />);

    expect(screen.getByRole("status", { name: "청첩장을 불러오는 중" })).toBeInTheDocument();
  });

  it("커버와 같은 문구를 보여 준다", () => {
    renderWithMotion(<Loading />);

    expect(screen.getByText("The wedding of")).toBeInTheDocument();
  });
});
