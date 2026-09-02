import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INVITE } from "../invite";

const R2 = "https://images.example.com";

async function loadShare(kakaoKey = "") {
  vi.resetModules();
  vi.stubEnv("VITE_KAKAO_JS_KEY", kakaoKey);
  vi.stubEnv("VITE_IMAGE_BASE_URL", R2);
  return import("./share");
}

type KakaoFeed = {
  objectType: string;
  content: { title: string; description: string; imageUrl: string; link: { mobileWebUrl: string; webUrl: string } };
  buttons: { title: string; link: { mobileWebUrl: string; webUrl: string } }[];
};

function stubKakao(options: { throws?: boolean; initThrows?: boolean } = {}) {
  const sendDefault = vi.fn<(settings: KakaoFeed) => void>(() => {
    if (options.throws) throw new Error("도메인이 등록되지 않았습니다");
  });
  const Kakao = {
    init: vi.fn(() => {
      if (options.initThrows) throw new Error("Invalid app key");
    }),
    isInitialized: vi.fn(() => false),
    Share: { sendDefault },
  };
  vi.stubGlobal("Kakao", Kakao);
  return { Kakao, sendDefault };
}

const SCRIPT_ID = "kakao-share-sdk";

async function settleSdkScript(ok: boolean) {
  await Promise.resolve();
  const script = document.getElementById(SCRIPT_ID);
  if (!script) throw new Error("SDK 스크립트가 붙지 않았다");
  script.dispatchEvent(new Event(ok ? "load" : "error"));
}

beforeEach(() => {
  vi.stubGlobal("Kakao", undefined);
  vi.stubGlobal("navigator", { clipboard: undefined, share: undefined });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  document.getElementById(SCRIPT_ID)?.remove();
});

describe("shareKakao", () => {
  it("SDK 와 키가 있으면 카카오 공유 카드를 띄운다", async () => {
    const { sendDefault } = stubKakao();
    const { shareKakao } = await loadShare("test-key");

    await expect(shareKakao()).resolves.toBe("kakao");
    expect(sendDefault).toHaveBeenCalledTimes(1);
  });

  it("카드에 INVITE.share 문구를 그대로 싣는다", async () => {
    const { sendDefault } = stubKakao();
    const { shareKakao } = await loadShare("test-key");
    await shareKakao();

    const settings = sendDefault.mock.calls[0][0];
    expect(settings.content.title).toBe(INVITE.share.title);
    expect(settings.content.description).toBe(INVITE.share.description);
    expect(settings.buttons[0].title).toBe(INVITE.share.buttonText);
  });

  it("썸네일이 이미지 베이스(R2)의 절대 URL 이다", async () => {
    const { sendDefault } = stubKakao();
    const { shareKakao } = await loadShare("test-key");
    await shareKakao();

    expect(sendDefault.mock.calls[0][0].content.imageUrl).toBe(`${R2}/og-image.jpg`);
  });

  it("링크가 프리뷰 주소가 아니라 INVITE.siteUrl 이다", async () => {
    const { sendDefault } = stubKakao();
    const { shareKakao } = await loadShare("test-key");
    await shareKakao();

    const settings = sendDefault.mock.calls[0][0];
    expect(settings.content.link.mobileWebUrl).toBe(INVITE.siteUrl);
    expect(settings.content.link.webUrl).toBe(INVITE.siteUrl);
    expect(settings.buttons[0].link.mobileWebUrl).toBe(INVITE.siteUrl);
  });

  it("키가 없으면 SDK 를 건드리지 않고 폴백한다", async () => {
    const { sendDefault } = stubKakao();
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share, clipboard: undefined });
    const { shareKakao } = await loadShare("");

    await expect(shareKakao()).resolves.toBe("shared");
    expect(sendDefault).not.toHaveBeenCalled();
  });

  it("SDK 를 받아 온 뒤 카카오 공유 카드를 띄운다", async () => {
    const { shareKakao } = await loadShare("test-key");
    const result = shareKakao();

    const { sendDefault } = stubKakao();
    await settleSdkScript(true);

    await expect(result).resolves.toBe("kakao");
    expect(sendDefault).toHaveBeenCalledTimes(1);
  });

  it("SDK 를 받지 못하면 폴백한다", async () => {
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share, clipboard: undefined });
    const { shareKakao } = await loadShare("test-key");
    const result = shareKakao();

    await settleSdkScript(false);

    await expect(result).resolves.toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
  });

  it("도메인 미등록으로 sendDefault 가 던져도 폴백까지 이어 준다", async () => {
    const { sendDefault } = stubKakao({ throws: true });
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share, clipboard: undefined });
    const { shareKakao } = await loadShare("test-key");

    await expect(shareKakao()).resolves.toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
    expect(sendDefault).toHaveBeenCalledTimes(1);
  });

  it("SIS-42 미리 받아 둔 SDK 가 있으면 클릭과 같은 틱에 공유 창을 연다", async () => {
    const { sendDefault } = stubKakao();
    const { shareKakao } = await loadShare("test-key");

    const result = shareKakao();

    expect(sendDefault).toHaveBeenCalledTimes(1);
    await expect(result).resolves.toBe("kakao");
  });

  it("SIS-42 PC 에서 팝업이 막히면 조용히 링크 복사로 마무리한다", async () => {
    stubKakao({ throws: true });
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share: undefined, clipboard: { writeText } });
    const { shareKakao } = await loadShare("test-key");

    await expect(shareKakao()).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(INVITE.siteUrl);
  });

  it("키 형식이 어긋나 init 이 던져도 폴백까지 이어 준다", async () => {
    stubKakao({ initThrows: true });
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share, clipboard: undefined });
    const { shareKakao } = await loadShare("잘못된-키");

    await expect(shareKakao()).resolves.toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
  });

  it("이미 초기화돼 있으면 init 을 다시 부르지 않는다", async () => {
    const { Kakao } = stubKakao();
    Kakao.isInitialized.mockReturnValue(true);
    const { shareKakao } = await loadShare("test-key");
    await shareKakao();

    expect(Kakao.init).not.toHaveBeenCalled();
  });
});

