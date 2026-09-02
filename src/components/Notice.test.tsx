import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithMotion } from "../test/renderWithMotion";
import Notice from "./Notice";

const WREATH = "화환은 보내주지 않으셔도 됩니다\n축하해 주시는 마음만으로 충분합니다";

let notices: readonly string[] = [WREATH];

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

const flat = (text: string) => text.replace(/\s+/g, " ").trim();

beforeEach(() => {
  notices = [WREATH];
});

describe("Notice", () => {
  it("NT-01 안내 문구를 보여 준다", () => {
    renderWithMotion(<Notice />);

    expect(screen.getByText(flat(WREATH))).toBeInTheDocument();
  });

  it("NT-01 고객이 지정한 줄바꿈을 눌러 없애지 않는다", () => {
    renderWithMotion(<Notice />);

    expect(screen.getByText(flat(WREATH))).toHaveStyle({ whiteSpace: "pre-line" });
  });

  it("NT-01 여러 안내를 각각 한 문단으로 세운다", () => {
    notices = [WREATH, "예식 30분 전부터 입장하실 수 있습니다"];
    renderWithMotion(<Notice />);

    expect(screen.getByText(flat(WREATH))).toBeInTheDocument();
    expect(screen.getByText("예식 30분 전부터 입장하실 수 있습니다")).toBeInTheDocument();
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
