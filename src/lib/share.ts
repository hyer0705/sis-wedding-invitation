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

const SDK_SRC = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.6/kakao.min.js";

const SDK_INTEGRITY = "sha384-WAtVcQYcmTO/N+C1N+1m6Gp8qxh+3NlnP7X1U7qP6P5dQY/MsRBNTh+e1ahJrkEm";

const SCRIPT_ID = "kakao-share-sdk";

let pending: Promise<boolean> | null = null;

export function loadKakaoSdk(): Promise<boolean> {
  if (!KAKAO_KEY) return Promise.resolve(false);
  if (window.Kakao) return Promise.resolve(true);
  if (pending) return pending;

  pending = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = SDK_SRC;
    script.integrity = SDK_INTEGRITY;
    script.crossOrigin = "anonymous";
    script.addEventListener("load", () => resolve(Boolean(window.Kakao)), { once: true });
    script.addEventListener(
      "error",
      () => {
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

export type ShareResult = "kakao" | "shared" | "copied" | "failed";

function initKakaoNow(): boolean {
  if (!KAKAO_KEY || !window.Kakao) return false;
  if (!window.Kakao.isInitialized()) window.Kakao.init(KAKAO_KEY);
  return true;
}

export async function initKakao(): Promise<boolean> {
  if (!(await loadKakaoSdk())) return false;
  return initKakaoNow();
}

function sendKakaoCard(): void {
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
}

export async function shareKakao(): Promise<ShareResult> {
  try {
    if (initKakaoNow()) {
      sendKakaoCard();
      return "kakao";
    }
  } catch {
    return shareFallback();
  }

  try {
    if (await initKakao()) {
      sendKakaoCard();
      return "kakao";
    }
  } catch {}
  return shareFallback();
}

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
    }
  }
  return copyLink();
}

export async function copyLink(): Promise<ShareResult> {
  return (await copyText(INVITE.siteUrl)) ? "copied" : "failed";
}
