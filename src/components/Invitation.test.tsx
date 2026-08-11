import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithMotion } from "../test/renderWithMotion";
import Invitation from "./Invitation";
import { INVITE } from "../invite";

// Testing Library 의 기본 normalizer 는 연속 공백과 개행을 공백 하나로 합친다.
// 문구에 고객이 지정한 \n 이 들어 있으므로 찾을 때도 같은 모양으로 눌러 준다.
const flat = (text: string) => text.replace(/\s+/g, " ").trim();

/** 혼주 줄은 `성함` + `<span>의 장남</span>` + `이름` 으로 쪼개져 있어 통째로는 못 찾는다. */
const parentLine = (relation: string) => screen.getByText(`의 ${relation}`).parentElement;

describe("Invitation", () => {
  it("IN-01 인사말 네 문단을 접지 않고 모두 보여 준다", () => {
    renderWithMotion(<Invitation />);

    for (const paragraph of INVITE.greeting.body) {
      expect(screen.getByText(flat(paragraph))).toBeInTheDocument();
    }
  });

  it("IN-01 「더보기」 버튼을 두지 않는다", () => {
    // c안에는 뒷문단을 감추는 버튼이 있었으나 두지 않기로 확정했다(2026-08-11).
    // 되살아나면 하객 일부가 인사말 뒷부분을 보지 못한 채 지나간다.
    renderWithMotion(<Invitation />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("IN-01 고객이 지정한 줄바꿈을 눌러 없애지 않는다", () => {
    renderWithMotion(<Invitation />);

    // pre-line 이 빠지면 문단 안의 \n 이 공백으로 뭉개져 줄바꿈 위치가 통째로 사라진다.
    expect(screen.getByText(flat(INVITE.greeting.body[0]))).toHaveStyle({ whiteSpace: "pre-line" });
  });

  it("IN-02 인용 문구와 출처를 보여 준다", () => {
    renderWithMotion(<Invitation />);

    for (const stanza of INVITE.greeting.quote) {
      expect(screen.getByText(flat(stanza))).toBeInTheDocument();
    }
    expect(screen.getByText(`— ${INVITE.greeting.quoteAuthor} —`)).toBeInTheDocument();
  });

  it("IN-03 양가 혼주와 자녀 관계를 표기한다", () => {
    renderWithMotion(<Invitation />);

    expect(parentLine(INVITE.groom.relation)).toHaveTextContent(INVITE.groom.first);
    expect(parentLine(INVITE.bride.relation)).toHaveTextContent(INVITE.bride.first);
  });

  it("IN-03 신랑측 혼주를 한 분만 표기한다", () => {
    // 신랑 어머니는 표기하지 않기로 고객이 확정했다(2026-08-11). 폴백 mock 이 되살아나면
    // 가짜 성함이 하객에게 그대로 보인다. 가운뎃점은 두 분 이상일 때만 생기므로,
    // 그것이 없다는 것이 곧 한 분만 나왔다는 뜻이다.
    renderWithMotion(<Invitation />);

    expect(parentLine(INVITE.groom.relation)).not.toHaveTextContent("·");
  });

  it("IN-04 고인인 혼주 성함 앞에 故 를 붙인다", () => {
    renderWithMotion(<Invitation />);

    expect(parentLine(INVITE.bride.relation)).toHaveTextContent("故");
  });
});
