import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithMotion } from "../test/renderWithMotion";
import Reveal from "./Reveal";

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
});
