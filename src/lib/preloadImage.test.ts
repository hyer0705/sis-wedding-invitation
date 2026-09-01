import { afterEach, describe, expect, it, vi } from "vitest";
import { preloadImage } from "./preloadImage";

class FakeImage {
  static last: FakeImage | undefined;

  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  complete = false;
  readonly assigned: string[] = [];

  #sizes = "";
  #srcset = "";
  #src = "";

  constructor() {
    FakeImage.last = this;
  }

  set sizes(value: string) {
    this.assigned.push("sizes");
    this.#sizes = value;
  }
  get sizes(): string {
    return this.#sizes;
  }

  set srcset(value: string) {
    this.assigned.push("srcset");
    this.#srcset = value;
  }
  get srcset(): string {
    return this.#srcset;
  }

  set src(value: string) {
    this.assigned.push("src");
    this.#src = value;
  }
  get src(): string {
    return this.#src;
  }
}

function stubImage(): void {
  FakeImage.last = undefined;
  vi.stubGlobal("Image", FakeImage);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("preloadImage", () => {
  it("이미지를 다 받으면 resolve 한다", async () => {
    stubImage();
    const pending = preloadImage("https://cdn.example.com/1_main-960.webp");

    FakeImage.last!.onload!();

    await expect(pending).resolves.toBeUndefined();
  });

  it("이미지를 못 받아도 reject 하지 않는다", async () => {
    stubImage();
    const pending = preloadImage("https://cdn.example.com/없는파일.webp");

    FakeImage.last!.onerror!();

    await expect(pending).resolves.toBeUndefined();
  });

  it("이미 받아 둔 이미지면 onload 없이도 resolve 한다", async () => {
    vi.stubGlobal(
      "Image",
      class extends FakeImage {
        override complete = true;
      },
    );

    await expect(preloadImage("https://cdn.example.com/1_main-960.webp")).resolves.toBeUndefined();
  });

  it("sizes·srcSet 을 src 보다 먼저 설정한다", async () => {
    stubImage();
    const pending = preloadImage(
      "https://cdn.example.com/1_main-960.webp",
      "https://cdn.example.com/1_main-480.webp 480w, https://cdn.example.com/1_main-960.webp 960w",
      "(max-width: 430px) calc(100vw - 52px), 378px",
    );
    FakeImage.last!.onload!();
    await pending;

    expect(FakeImage.last!.assigned).toEqual(["sizes", "srcset", "src"]);
  });

  it("srcSet·sizes 가 없으면 src 만 설정한다", async () => {
    stubImage();
    const pending = preloadImage("https://cdn.example.com/1_main-960.webp");
    FakeImage.last!.onload!();
    await pending;

    expect(FakeImage.last!.assigned).toEqual(["src"]);
  });

  it("DOM 이 없는 환경에서는 그대로 resolve 한다", async () => {
    vi.stubGlobal("Image", undefined);

    await expect(preloadImage("https://cdn.example.com/1_main-960.webp")).resolves.toBeUndefined();
  });
});
