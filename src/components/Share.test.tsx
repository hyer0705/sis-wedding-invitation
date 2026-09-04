import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMotion } from "../test/renderWithMotion";
import Share from "./Share";

const shareKakao = vi.fn();
const copyLink = vi.fn();
const loadKakaoSdk = vi.fn();

vi.mock("../lib/share", () => ({
  shareKakao: () => shareKakao(),
  copyLink: () => copyLink(),
  loadKakaoSdk: () => loadKakaoSdk(),
}));

beforeEach(() => {
  shareKakao.mockResolvedValue("kakao");
  copyLink.mockResolvedValue("copied");
  loadKakaoSdk.mockResolvedValue(true);
});

describe("Share", () => {
  it("섹션이 화면에 들어오면 공유 SDK 를 미리 받는다", () => {
    renderWithMotion(<Share />);

    expect(loadKakaoSdk).toHaveBeenCalledTimes(1);
  });

  it("공유 버튼 두 개를 보여준다", () => {
    renderWithMotion(<Share />);

    expect(screen.getByRole("button", { name: "카카오톡으로 공유" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "링크 복사" })).toBeInTheDocument();
  });

  it("두 버튼 모두 페이지 배경과 갈리는 윤곽을 갖는다", () => {
    renderWithMotion(<Share />);

    const kakao = screen.getByRole("button", { name: "카카오톡으로 공유" });
    const link = screen.getByRole("button", { name: "링크 복사" });

    expect(kakao.style.background).toBe("var(--primary)");
    expect(kakao.style.color).toBe("var(--on-primary)");
    expect(kakao.style.border).toBe("1px solid var(--primary)");

    expect(link.style.background).toBe("var(--surface-2)");
    expect(link.style.color).toBe("var(--on-surface)");
    expect(link.style.border).toBe("1px solid var(--primary)");
  });

  it("카카오톡 버튼이 카카오 공유를 부른다", async () => {
    renderWithMotion(<Share />);
    await userEvent.click(screen.getByRole("button", { name: "카카오톡으로 공유" }));

    expect(shareKakao).toHaveBeenCalledTimes(1);
    expect(copyLink).not.toHaveBeenCalled();
  });

  it("카톡 창이 뜨면 토스트를 띄우지 않는다", async () => {
    renderWithMotion(<Share />);
    await userEvent.click(screen.getByRole("button", { name: "카카오톡으로 공유" }));

    await waitFor(() => expect(shareKakao).toHaveBeenCalled());
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("링크 복사가 성공하면 복사되었다고 알린다", async () => {
    renderWithMotion(<Share />);
    await userEvent.click(screen.getByRole("button", { name: "링크 복사" }));

    expect(copyLink).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("청첩장 주소가 복사되었습니다"));
  });

  it("복사가 막히면 주소를 직접 복사하도록 안내한다", async () => {
    copyLink.mockResolvedValue("failed");
    renderWithMotion(<Share />);
    await userEvent.click(screen.getByRole("button", { name: "링크 복사" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("주소창의 주소를 복사해 주세요"));
  });

  it("공유가 예외로 터져도 버튼이 조용히 죽지 않는다", async () => {
    shareKakao.mockRejectedValue(new Error("예상 못한 실패"));
    renderWithMotion(<Share />);
    await userEvent.click(screen.getByRole("button", { name: "카카오톡으로 공유" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("공유에 실패했어요"));
  });

  it("공유 시트로 넘어간 경우에도 토스트를 띄우지 않는다", async () => {
    shareKakao.mockResolvedValue("shared");
    renderWithMotion(<Share />);
    await userEvent.click(screen.getByRole("button", { name: "카카오톡으로 공유" }));

    await waitFor(() => expect(shareKakao).toHaveBeenCalled());
    expect(screen.getByRole("status")).toHaveTextContent("");
  });
});
