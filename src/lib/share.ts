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

/**
 * 공유 결과. 호출부는 이 값으로 토스트를 띄울지 정한다.
 *
 * `kakao`·`shared` 는 화면이 눈에 띄게 바뀌므로(카톡 창·공유 시트) 알림이 필요 없고,
 * `copied` 는 화면이 그대로라 알려 주어야 한다.
 */
export type ShareResult = "kakao" | "shared" | "copied" | "failed";

export function initKakao(): boolean {
  if (!KAKAO_KEY || !window.Kakao) return false;
  if (!window.Kakao.isInitialized()) window.Kakao.init(KAKAO_KEY);
  return true;
}

/**
 * 카카오톡 공유 카드를 띄운다. 쓸 수 없는 환경이면 폴백으로 내려간다.
 *
 * SDK 가 던지는 자리가 둘이라 초기화까지 통째로 try 안에 둔다.
 *   - `Kakao.init` — 키 형식이 어긋날 때. JavaScript 키 대신 REST API 키를 넣는
 *     실수가 흔하다.
 *   - `sendDefault` — 카카오 개발자 콘솔에 그 도메인이 등록돼 있지 않을 때.
 *     프리뷰 주소마다 등록이 필요해 자주 겪는다.
 *
 * 어느 쪽이든 하객은 링크를 얻을 수 있어야 한다. init 을 밖에 두었더니 키가 잘못된
 * 순간 예외가 이 함수 밖으로 새어나가, 폴백은커녕 버튼이 아무 반응 없이 죽었다.
 */
export async function shareKakao(): Promise<ShareResult> {
  try {
    if (initKakao()) {
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
