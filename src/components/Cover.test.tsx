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
    expect(screen.getByText(INVITE.dayText, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(`${INVITE.venue} ${INVITE.hall}`, { exact: false })).toBeInTheDocument();
  });

  it("이름은 국문만 쓴다 — 영문 이름 표기가 없다", () => {
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

    const markComplete = () => Object.defineProperty(photo(), "complete", { configurable: true, value: true });

    const arrive = () => {
      markComplete();
      fireEvent.load(photo());
    };

    it("사진이 오기 전에는 아치에 면과 광택을 깐다", () => {
      renderWithMotion(<Cover />);

      expect(frame()).toHaveClass("skeleton");
      expect(frame()).not.toHaveClass("is-loaded");
      expect(photo()).toHaveClass("image-pending");
    });

    it("사진이 도착하면 광택을 걷고 사진을 드러낸다", () => {
      renderWithMotion(<Cover />);

      fireEvent.load(photo());

      expect(frame()).toHaveClass("is-loaded");
      expect(photo()).not.toHaveClass("image-pending");
    });

    it("사진을 못 받아도 기다리기를 그만둔다", () => {
      renderWithMotion(<Cover />);

      fireEvent.error(photo());

      expect(frame()).toHaveClass("is-loaded");
      expect(photo()).not.toHaveClass("image-pending");
    });

    it("로딩 화면이 걷힐 때까지 사진이 안 왔으면 페이드로 얹는다", () => {
      renderWithMotion(<Cover coverReady />);

      expect(photo()).toHaveClass("image-fade");
    });

    it("사진이 먼저 온 정상 경로에는 페이드를 걸지 않는다", () => {
      const { rerender } = renderWithMotion(<Cover coverReady={false} />);

      arrive();
      rerender(<Cover coverReady />);

      expect(photo()).not.toHaveClass("image-fade");
    });

    it("사진이 이미 도착했다면 load 이벤트가 늦어도 페이드를 걸지 않는다", () => {
      const { rerender } = renderWithMotion(<Cover coverReady={false} />);

      markComplete();
      rerender(<Cover coverReady />);

      expect(photo()).not.toHaveClass("image-fade");
    });
  });

  it("모션을 줄인 설정에서는 패럴랙스를 걸지 않는다", () => {
    renderWithMotion(<Cover />);

    const image = screen.getByRole("img");
    expect(image.style.transform === "" || image.style.transform === "none").toBe(true);
  });
});
