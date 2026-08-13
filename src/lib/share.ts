// SH-01 카카오톡 공유 · SH-02 링크 복사.
//
// 문구·주소·썸네일은 전부 INVITE 에서 온다. 예전에는 이 파일이 제목·설명을 직접
// 조합하고 vite.config.ts 의 OG 태그가 또 따로 조합해, 한쪽만 고치면 카톡 카드와
// OG 태그의 문구가 갈렸다. 이제 양쪽 모두 INVITE.share 를 읽는다.
//
// 링크는 location.origin 이 아니라 INVITE.siteUrl 이다. 프리뷰 URL 에서 공유하면
// 그 임시 주소가 하객에게 그대로 나가기 때문이다.

import { INVITE } from "../invite";
import { copyText } from "./clipboard";
import { ogImageUrl } from "./imageUrl";

declare global {
  interface Window {
    Kakao?: {
      init: (key: string) => void;
      isInitialized: () => boolean;
      Share: { sendDefault: (settings: object) => void };
    };
  }
}

const KAKAO_KEY = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;

// SDK 는 index.html 이 아니라 여기서 붙인다(SIS-18). 태그에 defer 를 달아 두어도
// 브라우저는 **실행만 미룰 뿐 다운로드는 미루지 않아서**, 27KB 가 렌더 차단
// 스타일시트보다 먼저 내려와 첫 픽셀 앞에서 대역폭을 먹었다 — Slow 3G 실측에서
// 첫 페인트가 6.85s 였고, 이 태그를 걷어내니 6.27s 였다.
//
// 지도 SDK(src/lib/kakaoMap.ts)가 같은 이유로 이미 이 방식이다.
const SDK_SRC = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.6/kakao.min.js";

// index.html 에 있던 값을 그대로 옮겼다. CDN 의 파일이 바뀌면 로드 자체가 막히고
// 아래 폴백 사슬로 내려간다. 버전을 올릴 때는 해시도 함께 다시 계산해야 한다:
//   curl -s <SDK_SRC> | openssl dgst -sha384 -binary | openssl base64 -A
const SDK_INTEGRITY = "sha384-WAtVcQYcmTO/N+C1N+1m6Gp8qxh+3NlnP7X1U7qP6P5dQY/MsRBNTh+e1ahJrkEm";

const SCRIPT_ID = "kakao-share-sdk";

// 섹션이 두 번 그려져도(StrictMode 의 이중 실행) 스크립트는 한 번만 받는다.
let pending: Promise<boolean> | null = null;

/**
 * 공유 SDK 스크립트를 붙이고 `window.Kakao` 가 준비됐는지 돌려준다.
 *
 * **공유 버튼을 누르기 전에 미리 불러 두는 쪽이 좋다.** `Kakao.Share.sendDefault` 는
 * PC 에서 팝업 창을 여는데, 브라우저가 팝업을 허용하는 것은 사용자 조작 직후 몇 초
 * 동안뿐이다. 클릭한 다음에야 27KB 를 받기 시작하면 느린 회선에서 그 창이 조용히
 * 막힌다 — 예외가 나지 않으니 폴백 사슬도 타지 않는다. 그래서 공유 섹션이 화면에
 * 들어오는 시점에 미리 부른다(src/components/Share.tsx). 첫 페인트와는 한참 떨어진
 * 시점이라 위 대역폭 문제는 그대로 피한다.
 *
 * 실패하면 다음 호출이 다시 시도하도록 약속을 비워 둔다. 회선이 잠깐 끊겼을 뿐인
 * 경우가 있어, 한 번 실패했다고 그 방문 내내 카카오 공유를 포기할 이유는 없다.
 */
export function loadKakaoSdk(): Promise<boolean> {
  // 키가 없으면 받아도 쓸 데가 없다. 로컬·CI 가 여기로 빠진다.
  if (!KAKAO_KEY) return Promise.resolve(false);
  if (window.Kakao) return Promise.resolve(true);
  if (pending) return pending;

  pending = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = SDK_SRC;
    script.integrity = SDK_INTEGRITY;
    // 무결성 검사는 CORS 로 받은 응답에만 걸린다. 빠지면 integrity 가 무시되는 게
    // 아니라 로드가 통째로 막힌다.
    script.crossOrigin = "anonymous";
    script.addEventListener("load", () => resolve(Boolean(window.Kakao)), { once: true });
    script.addEventListener(
      "error",
      () => {
        // 실패한 태그는 걷어낸다. 남겨 두면 다시 시도할 때 같은 id 가 둘이 된다.
        script.remove();
        pending = null;
        resolve(false);
      },
      { once: true },
    );
    document.head.appendChild(script);
  });

  return pending;
}

