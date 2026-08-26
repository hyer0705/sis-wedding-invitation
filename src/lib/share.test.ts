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

/**
 * 붙은 SDK 스크립트에 도착·실패를 알린다.
 *
 * jsdom 은 script.src 를 실제로 받지 않아 load 도 error 도 저절로 오지 않는다.
 * 이걸 해 주지 않으면 SDK 를 기다리는 쪽이 영영 멎는다.
 */
async function settleSdkScript(ok: boolean) {
  // 스크립트는 loadKakaoSdk 호출과 같은 틱에 붙지만, 호출부가 await 를 하나 거친
  // 뒤일 수 있어 한 틱 양보하고 찾는다.
  await Promise.resolve();
  const script = document.getElementById(SCRIPT_ID);
  if (!script) throw new Error("SDK 스크립트가 붙지 않았다");
  script.dispatchEvent(new Event(ok ? "load" : "error"));
}

beforeEach(() => {
  // 기본은 "아무것도 없는 환경" — 각 테스트가 필요한 것만 얹는다.
  vi.stubGlobal("Kakao", undefined);
  vi.stubGlobal("navigator", { clipboard: undefined, share: undefined });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  // document 는 파일 안의 테스트가 공유한다. 남겨 두면 다음 테스트가 앞 테스트의
  // 스크립트를 보고 "이미 붙었다"고 잘못 판단한다.
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

  it("SDK 를 받아 온 뒤 카카오 공유 카드를 띄운다", async () => {
    // SDK 는 index.html 이 아니라 share.ts 가 붙인다(SIS-18). 눌린 시점에 아직 안
    // 와 있으면 기다렸다가 띄워야 한다.
    const { shareKakao } = await loadShare("test-key");
    const result = shareKakao();

    // 스크립트가 도착하는 순간 window.Kakao 가 생긴다.
    const { sendDefault } = stubKakao();
    await settleSdkScript(true);

    await expect(result).resolves.toBe("kakao");
    expect(sendDefault).toHaveBeenCalledTimes(1);
  });

  it("SDK 를 받지 못하면 폴백한다", async () => {
    // CDN 이 막혔거나 integrity 가 어긋난 경우다. 카카오 공유만 빠지고 하객은
    // 여전히 링크를 얻을 수 있어야 한다.
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share, clipboard: undefined });
    const { shareKakao } = await loadShare("test-key");
    const result = shareKakao();

    await settleSdkScript(false);

    await expect(result).resolves.toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
  });

  it("도메인 미등록으로 sendDefault 가 던져도 폴백까지 이어 준다", async () => {
    // 카카오 콘솔에 프리뷰 도메인을 등록하기 전에 늘 겪는 경우다. 여기서 멈추면
    // 버튼을 눌러도 아무 일이 일어나지 않는다.
    const { sendDefault } = stubKakao({ throws: true });
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share, clipboard: undefined });
    const { shareKakao } = await loadShare("test-key");

    await expect(shareKakao()).resolves.toBe("shared");
    expect(share).toHaveBeenCalledTimes(1);
    // 실패한 시도를 되풀이하지 않는다 — 두 번 부르면 공유 창도 두 번 뜬다.
    expect(sendDefault).toHaveBeenCalledTimes(1);
  });

  it("SIS-42 미리 받아 둔 SDK 가 있으면 클릭과 같은 틱에 공유 창을 연다", async () => {
    // PC 에서 sendDefault 는 window.open 으로 창을 연다. 브라우저는 그 호출이 클릭과
    // 같은 흐름에 있을 때만 팝업으로 보지 않으므로, await 를 하나라도 건너면 막힌다.
    // 그래서 결과를 기다리기 전에 이미 불려 있어야 한다.
    const { sendDefault } = stubKakao();
    const { shareKakao } = await loadShare("test-key");

    const result = shareKakao();

    expect(sendDefault).toHaveBeenCalledTimes(1);
    await expect(result).resolves.toBe("kakao");
  });

  it("SIS-42 PC 에서 팝업이 막히면 조용히 링크 복사로 마무리한다", async () => {
    // 팝업이 막히면 SDK 가 열리지 않은 창(null)에 focus 를 부르다 TypeError 를 던진다.
    // PC 브라우저에는 navigator.share 가 없어 복사가 마지막 창구다 — 여기서 실패하면
    // 하객이 보는 것은 "공유에 실패했어요" 뿐이다.
    stubKakao({ throws: true });
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share: undefined, clipboard: { writeText } });
    const { shareKakao } = await loadShare("test-key");

    await expect(shareKakao()).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(INVITE.siteUrl);
  });

  it("키 형식이 어긋나 init 이 던져도 폴백까지 이어 준다", async () => {
    // JavaScript 키 대신 REST API 키를 넣는 실수가 흔하다. init 을 try 밖에 두었을
    // 때는 예외가 shareKakao 밖으로 새어나가 버튼이 아무 반응 없이 죽었다 — 카톡 창도
    // 공유 시트도 복사도 없이, 하객에게는 고장과 구분되지 않았다.
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
  // SIS-18 — index.html 의 defer 스크립트를 걷어내고 이리 옮겼다. defer 는 실행만
  // 미룰 뿐 다운로드는 미루지 않아, 27KB 가 렌더 차단 스타일시트보다 먼저 내려와
  // 첫 페인트를 0.58초 늦추고 있었다(Slow 3G 실측 6.85s → 6.27s).

  it("integrity 와 crossorigin 을 갖춰 스크립트를 붙인다", async () => {
    const { loadKakaoSdk } = await loadShare("test-key");
    const result = loadKakaoSdk();

    const script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    expect(script).not.toBeNull();
    expect(script!.src).toContain("kakao.min.js");
    // 무결성 검사는 CORS 로 받은 응답에만 걸린다. crossOrigin 이 빠지면 integrity 가
    // 무시되는 게 아니라 로드가 통째로 막힌다 — 카카오 공유가 조용히 사라진다.
    expect(script!.integrity).toMatch(/^sha384-/);
    expect(script!.crossOrigin).toBe("anonymous");
    // async 가 아니면 파서를 붙잡는다. 공유는 기다려도 되는 기능이다.
    expect(script!.async).toBe(true);

    await settleSdkScript(false);
    await result;
  });

  it("키가 없으면 스크립트를 붙이지 않는다", async () => {
    // 로컬·CI 가 여기로 빠진다. 받아 봐야 쓸 데가 없다.
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
    // 공유 섹션이 화면에 들어올 때 한 번, 버튼을 누를 때 또 한 번 불린다.
    // StrictMode 의 이중 실행까지 겹치면 같은 27KB 를 여러 번 받게 된다.
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
    // 회선이 잠깐 끊겼을 뿐인 경우가 있다. 한 번 실패했다고 그 방문 내내 카카오
    // 공유를 포기할 이유는 없다.
    const { loadKakaoSdk } = await loadShare("test-key");
    const failed = loadKakaoSdk();
    await settleSdkScript(false);
    await expect(failed).resolves.toBe(false);
    // 실패한 태그는 남지 않는다 — 남으면 같은 id 가 둘이 된다.
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
    // 취소했는데 "복사되었습니다" 가 뜨면 하객은 자기가 뭘 한 건지 알 수 없다.
    const abort = new DOMException("취소", "AbortError");
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { share: vi.fn(() => Promise.reject(abort)), clipboard: { writeText } });
    const { shareFallback } = await loadShare();

    await expect(shareFallback()).resolves.toBe("shared");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("DOMException 이 Error 를 상속하지 않아도 취소를 알아본다", async () => {
    // 구형 WebKit 이 그렇다. instanceof Error 로 좁히면 이 분기를 통째로 놓쳐,
    // 취소했는데도 클립보드가 덮어써지고 "복사되었습니다" 가 뜬다.
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
