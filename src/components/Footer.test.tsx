import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithMotion } from "../test/renderWithMotion";
import Footer from "./Footer";
import { INVITE } from "../invite";
import { SCALE_VAR } from "../lib/typeScale";

const basePx = (el: HTMLElement) => parseFloat(el.style.fontSize.replace("calc(", ""));

describe("Footer", () => {
  it("신랑·신부 이름과 예식일 아래에 제작자 저작권을 남긴다", () => {
    renderWithMotion(<Footer />);

    expect(screen.getByText(`${INVITE.groom.name} · ${INVITE.bride.name}`)).toBeInTheDocument();
    expect(screen.getByText("© 2026 Lucyground")).toBeInTheDocument();
  });

  it("저작권 줄이 신랑·신부 이름보다 작다", () => {
    renderWithMotion(<Footer />);

    const names = screen.getByText(`${INVITE.groom.name} · ${INVITE.bride.name}`);
    const copyright = screen.getByText("© 2026 Lucyground");

    expect(basePx(copyright)).toBeLessThan(basePx(names));
  });

  it("저작권 줄이 큰 글씨로 보기의 배율을 탄다", () => {
    renderWithMotion(<Footer />);

    expect(screen.getByText("© 2026 Lucyground").style.fontSize).toContain(`var(${SCALE_VAR})`);
  });
});
