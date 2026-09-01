import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithMotion } from "../test/renderWithMotion";
import Reveal from "./Reveal";
import Invitation from "./Invitation";
import Calendar from "./Calendar";
import Gallery from "./Gallery";
import Location from "./Location";
import Rsvp from "./rsvp/Rsvp";
import Share from "./Share";
import Footer from "./Footer";

describe("Reveal", () => {
  // 모든 섹션이 이 래퍼를 거치므로, 애니메이션 때문에 콘텐츠가 가려지지 않는지 먼저 보장한다
  it("자식 콘텐츠를 렌더한다", () => {
    renderWithMotion(
      <Reveal>
        <p>초대합니다</p>
      </Reveal>,
    );
    expect(screen.getByText("초대합니다")).toBeInTheDocument();
  });

  // CM-03 점검 — 섹션이 늘 때 이 래퍼를 빠뜨리면 그 섹션만 스크롤 리빌 없이 튀어나온다.
  // 화면이 어긋나는 게 아니라 움직임만 빠지는 것이라 눈으로는 잘 걸러지지 않는다.
  //
  // 커버는 제외한다. 첫 화면이라 스크롤로 들어오는 일이 없고 자체 페이드를 쓴다.
  // 마음 전하실 곳도 여기 없다 — 계좌가 없으면 섹션째 사라지는 설계라 INVITE 를 갈아
  // 끼워야 렌더된다. 같은 검사가 Accounts.test.tsx 에 있다.
  describe.each([
    ["초대글", Invitation],
    ["Calendar", Calendar],
    ["갤러리", Gallery],
    ["오시는 길", Location],
    ["RSVP", Rsvp],
    ["공유", Share],
    ["푸터", Footer],
  ])("%s 섹션", (_name, Section) => {
    it("Reveal 래퍼를 거친다", () => {
      const { container } = renderWithMotion(<Section />);

      expect(container.firstElementChild?.tagName).toBe("SECTION");
    });
  });
});
