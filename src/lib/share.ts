import { INVITE } from "../invite";

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

export function initKakao(): boolean {
  if (!KAKAO_KEY || !window.Kakao) return false;
  if (!window.Kakao.isInitialized()) window.Kakao.init(KAKAO_KEY);
  return true;
}

export function shareKakao(): void {
  if (!initKakao()) {
    void shareFallback();
    return;
  }
  window.Kakao!.Share.sendDefault({
    objectType: "feed",
    content: {
      title: `${INVITE.groom.name} ♥ ${INVITE.bride.name} 결혼합니다`,
      description: `${INVITE.dateText} ${INVITE.dayText} · ${INVITE.venue} ${INVITE.hall}`,
      imageUrl: `${location.origin}/og-image.jpg`,
      link: { mobileWebUrl: location.origin, webUrl: location.origin },
    },
    buttons: [{ title: "청첩장 보기", link: { mobileWebUrl: location.origin, webUrl: location.origin } }],
  });
}

// 카카오 SDK를 못 쓰는 환경: 네이티브 공유 시트 → 링크 복사 순으로 폴백
export async function shareFallback(): Promise<"shared" | "copied"> {
  const url = location.href;
  if (navigator.share) {
    await navigator.share({ title: document.title, url });
    return "shared";
  }
  await navigator.clipboard.writeText(url);
  return "copied";
}
