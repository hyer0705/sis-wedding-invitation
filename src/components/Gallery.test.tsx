import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMotion } from "../test/renderWithMotion";
import Gallery from "./Gallery";
import { INVITE } from "../invite";

// jsdom 에는 Element.scrollTo 가 없다. 화살표가 스크롤러를 실제로 움직이는지만 보면 되므로
// 호출을 기록하는 스텁을 끼운다.
const scrollTo = vi.fn();
beforeEach(() => {
  scrollTo.mockClear();
  Element.prototype.scrollTo = scrollTo;
});

const next = () => screen.getByRole("button", { name: "다음 사진" });
const prev = () => screen.getByRole("button", { name: "이전 사진" });

describe("Gallery", () => {
  it("GL-01 INVITE의 사진을 모두 슬라이드로 깐다", () => {
    renderWithMotion(<Gallery />);

    expect(screen.getAllByRole("img")).toHaveLength(INVITE.gallery.length);
  });

  it("사진마다 설명이 붙는다", () => {
    renderWithMotion(<Gallery />);

    for (const image of screen.getAllByRole("img")) {
      expect(image).toHaveAccessibleName(expect.stringContaining(INVITE.bride.name));
    }
  });

  it("GL-04 화면 폭에 맞춰 480w·960w 중 하나를 고르게 한다", () => {
    renderWithMotion(<Gallery />);

    const [first] = screen.getAllByRole("img");
    expect(first).toHaveAttribute("srcset", expect.stringContaining("480w"));
    expect(first).toHaveAttribute("srcset", expect.stringContaining("960w"));
    expect(first).toHaveAttribute("sizes");
  });

  it("GL-04 보이는 장과 그 앞뒤만 미리 받고 나머지는 지연 로딩한다", () => {
    renderWithMotion(<Gallery />);

    const images = screen.getAllByRole("img");
    // 첫 장에서는 자기 자신과 옆에 걸쳐 보이는 다음 장까지.
    expect(images[0]).toHaveAttribute("loading", "eager");
    expect(images[1]).toHaveAttribute("loading", "eager");
    for (const image of images.slice(2)) {
      expect(image).toHaveAttribute("loading", "lazy");
    }
  });

  it("GL-04 넘기면 다음 장을 미리 받아 둔다", async () => {
    // 가로 스크롤러 안에서는 브라우저의 지연 로딩 판정을 믿을 수 없다. 넘긴 자리가
    // 비지 않도록 직접 앞당겨 받는다.
    const user = userEvent.setup();
    renderWithMotion(<Gallery />);

    await user.click(next());

    expect(screen.getAllByRole("img")[2]).toHaveAttribute("loading", "eager");
  });

  it("GL-02 사진을 눌러 크게 보는 기능을 만들지 않는다", () => {
    // 고객이 확대·줌을 거절했다(2026-08-06). 라이트박스가 되살아나면 여기서 걸린다.
    renderWithMotion(<Gallery />);

    for (const image of screen.getAllByRole("img")) {
      expect(image.closest("button")).toBeNull();
    }
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  describe("넘기기", () => {
    it("현재 위치를 몇 장 중 몇 번째인지로 보여준다", () => {
      renderWithMotion(<Gallery />);

      expect(screen.getByText(`1 / ${INVITE.gallery.length}`)).toBeInTheDocument();
    });

    it("다음 사진을 누르면 카운터가 올라가고 스크롤러가 움직인다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Gallery />);

      await user.click(next());

      expect(screen.getByText(`2 / ${INVITE.gallery.length}`)).toBeInTheDocument();
      expect(scrollTo).toHaveBeenCalled();
    });

    it("되돌아오면 카운터도 되돌아온다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Gallery />);

      await user.click(next());
      await user.click(prev());

      expect(screen.getByText(`1 / ${INVITE.gallery.length}`)).toBeInTheDocument();
    });

    it("첫 장에서는 이전으로 갈 수 없다", () => {
      renderWithMotion(<Gallery />);

      expect(prev()).toBeDisabled();
      expect(next()).toBeEnabled();
    });

    it("끝 장에서는 다음으로 갈 수 없다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Gallery />);

      for (let i = 0; i < INVITE.gallery.length - 1; i += 1) {
        await user.click(next());
      }

      expect(screen.getByText(`${INVITE.gallery.length} / ${INVITE.gallery.length}`)).toBeInTheDocument();
      expect(next()).toBeDisabled();
      expect(prev()).toBeEnabled();
    });
  });

  it("스크롤 영역을 키보드로도 다룰 수 있다", () => {
    // axe scrollable-region-focusable(serious). 안에 초점을 받을 요소가 없어
    // 트랙이 직접 초점을 받아야 좌우 키로 넘길 수 있다.
    renderWithMotion(<Gallery />);

    expect(screen.getByRole("group", { name: "웨딩 사진 갤러리" })).toHaveAttribute("tabindex", "0");
  });
});
