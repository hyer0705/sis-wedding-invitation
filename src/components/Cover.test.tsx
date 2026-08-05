import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
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

  it("모션을 줄인 설정에서는 패럴랙스를 걸지 않는다", () => {
    // renderWithMotion은 MotionConfig reducedMotion="always"로 렌더한다.
    renderWithMotion(<Cover />);

    const image = screen.getByRole("img");
    expect(image.style.transform === "" || image.style.transform === "none").toBe(true);
  });
});
