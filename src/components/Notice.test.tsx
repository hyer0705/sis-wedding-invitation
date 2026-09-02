import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithMotion } from "../test/renderWithMotion";
import Notice from "./Notice";

const WREATH = [
  ["화환은 보내주지", "않으셔도 됩니다."],
  ["축하해 주시는", "마음만으로 충분합니다."],
];

let notices: readonly (readonly string[])[] = WREATH;

vi.mock("../invite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../invite")>();
  return {
    INVITE: {
      ...actual.INVITE,
      get notices() {
        return notices;
      },
    },
  };
});

const card = () => screen.getByTestId("notice");

const lineTexts = () => Array.from(card().querySelectorAll(".notice-line")).map((el) => el.textContent?.trim());

beforeEach(() => {
  notices = WREATH;
});

describe("Notice", () => {
  it("NT-01 안내 문구를 보여 준다", () => {
    renderWithMotion(<Notice />);

    for (const lines of WREATH) {
      expect(card()).toHaveTextContent(lines.join(" "));
    }
  });

  it("NT-01 작은 글씨에서는 한 문단이 이어서 흐른다", () => {
    renderWithMotion(<Notice />);

    const paragraphs = card().querySelectorAll("p");
    expect(paragraphs).toHaveLength(WREATH.length);
    expect(paragraphs[0].textContent).toBe("화환은 보내주지 않으셔도 됩니다.");
  });

  it("NT-01 큰 글씨에서 줄을 세울 수 있게 조각마다 표시를 남긴다", () => {
    renderWithMotion(<Notice />);

    expect(lineTexts()).toEqual(WREATH.flat());
  });

  it("NT-01 여러 안내를 각각 한 문단으로 세운다", () => {
    notices = [...WREATH, ["예식 30분 전부터 입장하실 수 있습니다"]];
    renderWithMotion(<Notice />);

    expect(card().querySelectorAll("p")).toHaveLength(3);
    expect(card()).toHaveTextContent("예식 30분 전부터 입장하실 수 있습니다");
  });

  it("NT-01 안내가 없으면 섹션 자체를 렌더하지 않는다", () => {
    notices = [];
    const { container } = renderWithMotion(<Notice />);

    expect(container).toBeEmptyDOMElement();
  });

  it("NT-01 영문 타이틀은 Notice 다", () => {
    renderWithMotion(<Notice />);

    expect(screen.getByText("Notice")).toHaveClass("script-title");
  });
});
