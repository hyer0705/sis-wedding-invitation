import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMotion } from "../test/renderWithMotion";
import { TextSizeBar } from "./TextSize";
import { setLargeText } from "../lib/textSize";
import { LARGE_SCALE } from "../lib/typeScale";

afterEach(() => {
  localStorage.clear();
  setLargeText(false);
});

const scale = () => document.documentElement.style.getPropertyValue("--type-scale");

describe("TextSizeBar", () => {
  it("누르면 글자 배율이 올라간다", async () => {
    renderWithMotion(<TextSizeBar />);

    await userEvent.click(screen.getByRole("button", { name: /글씨 크게 보기/ }));

    expect(scale()).toBe(String(LARGE_SCALE));
  });

  it("다시 누르면 원래 크기로 돌아온다", async () => {
    renderWithMotion(<TextSizeBar />);

    await userEvent.click(screen.getByRole("button", { name: /글씨 크게 보기/ }));
    await userEvent.click(screen.getByRole("button", { name: /글씨 원래대로/ }));

    expect(scale()).toBe("1");
  });

  it("켜진 상태를 문구와 aria-pressed 로 함께 알린다", async () => {
    renderWithMotion(<TextSizeBar />);

    const button = screen.getByRole("button", { name: /글씨 크게 보기/ });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(button);

    expect(screen.getByRole("button", { name: /글씨 원래대로/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("켜고 끈 상태가 다음 방문까지 남는다", async () => {
    renderWithMotion(<TextSizeBar />);

    await userEvent.click(screen.getByRole("button", { name: /글씨 크게 보기/ }));

    expect(localStorage.getItem("sis-text-scale")).toBe("large");
  });
});
