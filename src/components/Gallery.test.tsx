import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMotion } from "../test/renderWithMotion";
import Gallery from "./Gallery";
import { INVITE } from "../invite";

const STEP = 300;

const scrollTo = vi.fn();
const originalOffsetLeft = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetLeft");

beforeEach(() => {
  scrollTo.mockClear();
  Element.prototype.scrollTo = scrollTo;

  Object.defineProperty(HTMLElement.prototype, "offsetLeft", {
    configurable: true,
    get(this: HTMLElement) {
      const parent = this.parentElement;
      if (!parent?.classList.contains("gallery-track")) return 0;
      return Array.prototype.indexOf.call(parent.children, this) * STEP;
    },
  });
});

afterEach(() => {
  if (originalOffsetLeft) Object.defineProperty(HTMLElement.prototype, "offsetLeft", originalOffsetLeft);
  Reflect.deleteProperty(Element.prototype, "scrollTo");
  vi.useRealTimers();
});

const next = () => screen.getByRole("button", { name: "다음 사진" });
const prev = () => screen.getByRole("button", { name: "이전 사진" });
const counter = () => screen.getByTestId("gallery-counter");
const liveRegion = () => screen.getByTestId("gallery-live");

function scrollTrackTo(slide: number) {
  const track = screen.getByRole("group", { name: "웨딩 사진 갤러리" });
  Object.defineProperty(track, "scrollLeft", { configurable: true, value: slide * STEP, writable: true });
  act(() => {
    track.dispatchEvent(new Event("scroll"));
  });
}

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
    expect(images[0]).toHaveAttribute("loading", "eager");
    expect(images[1]).toHaveAttribute("loading", "eager");
    for (const image of images.slice(2)) {
      expect(image).toHaveAttribute("loading", "lazy");
    }
  });

  it("GL-04 넘기면 다음 장을 미리 받아 둔다", async () => {
    const user = userEvent.setup();
    renderWithMotion(<Gallery />);

    await user.click(next());

    expect(screen.getAllByRole("img")[2]).toHaveAttribute("loading", "eager");
  });

  it("GL-02 사진을 눌러 크게 보는 기능을 만들지 않는다", () => {
    renderWithMotion(<Gallery />);

    for (const image of screen.getAllByRole("img")) {
      expect(image.closest("button")).toBeNull();
    }
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  describe("SIS-29 스켈레톤", () => {
    const slots = () => screen.getAllByTestId("gallery-slot");

    it("아직 안 온 자리에 면과 광택을 깐다", () => {
      renderWithMotion(<Gallery />);

      for (const slot of slots()) {
        expect(slot).toHaveClass("skeleton");
      }
      for (const image of screen.getAllByRole("img")) {
        expect(image).toHaveClass("image-pending");
      }
    });

    it("사진이 도착한 자리는 면째로 걷어 배경이 그대로 비치게 한다", () => {
      renderWithMotion(<Gallery />);
      const images = screen.getAllByRole("img");

      fireEvent.load(images[0]);

      expect(slots()[0]).not.toHaveClass("skeleton");
      expect(slots()[1]).toHaveClass("skeleton");
      expect(images[0]).not.toHaveClass("image-pending");
      expect(images[1]).toHaveClass("image-pending");
    });

    it("도착한 사진은 페이드로 얹는다", () => {
      renderWithMotion(<Gallery />);

      for (const image of screen.getAllByRole("img")) {
        expect(image).toHaveClass("image-fade");
      }
    });

    it("사진을 못 받아도 그 자리의 기다리기를 그만둔다", () => {
      renderWithMotion(<Gallery />);
      const images = screen.getAllByRole("img");

      fireEvent.error(images[0]);

      expect(slots()[0]).not.toHaveClass("skeleton");
      expect(images[0]).not.toHaveClass("image-pending");
    });
  });

  describe("넘기기", () => {
    it("현재 위치를 몇 장 중 몇 번째인지로 보여준다", () => {
      renderWithMotion(<Gallery />);

      expect(counter()).toHaveTextContent(`1 / ${INVITE.gallery.length}`);
    });

    it("다음 사진을 누르면 카운터가 올라가고 스크롤러가 그 자리로 간다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Gallery />);

      await user.click(next());

      expect(counter()).toHaveTextContent(`2 / ${INVITE.gallery.length}`);
      expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: STEP }));
    });

    it("되돌아오면 카운터도 되돌아온다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Gallery />);

      await user.click(next());
      await user.click(prev());

      expect(counter()).toHaveTextContent(`1 / ${INVITE.gallery.length}`);
      expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: 0 }));
    });

    it("연달아 누르면 누른 만큼 넘어간다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Gallery />);

      await user.click(next());
      scrollTrackTo(0.3);
      await user.click(next());

      expect(counter()).toHaveTextContent(`3 / ${INVITE.gallery.length}`);
      expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: STEP * 2 }));
    });

    it("손으로 붙잡으면 그 자리를 현재로 삼는다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Gallery />);
      const track = screen.getByRole("group", { name: "웨딩 사진 갤러리" });

      await user.click(next());
      act(() => {
        track.dispatchEvent(new Event("pointerdown"));
      });
      scrollTrackTo(5);

      expect(counter()).toHaveTextContent(`6 / ${INVITE.gallery.length}`);
    });

    it("스와이프해서 넘겨도 카운터가 따라온다", () => {
      renderWithMotion(<Gallery />);

      scrollTrackTo(4);

      expect(counter()).toHaveTextContent(`5 / ${INVITE.gallery.length}`);
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

      expect(counter()).toHaveTextContent(`${INVITE.gallery.length} / ${INVITE.gallery.length}`);
      expect(next()).toBeDisabled();
      expect(prev()).toBeEnabled();
    });
  });

  describe("스크린리더 알림", () => {
    it("스크롤이 멎기 전에는 지나가는 번호를 읽지 않는다", () => {
      vi.useFakeTimers();
      renderWithMotion(<Gallery />);

      scrollTrackTo(3);
      scrollTrackTo(7);

      expect(liveRegion()).toHaveTextContent(`${INVITE.gallery.length}장 중 1번째`);
    });

    it("멎고 나면 마지막 자리 하나만 알린다", () => {
      vi.useFakeTimers();
      renderWithMotion(<Gallery />);

      scrollTrackTo(3);
      scrollTrackTo(7);
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(liveRegion()).toHaveTextContent(`${INVITE.gallery.length}장 중 8번째`);
    });

    it("눈으로 보는 카운터는 읽히지 않는다 — 같은 내용을 두 번 듣게 된다", () => {
      renderWithMotion(<Gallery />);

      expect(counter()).toHaveAttribute("aria-hidden", "true");
    });
  });

  it("스크롤 영역을 키보드로도 다룰 수 있다", () => {
    renderWithMotion(<Gallery />);

    expect(screen.getByRole("group", { name: "웨딩 사진 갤러리" })).toHaveAttribute("tabindex", "0");
  });
});
