import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithMotion } from "../test/renderWithMotion";
import Invitation from "./Invitation";
import { INVITE } from "../invite";

const flat = (text: string) => text.replace(/\s+/g, " ").trim();

const parentLine = (relation: string) => screen.getByText(`의 ${relation}`).parentElement;

const parentNames = (relation: string) => {
  const names = screen.getByText(`의 ${relation}`).previousElementSibling;
  return Array.from(names?.children ?? []);
};

describe("Invitation", () => {
  it("IN-01 인사말 네 문단을 접지 않고 모두 보여 준다", () => {
    renderWithMotion(<Invitation />);

    for (const paragraph of INVITE.greeting.body) {
      expect(screen.getByText(flat(paragraph))).toBeInTheDocument();
    }
  });

  it("IN-01 「더보기」 버튼을 두지 않는다", () => {
    renderWithMotion(<Invitation />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("IN-01 고객이 지정한 줄바꿈을 눌러 없애지 않는다", () => {
    renderWithMotion(<Invitation />);

    expect(screen.getByText(flat(INVITE.greeting.body[0]))).toHaveStyle({ whiteSpace: "pre-line" });
  });

  it("IN-02 인용 시를 두지 않는다", () => {
    const { container } = renderWithMotion(<Invitation />);

    expect(container.querySelector("blockquote")).toBeNull();
    expect(container.querySelector("cite")).toBeNull();
  });

  it("IN-03 양가 혼주와 자녀 관계를 표기한다", () => {
    renderWithMotion(<Invitation />);

    expect(parentLine(INVITE.groom.relation)).toHaveTextContent(INVITE.groom.first);
    expect(parentLine(INVITE.bride.relation)).toHaveTextContent(INVITE.bride.first);
  });

  it("IN-03 신랑측 혼주를 한 분만 표기한다", () => {
    renderWithMotion(<Invitation />);

    expect(parentNames(INVITE.groom.relation)).toHaveLength(1);
  });

  it("IN-03 혼주 두 분은 한 분에 한 줄씩 세운다", () => {
    renderWithMotion(<Invitation />);

    expect(parentNames(INVITE.bride.relation)).toHaveLength(INVITE.bride.parents.length);
  });

  it("IN-04 고인인 혼주 성함 앞에 故 를 붙인다", () => {
    renderWithMotion(<Invitation />);

    expect(parentLine(INVITE.bride.relation)).toHaveTextContent("故");
  });
});
