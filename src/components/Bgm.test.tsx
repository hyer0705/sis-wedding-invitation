import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
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

function audio() {
  return screen.getByTestId("bgm-audio") as HTMLAudioElement;
}

function toggle() {
  return screen.getByRole("button", { name: "배경음악" });
}

describe("Bgm", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("처음에는 음소거이고 자동재생을 시도하지 않는다", () => {
    const { play } = mockPlayback();
    renderWithMotion(<Bgm />);

    expect(audio().muted).toBe(true);
    expect(audio()).toHaveAttribute("loop");
    expect(audio()).toHaveAttribute("preload", "none");
    expect(play).not.toHaveBeenCalled();
    expect(toggle()).toHaveAttribute("aria-pressed", "false");
  });

  it("토글을 누르면 재생하고 aria-pressed 가 켜짐으로 바뀐다", async () => {
    const { play } = mockPlayback();
    renderWithMotion(<Bgm />);

    await userEvent.click(toggle());

    await waitFor(() => expect(toggle()).toHaveAttribute("aria-pressed", "true"));
    expect(play).toHaveBeenCalledTimes(1);
    expect(audio().muted).toBe(false);
  });

  it("다시 누르면 멈추고 음소거로 돌아간다", async () => {
    const { pause } = mockPlayback();
    renderWithMotion(<Bgm />);

    await userEvent.click(toggle());
    await waitFor(() => expect(toggle()).toHaveAttribute("aria-pressed", "true"));
    await userEvent.click(toggle());

    await waitFor(() => expect(toggle()).toHaveAttribute("aria-pressed", "false"));
    expect(pause).toHaveBeenCalled();
    expect(audio().muted).toBe(true);
  });

  it("재생이 시작되기를 기다리는 동안 다시 눌러도 끄기가 먹는다", async () => {
    let startPlayback = () => {};
    const play = vi.fn<() => Promise<void>>().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          startPlayback = resolve;
        }),
    );
    const pause = vi.fn();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pause);
    renderWithMotion(<Bgm />);

    await userEvent.click(toggle());
    await waitFor(() => expect(toggle()).toHaveAttribute("aria-pressed", "true"));

    await userEvent.click(toggle());
    startPlayback();

    await waitFor(() => expect(toggle()).toHaveAttribute("aria-pressed", "false"));
    expect(play).toHaveBeenCalledTimes(1);
    expect(pause).toHaveBeenCalled();
    expect(audio().muted).toBe(true);
  });

  it("브라우저가 재생을 거부하면 켜진 채로 남지 않는다", async () => {
    const play = vi.fn<() => Promise<void>>().mockRejectedValue(new DOMException("blocked", "NotAllowedError"));
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(vi.fn());
    renderWithMotion(<Bgm />);

    await userEvent.click(toggle());

    await waitFor(() => expect(audio().muted).toBe(true));
    expect(toggle()).toHaveAttribute("aria-pressed", "false");
  });
});
