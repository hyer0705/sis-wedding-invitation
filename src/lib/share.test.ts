import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INVITE } from "../invite";

// SH-01·SH-02. 이 모듈은 SIS-7 때 짜 두고 UI 가 붙지 않아 아무도 실행해 본 적이 없었다 —
// 그 사이 R2 전환(SIS-28)에 썸네일 경로가 따라오지 않는 등 버그가 셋 쌓여 있었다.
// 죽은 코드로 되돌아가지 않도록 폴백 사슬을 전부 덮는다.
//
// KAKAO_KEY 는 모듈이 로드될 때 한 번 읽히므로, 키를 바꾸려면 모듈을 다시 들여와야 한다.
// vite.config.ts 의 test.env 가 이 값을 비워 고정해 두어서 .env 가 있는 로컬과 없는
// CI 의 결과가 같다.

const R2 = "https://images.example.com";

/** 키를 정한 뒤 share 모듈을 새로 들여온다. */
async function loadShare(kakaoKey = "") {
  vi.resetModules();
  vi.stubEnv("VITE_KAKAO_JS_KEY", kakaoKey);
  vi.stubEnv("VITE_IMAGE_BASE_URL", R2);
  return import("./share");
}

/** sendDefault 에 넘기는 피드 설정. 인자를 타입 없이 두면 mock.calls 에서 꺼낼 수 없다. */
type KakaoFeed = {
  objectType: string;
  content: { title: string; description: string; imageUrl: string; link: { mobileWebUrl: string; webUrl: string } };
  buttons: { title: string; link: { mobileWebUrl: string; webUrl: string } }[];
};

/** window.Kakao 를 흉내낸다. sendDefault 에 실제로 넘어간 인자를 볼 수 있게 돌려준다. */
function stubKakao(options: { throws?: boolean } = {}) {
  const sendDefault = vi.fn<(settings: KakaoFeed) => void>(() => {
    if (options.throws) throw new Error("도메인이 등록되지 않았습니다");
  });
  const Kakao = {
    init: vi.fn(),
    isInitialized: vi.fn(() => false),
    Share: { sendDefault },
  };
  vi.stubGlobal("Kakao", Kakao);
  return { Kakao, sendDefault };
}

beforeEach(() => {
  // 기본은 "아무것도 없는 환경" — 각 테스트가 필요한 것만 얹는다.
  vi.stubGlobal("Kakao", undefined);
  vi.stubGlobal("navigator", { clipboard: undefined, share: undefined });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("shareKakao", () => {
  it("SDK 와 키가 있으면 카카오 공유 카드를 띄운다", async () => {
    const { sendDefault } = stubKakao();
    const { shareKakao } = await loadShare("test-key");

    await expect(shareKakao()).resolves.toBe("kakao");
    expect(sendDefault).toHaveBeenCalledTimes(1);
  });

  it("카드에 INVITE.share 문구를 그대로 싣는다", async () => {
    // 문구를 이 파일에서 다시 조합하지 않는다. 조합식을 적으면 share.ts 가 제 문구를
    // 만들던 시절의 버그(카톡 카드와 OG 태그가 갈리던 것)를 테스트가 되레 굳힌다.
    const { sendDefault } = stubKakao();
    const { shareKakao } = await loadShare("test-key");
    await shareKakao();

    const settings = sendDefault.mock.calls[0][0];
    expect(settings.content.title).toBe(INVITE.share.title);
    expect(settings.content.description).toBe(INVITE.share.description);
    expect(settings.buttons[0].title).toBe(INVITE.share.buttonText);
  });

  it("썸네일이 이미지 베이스(R2)의 절대 URL 이다", async () => {
    // location.origin 을 쓰던 시절에는 배포본에 없는 파일을 가리켜 404 였고,
    // 카톡 카드에서 썸네일이 통째로 빠졌다.
    const { sendDefault } = stubKakao();
    const { shareKakao } = await loadShare("test-key");
    await shareKakao();

    expect(sendDefault.mock.calls[0][0].content.imageUrl).toBe(`${R2}/og-image.jpg`);
  });

  it("링크가 프리뷰 주소가 아니라 INVITE.siteUrl 이다", async () => {
    // location.origin 을 쓰면 프리뷰에서 공유했을 때 그 임시 주소가 하객에게 나간다.
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

  it("SDK 가 실려 있지 않으면 폴백한다", async () => {
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share, clipboard: undefined });
    const { shareKakao } = await loadShare("test-key");

    await expect(shareKakao()).resolves.toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
  });

  it("도메인 미등록으로 sendDefault 가 던져도 폴백까지 이어 준다", async () => {
    // 카카오 콘솔에 프리뷰 도메인을 등록하기 전에 늘 겪는 경우다. 여기서 멈추면
    // 버튼을 눌러도 아무 일이 일어나지 않는다.
    stubKakao({ throws: true });
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share, clipboard: undefined });
    const { shareKakao } = await loadShare("test-key");

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
    // 취소했는데 "복사되었습니다" 가 뜨면 하객은 자기가 뭘 한 건지 알 수 없다.
    const abort = Object.assign(new Error("취소"), { name: "AbortError" });
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
    // 카카오톡 인앱 브라우저에서 실제로 겪을 수 있는 경우다. 호출부는 이 값으로
    // "길게 눌러 주세요" 안내를 띄운다.
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn(() => Promise.reject(new Error("거부"))) } });
    // jsdom 에는 execCommand 가 아예 없어 spyOn 이 걸리지 않는다 — 속성을 직접 심는다
    // (src/lib/clipboard.test.ts 와 같은 방식).
    Object.defineProperty(document, "execCommand", { value: vi.fn().mockReturnValue(false), configurable: true });
    const { copyLink } = await loadShare();

    await expect(copyLink()).resolves.toBe("failed");

    Reflect.deleteProperty(document as unknown as Record<string, unknown>, "execCommand");
  });
});
