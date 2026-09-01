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
  it("자식 콘텐츠를 렌더한다", () => {
    renderWithMotion(
      <Reveal>
        <p>초대합니다</p>
      </Reveal>,
    );
    expect(screen.getByText("초대합니다")).toBeInTheDocument();
  });

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
