import { afterEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMotion } from "../test/renderWithMotion";
import { TextSizeButton, TextSizeToggle } from "./TextSize";
import { LARGE_SCALE, setLargeText } from "../lib/textSize";

afterEach(() => {
  localStorage.clear();
  setLargeText(false);
});

const scale = () => document.documentElement.style.getPropertyValue("--type-scale");

describe("TextSize", () => {
  it("커버 버튼을 누르면 글자 배율이 올라간다", async () => {
    renderWithMotion(<TextSizeButton />);

    await userEvent.click(screen.getByRole("button", { name: "큰 글씨로 보기" }));

    expect(scale()).toBe(String(LARGE_SCALE));
  });

  it("다시 누르면 원래 크기로 돌아온다", async () => {
    renderWithMotion(<TextSizeButton />);

    await userEvent.click(screen.getByRole("button", { name: "큰 글씨로 보기" }));
    await userEvent.click(screen.getByRole("button", { name: "원래 글씨로 보기" }));

    expect(scale()).toBe("1");
  });

  it("버튼 둘이 같은 상태를 본다", async () => {
    // 커버 아래 버튼과 우상단 고정 버튼이 따로 놀면, 한쪽으로 켠 하객이 다른 쪽을
    // 껐다고 생각하고 다시 누르게 된다.
    renderWithMotion(
      <>
        <TextSizeButton />
        <TextSizeToggle />
      </>,
    );

    await userEvent.click(screen.getAllByRole("button", { name: "큰 글씨로 보기" })[0]);

    for (const button of screen.getAllByRole("button", { name: "원래 글씨로 보기" })) {
      expect(button).toHaveAttribute("aria-pressed", "true");
    }
  });

  it("켜고 끈 상태가 다음 방문까지 남는다", async () => {
    renderWithMotion(<TextSizeButton />);

    await userEvent.click(screen.getByRole("button", { name: "큰 글씨로 보기" }));

    expect(localStorage.getItem("sis-text-scale")).toBe("large");
  });
});
