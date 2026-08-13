import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMotion } from "../test/renderWithMotion";
import Share from "./Share";

// SH-01·SH-02 의 화면 쪽. 공유 사슬 자체는 src/lib/share.test.ts 가 덮으므로,
// 여기서는 "어느 버튼이 무엇을 부르고, 결과에 따라 무엇을 알리는가"만 본다.

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
    // 버튼을 누른 뒤에야 27KB 를 받기 시작하면 하객이 빈손으로 기다리고, PC 에서는
    // 사용자 조작 창이 지나 팝업이 막힌다 — 예외가 없어 폴백도 타지 않는다(SIS-18).
    // 셋업의 IntersectionObserver 가 관측 즉시 "들어왔다"고 알리므로 렌더만으로 걸린다.
    renderWithMotion(<Share />);

    expect(loadKakaoSdk).toHaveBeenCalledTimes(1);
  });

  it("공유 버튼 두 개를 보여준다", () => {
    renderWithMotion(<Share />);

    expect(screen.getByRole("button", { name: "카카오톡으로 공유" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "링크 복사" })).toBeInTheDocument();
  });

  it("카카오톡 버튼이 카카오 공유를 부른다", async () => {
    renderWithMotion(<Share />);
    await userEvent.click(screen.getByRole("button", { name: "카카오톡으로 공유" }));

    expect(shareKakao).toHaveBeenCalledTimes(1);
    expect(copyLink).not.toHaveBeenCalled();
  });

  it("카톡 창이 뜨면 토스트를 띄우지 않는다", async () => {
    // 화면이 눈에 띄게 바뀌므로 알림이 군더더기가 된다.
    renderWithMotion(<Share />);
    await userEvent.click(screen.getByRole("button", { name: "카카오톡으로 공유" }));

    await waitFor(() => expect(shareKakao).toHaveBeenCalled());
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("링크 복사가 성공하면 복사되었다고 알린다", async () => {
    // 복사는 화면이 그대로라 알리지 않으면 눌렸는지조차 알 수 없다.
    renderWithMotion(<Share />);
    await userEvent.click(screen.getByRole("button", { name: "링크 복사" }));

    expect(copyLink).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("청첩장 주소가 복사되었습니다"));
  });

  it("복사가 막히면 길게 누르라고 안내한다", async () => {
    // 카카오톡 인앱 브라우저에서 클립보드가 모두 막힌 경우다.
    copyLink.mockResolvedValue("failed");
    renderWithMotion(<Share />);
    await userEvent.click(screen.getByRole("button", { name: "링크 복사" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("길게 눌러 복사해 주세요"));
  });

  it("공유가 예외로 터져도 버튼이 조용히 죽지 않는다", async () => {
    // 공유 사슬은 제 안에서 폴백을 다 처리하지만, 그 바깥으로 예외가 새면 여기서
    // 받아야 한다. 아무 반응이 없으면 하객에게는 고장과 구분되지 않는다.
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