/**
 * 공유 결과. 호출부는 이 값으로 토스트를 띄울지 정한다.
 *
 * `kakao`·`shared` 는 화면이 눈에 띄게 바뀌므로(카톡 창·공유 시트) 알림이 필요 없고,
 * `copied` 는 화면이 그대로라 알려 주어야 한다.
 */
export type ShareResult = "kakao" | "shared" | "copied" | "failed";

export async function initKakao(): Promise<boolean> {
  if (!(await loadKakaoSdk())) return false;
  // loadKakaoSdk 가 참을 준 뒤라 키와 window.Kakao 가 둘 다 있다.
  if (!window.Kakao!.isInitialized()) window.Kakao!.init(KAKAO_KEY!);
  return true;
}

/**
 * 카카오톡 공유 카드를 띄운다. 쓸 수 없는 환경이면 폴백으로 내려간다.
 *
 * SDK 가 던지는 자리가 둘이라 초기화까지 통째로 try 안에 둔다.
 *   - `Kakao.init` — 키 형식이 어긋날 때. JavaScript 키 대신 REST API 키를 넣는
 *     실수가 흔하다. (스크립트를 받는 데 실패하는 것은 던지지 않고 false 로 온다.)
 *   - `sendDefault` — 카카오 개발자 콘솔에 그 도메인이 등록돼 있지 않을 때.
 *     프리뷰 주소마다 등록이 필요해 자주 겪는다.
 *
 * 어느 쪽이든 하객은 링크를 얻을 수 있어야 한다. init 을 밖에 두었더니 키가 잘못된
 * 순간 예외가 이 함수 밖으로 새어나가, 폴백은커녕 버튼이 아무 반응 없이 죽었다.
 */
export async function shareKakao(): Promise<ShareResult> {
  try {
    if (await initKakao()) {
      window.Kakao!.Share.sendDefault({
        objectType: "feed",
        content: {
          title: INVITE.share.title,
          description: INVITE.share.description,
          imageUrl: ogImageUrl(INVITE.siteUrl),
          link: { mobileWebUrl: INVITE.siteUrl, webUrl: INVITE.siteUrl },
        },
        buttons: [
          {
            title: INVITE.share.buttonText,
            link: { mobileWebUrl: INVITE.siteUrl, webUrl: INVITE.siteUrl },
          },
        ],
      });
      return "kakao";
    }
  } catch {
    // 폴백으로 내려간다
  }
  return shareFallback();
}

/**
 * 카카오 SDK 를 못 쓰는 환경: 네이티브 공유 시트 → 링크 복사 순으로 폴백한다.
 *
 * 공유 시트를 하객이 그냥 닫으면 `AbortError` 가 온다. 이때 클립보드로 다시 내려가면
 * 취소했는데도 "복사되었습니다" 가 뜨므로, 그 경우만 아무 일도 없었던 것으로 둔다.
 *
 * 거부값이 `Error` 인지는 보지 않고 이름만 본다. 실제로 오는 것은 DOMException 이고,
 * 그것이 Error 를 상속하는지는 브라우저마다 다르다 — instanceof 로 좁히면 상속하지
 * 않는 구형 WebKit 에서 이 분기를 통째로 놓친다.
 */
export async function shareFallback(): Promise<ShareResult> {
  if (navigator.share) {
    try {
      await navigator.share({
        title: INVITE.share.title,
        text: INVITE.share.description,
        url: INVITE.siteUrl,
      });
      return "shared";
    } catch (error) {
      if ((error as { name?: string } | null)?.name === "AbortError") return "shared";
      // 그 밖의 실패(권한 거부 등)는 복사로 내려간다
    }
  }
  return copyLink();
}

/**
 * 청첩장 주소를 클립보드에 넣는다.
 *
 * 카카오톡 인앱 브라우저는 navigator.clipboard 가 없거나 거부하는 경우가 있어
 * copyText 가 옛 방식까지 갖추고 있다(src/lib/clipboard.ts).
 */
export async function copyLink(): Promise<ShareResult> {
  return (await copyText(INVITE.siteUrl)) ? "copied" : "failed";
}
