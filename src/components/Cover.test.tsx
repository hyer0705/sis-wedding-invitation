import { describe, expect, it } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithMotion } from "../test/renderWithMotion";
import Cover from "./Cover";
import { INVITE } from "../invite";

describe("Cover", () => {
  it("CV-01 신랑·신부 이름과 예식 일시·예식장을 INVITE에서 가져온다", () => {
    renderWithMotion(<Cover />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(`${INVITE.groom.name} & ${INVITE.bride.name}`);
    expect(screen.getByText(INVITE.dateDots)).toBeInTheDocument();
    // 요일·시각과 예식장이 <br>로 이어진 한 덩어리라 부분 일치로 찾는다.
    expect(screen.getByText(INVITE.dayText, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(`${INVITE.venue} ${INVITE.hall}`, { exact: false })).toBeInTheDocument();
  });

  it("이름은 국문만 쓴다 — 영문 이름 표기가 없다", () => {
    // 장식용 영문(The wedding of)은 c안 디자인 요소라 남기되, 이름의 영문 표기는
    // 미사용으로 확정됐다(2026-08-04). 라틴 문자로 된 이름이 섞이면 안 된다.
    renderWithMotion(<Cover />);

    expect(screen.getByText("The wedding of")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 }).textContent).not.toMatch(/[A-Za-z]/);
  });

  it("커버 이미지에 설명이 붙고 LCP 우선순위가 지정된다", () => {
    renderWithMotion(<Cover />);

    const image = screen.getByRole("img");
    expect(image).toHaveAccessibleName(expect.stringContaining(INVITE.bride.name));
    expect(image).toHaveAttribute("fetchpriority", "high");
  });

  it("화면 폭에 맞춰 480w·960w 중 하나를 고르게 한다", () => {
    renderWithMotion(<Cover />);

    const image = screen.getByRole("img");
    expect(image).toHaveAttribute("srcset", expect.stringContaining("480w"));
    expect(image).toHaveAttribute("srcset", expect.stringContaining("960w"));
    expect(image).toHaveAttribute("sizes");
  });

  describe("SIS-29 스켈레톤", () => {
    const frame = () => screen.getByTestId("cover-frame");
    const photo = () => screen.getByRole("img");

    it("사진이 오기 전에는 아치에 면과 광택을 깐다", () => {
      renderWithMotion(<Cover />);

      expect(frame()).toHaveClass("skeleton");
      expect(frame()).not.toHaveClass("is-loaded");
      expect(photo()).toHaveClass("image-pending");
    });

    it("사진이 도착하면 광택을 걷고 사진을 드러낸다", () => {
      renderWithMotion(<Cover />);

      fireEvent.load(photo());

      // 면은 그대로 둔다 — 사진이 cover 로 덮으므로 페이드가 도는 동안의 뒷배경이 된다.
      expect(frame()).toHaveClass("is-loaded");
      expect(photo()).not.toHaveClass("image-pending");
    });

    it("사진을 못 받아도 기다리기를 그만둔다", () => {
      // 빈 아치 위로 광택만 끝없이 돌고 대체 텍스트도 안 보이는 상태를 막는다.
      renderWithMotion(<Cover />);

      fireEvent.error(photo());

      expect(frame()).toHaveClass("is-loaded");
      expect(photo()).not.toHaveClass("image-pending");
    });

    it("로딩 화면이 걷힐 때까지 사진이 안 왔으면 페이드로 얹는다", () => {
      // 상한(4초)에 걸려 걷힌 경우다. 하객이 이미 빈 아치를 보고 있으므로 사진이
      // 뒤늦게 들어올 때 부드럽게 얹혀야 한다.
      renderWithMotion(<Cover coverReady />);

      expect(photo()).toHaveClass("image-fade");
    });

    it("사진이 먼저 온 정상 경로에는 페이드를 걸지 않는다", () => {
      // SIS-17 이 커버의 opacity 0→1 을 걷어낸 자리다. 무조건 걸면 로딩 화면에 가려진
      // 채 흘러가 회선마다 걷히는 모습이 달라지는 이중 연출이 되살아난다.
      const { rerender } = renderWithMotion(<Cover coverReady={false} />);

      fireEvent.load(photo());
      rerender(<Cover coverReady />);

      expect(photo()).not.toHaveClass("image-fade");
    });
  });

  it("모션을 줄인 설정에서는 패럴랙스를 걸지 않는다", () => {
    // renderWithMotion은 MotionConfig reducedMotion="always"로 렌더한다.
    renderWithMotion(<Cover />);

    const image = screen.getByRole("img");
    expect(image.style.transform === "" || image.style.transform === "none").toBe(true);
  });
});
