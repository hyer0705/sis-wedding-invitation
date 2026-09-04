import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMotion } from "../test/renderWithMotion";
import Bgm from "./Bgm";

function mockPlayback() {
  const play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const pause = vi.fn();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pause);
  return { play, pause };
}

function mockBlockedPlayback() {
  const play = vi.fn<() => Promise<void>>().mockRejectedValue(new DOMException("blocked", "NotAllowedError"));
  const pause = vi.fn();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pause);
  return { play, pause };
}

function audio() {
  return screen.getByTestId("bgm-audio") as HTMLAudioElement;
}

function toggle() {
  return screen.getByRole("button", { name: "배경음악" });
}

function touchScreen() {
  fireEvent.pointerDown(document.body);
  fireEvent.touchStart(document.body);
}

function liftFinger() {
  fireEvent.touchEnd(document.body);
}

describe("Bgm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("켜진 상태로 시작하고 곧바로 재생을 시도한다", async () => {
    const { play } = mockPlayback();
    renderWithMotion(<Bgm />);

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    expect(audio().muted).toBe(false);
    expect(audio()).toHaveAttribute("loop");
    expect(audio()).toHaveAttribute("preload", "none");
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
  });

  it("브라우저가 자동재생을 막으면 켜진 채로 첫 터치를 기다린다", async () => {
    const { play } = mockBlockedPlayback();
    renderWithMotion(<Bgm />);

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    expect(toggle()).toHaveAttribute("aria-pressed", "true");

    play.mockResolvedValue(undefined);
    touchScreen();

    await waitFor(() => expect(audio().muted).toBe(false));
    expect(play.mock.calls.length).toBeGreaterThan(1);
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
  });

  it("iOS 처럼 손가락이 닿는 순간 거절당해도 끄지 않고 손을 뗄 때 다시 시도한다", async () => {
    const { play } = mockBlockedPlayback();
    renderWithMotion(<Bgm />);
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));

    touchScreen();
    await waitFor(() => expect(play.mock.calls.length).toBeGreaterThan(1));
    expect(toggle()).toHaveAttribute("aria-pressed", "true");

    play.mockResolvedValue(undefined);
    liftFinger();

    await waitFor(() => expect(audio().muted).toBe(false));
    expect(toggle()).toHaveAttribute("aria-pressed", "true");
  });

  it("손을 뗄 때까지 막혀 있으면 꺼진 모양으로 되돌아간다", async () => {
    const { play } = mockBlockedPlayback();
    renderWithMotion(<Bgm />);

    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));
    touchScreen();
    liftFinger();

    await waitFor(() => expect(toggle()).toHaveAttribute("aria-pressed", "false"));
    expect(audio().muted).toBe(true);
  });

  it("재생을 기다리는 동안 토글을 누르면 꺼진다", async () => {
    const { play } = mockBlockedPlayback();
    renderWithMotion(<Bgm />);
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));

    await userEvent.click(toggle());

    await waitFor(() => expect(toggle()).toHaveAttribute("aria-pressed", "false"));
    expect(audio().muted).toBe(true);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("토글을 누르면 멎고 음소거로 돌아간다", async () => {
    const { play, pause } = mockPlayback();
    renderWithMotion(<Bgm />);
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));

    await userEvent.click(toggle());

    await waitFor(() => expect(toggle()).toHaveAttribute("aria-pressed", "false"));
    expect(pause).toHaveBeenCalled();
    expect(audio().muted).toBe(true);
  });

  it("끈 뒤에는 화면을 터치해도 다시 켜지지 않는다", async () => {
    const { play } = mockPlayback();
    renderWithMotion(<Bgm />);
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));

    await userEvent.click(toggle());
    await waitFor(() => expect(toggle()).toHaveAttribute("aria-pressed", "false"));

    const callsAfterOff = play.mock.calls.length;
    touchScreen();
    liftFinger();

    await waitFor(() => expect(toggle()).toHaveAttribute("aria-pressed", "false"));
    expect(play).toHaveBeenCalledTimes(callsAfterOff);
    expect(audio().muted).toBe(true);
  });

  it("끈 뒤 다시 누르면 재생된다", async () => {
    const { play } = mockPlayback();
    renderWithMotion(<Bgm />);
    await waitFor(() => expect(play).toHaveBeenCalledTimes(1));

    await userEvent.click(toggle());
    await waitFor(() => expect(toggle()).toHaveAttribute("aria-pressed", "false"));
    await userEvent.click(toggle());

    await waitFor(() => expect(toggle()).toHaveAttribute("aria-pressed", "true"));
    expect(audio().muted).toBe(false);
  });
});
