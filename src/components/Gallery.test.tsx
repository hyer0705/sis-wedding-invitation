import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMotion } from "../test/renderWithMotion";
import Gallery from "./Gallery";
import { INVITE } from "../invite";

// 슬라이드 하나가 차지하는 가로 폭. 실제 값(기기마다 다르다)이 아니라, 목적지가
// 이 간격의 배수로 계산되는지만 보면 되므로 아무 수나 쓴다.
const STEP = 300;

// jsdom 에는 Element.scrollTo 가 없다. 호출과 인자를 기록하는 스텁을 끼운다.
const scrollTo = vi.fn();
const originalOffsetLeft = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetLeft");

beforeEach(() => {
  scrollTo.mockClear();
  Element.prototype.scrollTo = scrollTo;

  // jsdom 은 레이아웃을 계산하지 않아 offsetLeft 가 전부 0이다. 그대로 두면 슬라이드
  // 간격이 0이 되고 목적지가 늘 0으로 접혀, 계산이 망가져도 테스트가 통과한다.
  // 트랙의 자식에만 간격을 흉내 내 준다.
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

/** 스크롤러를 실제로 옮기고 브라우저처럼 scroll 이벤트를 흘린다. */
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
    // 첫 장에서는 자기 자신과 옆에 걸쳐 보이는 다음 장까지.
    expect(images[0]).toHaveAttribute("loading", "eager");
    expect(images[1]).toHaveAttribute("loading", "eager");
    for (const image of images.slice(2)) {
      expect(image).toHaveAttribute("loading", "lazy");
    }
  });

  // GL-04 받는 순위(fetchPriority)는 갤러리가 화면에 들어왔는지에 매여 있다. 여기
  // 셋업의 IntersectionObserver 는 관측 즉시 "들어왔다"고 알리고, Motion 은 관찰자를
  // 옵션별로 캐싱해 테스트 안에서 갈아끼워도 먹지 않는다 — 진짜 스크롤이 필요하므로
  // e2e/smoke.spec.ts 의 「커버가 받을 동안 사진이 순서를 양보한다」가 이 동작을 덮는다.

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
      // 상시로 깔면 사진이 contain 이라 가로 사진 위아래에 띠가 남고, c안의 "사진만
      // 떠 있는" 인상이 무너진다. 2026-08-11 에 그렇게 했다가 되돌렸다.
      renderWithMotion(<Gallery />);
      const images = screen.getAllByRole("img");

      fireEvent.load(images[0]);

      expect(slots()[0]).not.toHaveClass("skeleton");
      expect(slots()[1]).toHaveClass("skeleton");
      expect(images[0]).not.toHaveClass("image-pending");
      expect(images[1]).toHaveClass("image-pending");
    });

    it("도착한 사진은 페이드로 얹는다", () => {
      // 갤러리는 늘 로딩 화면이 걷힌 뒤에 받으므로 커버와 달리 조건을 따지지 않는다.
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
      // 호출 여부만 보면 목적지가 늘 0으로 접혀도 통과한다. 자리까지 고정한다.
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
      // 부드러운 스크롤이 끝나기 전에 다음 탭이 들어오는 상황. 애니메이션 도중의
      // scroll 이벤트가 번호를 되돌려 놓으면 두 번 눌러도 한 장만 넘어갔었다.
      const user = userEvent.setup();
      renderWithMotion(<Gallery />);

      await user.click(next());
      scrollTrackTo(0.3); // 아직 첫 장 근처를 지나는 중
      await user.click(next());

      expect(counter()).toHaveTextContent(`3 / ${INVITE.gallery.length}`);
      expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ left: STEP * 2 }));
    });

    it("손으로 붙잡으면 그 자리를 현재로 삼는다", async () => {
      // 화살표로 가던 도중 손을 대면 목적지를 놓아야 한다. 놓지 않으면 잠금이 풀리지
      // 않아 이후 스와이프가 번호에 반영되지 않는다.
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
      // 번호가 바뀔 때마다 알리면 한 번 훑는 동안 지나간 번호가 polite 큐에 쌓여,
      // 손을 뗀 뒤에도 한참을 계속 읽는다.
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
    // axe scrollable-region-focusable(serious). 안에 초점을 받을 요소가 없어
    // 트랙이 직접 초점을 받아야 좌우 키로 넘길 수 있다.
    renderWithMotion(<Gallery />);

    expect(screen.getByRole("group", { name: "웨딩 사진 갤러리" })).toHaveAttribute("tabindex", "0");
  });
});
