import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

const originalClipboard = Object.getOwnPropertyDescriptor(globalThis.navigator, "clipboard");

function setClipboard(value: unknown) {
  Object.defineProperty(globalThis.navigator, "clipboard", { value, configurable: true });
}

afterEach(() => {
  if (originalClipboard) Object.defineProperty(globalThis.navigator, "clipboard", originalClipboard);
  else Reflect.deleteProperty(globalThis.navigator as unknown as Record<string, unknown>, "clipboard");
  Reflect.deleteProperty(document as unknown as Record<string, unknown>, "execCommand");
});

describe("copyText", () => {
  it("클립보드 API 가 있으면 그것으로 복사한다", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });

    await expect(copyText("서울시 구로구 새말로 97, 7F")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("서울시 구로구 새말로 97, 7F");
  });

  it("클립보드 API 가 거부되면 옛 방식으로 다시 시도한다", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) });
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });

    await expect(copyText("주소")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("클립보드 API 자체가 없어도 복사된다", async () => {
    setClipboard(undefined);
    Object.defineProperty(document, "execCommand", { value: vi.fn().mockReturnValue(true), configurable: true });

    await expect(copyText("주소")).resolves.toBe(true);
  });

  it("두 방법이 모두 실패하면 실패로 알린다", async () => {
    setClipboard(undefined);
    Object.defineProperty(document, "execCommand", { value: vi.fn().mockReturnValue(false), configurable: true });

    await expect(copyText("주소")).resolves.toBe(false);
  });

  it("복사에 쓴 임시 요소를 화면에 남기지 않는다", async () => {
    setClipboard(undefined);
    Object.defineProperty(document, "execCommand", { value: vi.fn().mockReturnValue(true), configurable: true });

    await copyText("주소");

    expect(document.querySelector("textarea")).toBeNull();
  });
});