describe("loadKakaoSdk", () => {
  it("integrity 와 crossorigin 을 갖춰 스크립트를 붙인다", async () => {
    const { loadKakaoSdk } = await loadShare("test-key");
    const result = loadKakaoSdk();

    const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(script!.src).toContain("kakao.min.js");
    expect(script!.integrity).toMatch(/^sha384-/);
    expect(script!.crossOrigin).toBe("anonymous");
    expect(script!.async).toBe(true);

    await settleSdkScript(false);
    await result;
  });

  it("키가 없으면 스크립트를 붙이지 않는다", async () => {
    const { loadKakaoSdk } = await loadShare("");

    await expect(loadKakaoSdk()).resolves.toBe(false);
    expect(document.getElementById(SCRIPT_ID)).toBeNull();
  });

  it("이미 실려 있으면 다시 붙이지 않는다", async () => {
    stubKakao();
    const { loadKakaoSdk } = await loadShare("test-key");

    await expect(loadKakaoSdk()).resolves.toBe(true);
    expect(document.getElementById(SCRIPT_ID)).toBeNull();
  });

  it("두 번 불러도 스크립트는 하나다", async () => {
    const { loadKakaoSdk } = await loadShare("test-key");
    const first = loadKakaoSdk();
    const second = loadKakaoSdk();

    expect(document.querySelectorAll(`#${SCRIPT_ID}`)).toHaveLength(1);

    stubKakao();
    await settleSdkScript(true);
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
  });

  it("실패한 뒤에는 다시 시도한다", async () => {
    const { loadKakaoSdk } = await loadShare("test-key");
    const failed = loadKakaoSdk();
    await settleSdkScript(false);
    await expect(failed).resolves.toBe(false);
    expect(document.getElementById(SCRIPT_ID)).toBeNull();

    const retried = loadKakaoSdk();
    stubKakao();
    await settleSdkScript(true);

    await expect(retried).resolves.toBe(true);
  });
});

describe("shareFallback", () => {
  it("navigator.share 에 INVITE 값을 넘긴다", async () => {
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share, clipboard: undefined });
    const { shareFallback } = await loadShare();

    await expect(shareFallback()).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({
      title: INVITE.share.title,
      text: INVITE.share.description,
      url: INVITE.siteUrl,
    });
  });

  it("공유 시트를 닫으면(AbortError) 복사로 내려가지 않는다", async () => {
    const abort = new DOMException("취소", "AbortError");
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share: vi.fn(() => Promise.reject(abort)), clipboard: { writeText } });
    const { shareFallback } = await loadShare();

    await expect(shareFallback()).resolves.toBe("shared");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("DOMException 이 Error 를 상속하지 않아도 취소를 알아본다", async () => {
    const abort = { name: "AbortError", message: "취소" };
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share: vi.fn(() => Promise.reject(abort)), clipboard: { writeText } });
    const { shareFallback } = await loadShare();

    await expect(shareFallback()).resolves.toBe("shared");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("공유가 권한 거부로 실패하면 복사로 내려간다", async () => {
    const denied = Object.assign(new Error("거부"), { name: "NotAllowedError" });
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share: vi.fn(() => Promise.reject(denied)), clipboard: { writeText } });
    const { shareFallback } = await loadShare();

    await expect(shareFallback()).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(INVITE.siteUrl);
  });

  it("navigator.share 가 없으면 클립보드로 내려간다", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share: undefined, clipboard: { writeText } });
    const { shareFallback } = await loadShare();

    await expect(shareFallback()).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(INVITE.siteUrl);
  });
});

describe("copyLink", () => {
  it("청첩장 주소를 복사한다", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { copyLink } = await loadShare();

    await expect(copyLink()).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(INVITE.siteUrl);
  });

  it("클립보드가 모두 막히면 failed 를 돌려준다", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(() => Promise.reject(new Error("거부"))) } });
    Object.defineProperty(document, "execCommand", { value: vi.fn().mockReturnValue(false), configurable: true });
    const { copyLink } = await loadShare();

    await expect(copyLink()).resolves.toBe("failed");

    Reflect.deleteProperty(document as unknown as Record<string, unknown>, "execCommand");
  });
});
