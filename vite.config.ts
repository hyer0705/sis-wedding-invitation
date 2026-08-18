/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { INVITE } from "./src/invite";
import { ogImageUrl } from "./src/lib/imageUrl";

/**
 * index.html 의 제목·설명·OG 태그를 INVITE 에서 채운다.
 *
 * 예전에는 index.html 에 날짜를 직접 적어 뒀는데, 예식 일시가 바뀔 때 그쪽이
 * 따라오지 않아 카톡 공유 카드에 1년 넘게 어긋난 날짜가 실려 있었다(SIS-24).
 * 값이 한 곳에서만 나오게 해 그 어긋남 자체를 없앤다.
 *
 * 문구를 여기서 조합하지 않고 INVITE.share 를 그대로 읽는다. 카톡 공유 카드를 만드는
 * src/lib/share.ts 도 같은 값을 읽으므로, 둘의 문구가 갈릴 자리가 없다(SIS-16).
 */
function inviteMeta(mode: string): Plugin {
  const { title, description } = INVITE.share;
  const siteUrl = INVITE.siteUrl.replace(/\/+$/, "");

  return {
    name: "invite-meta",
    transformIndexHtml(html) {
      // og:image 도 R2 에서 온다. 베이스 URL 이 비어 있을 때 사이트 절대 주소로 메우는
      // 규칙은 ogImageUrl 안에 있다 — 런타임(share.ts)과 빌드 시점이 같은 주소를 만들어야
      // 카톡 카드와 OG 태그의 썸네일이 어긋나지 않는다.
      const imageBase = loadEnv(mode, process.cwd(), "VITE_").VITE_IMAGE_BASE_URL ?? "";
      const ogImage = ogImageUrl(siteUrl, imageBase);

      const filled = html
        .replaceAll("__OG_TITLE__", title)
        .replaceAll("__OG_DESCRIPTION__", description)
        .replaceAll("__OG_IMAGE__", ogImage)
        .replaceAll("__SITE_URL__", siteUrl);

      // 채우지 못한 자리가 남으면 빌드를 세운다. 조용히 넘어가면 카톡 공유
      // 카드에 __OG_TITLE__ 같은 문자열이 그대로 실린다.
      //
      // __VITE_...__ 는 Vite 자신의 자리표시자다. public/ 의 파일을 href 로 걸면
      // (SIS-30 의 폰트 preload) 여기 단계에서는 __VITE_PUBLIC_ASSET__ 로 남아 있고
      // 나중 단계에서 실제 경로로 바뀐다 — 우리 자리표시자가 아니므로 세지 않는다.
      const leftover = filled.match(/__[A-Z0-9_]+__/g)?.filter((m) => !m.startsWith("__VITE_"));
      if (leftover?.length) {
        throw new Error(`index.html 의 자리표시자를 채우지 못했습니다: ${[...new Set(leftover)].join(", ")}`);
      }
      return filled;
    },
  };
}

/**
 * 커버 사진(LCP 요소)이 R2 같은 다른 오리진에서 오면 DNS·TLS 핸드셰이크가
 * 이미지 요청 앞에 붙는다. head 에 preconnect 를 미리 박아 그 지연을 없앤다.
 *
 * 런타임이 아니라 빌드 시점에 넣는 이유는, 스크립트가 실행된 뒤 링크를 꽂으면
 * 이미 이미지 요청이 나간 뒤라 효과가 없기 때문이다.
 * 베이스 URL 이 없거나(로컬 폴백) 같은 오리진의 경로면 아무것도 넣지 않는다.
 */
function imageOriginPreconnect(mode: string): Plugin {
  return {
    name: "image-origin-preconnect",
    transformIndexHtml() {
      const base = loadEnv(mode, process.cwd(), "VITE_").VITE_IMAGE_BASE_URL?.trim();
      if (!base) return [];

      let origin: string;
      try {
        origin = new URL(base).origin;
      } catch {
        // "/assets" 같은 상대 경로 — 같은 오리진이라 preconnect 가 필요 없다.
        return [];
      }

      // crossorigin 을 붙이지 않는다. 붙이면 CORS 용 커넥션이 준비되는데
      // <img> 는 crossorigin 속성 없이 요청하므로 그 커넥션을 재사용하지 못하고
      // 핸드셰이크를 다시 한다 — preconnect 가 그대로 낭비된다.
      // (폰트는 CORS 요청이라 index.html 쪽 preconnect 에는 crossorigin 이 맞다.)
      return [
        { tag: "link", attrs: { rel: "preconnect", href: origin }, injectTo: "head-prepend" as const },
        { tag: "link", attrs: { rel: "dns-prefetch", href: origin }, injectTo: "head-prepend" as const },
      ];
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), inviteMeta(mode), imageOriginPreconnect(mode)],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // 환경변수를 비운 채 돌린다. Vitest 도 Vite 라 .env 를 읽는데, 그대로 두면 .env 가
    // 있는 로컬과 없는 CI 의 결과가 달라져 로컬에서만 통과하는 테스트가 생긴다 —
    // 계좌에서 실제로 겪었다(SIS-13). 값이 필요한 테스트는 픽스처를 주입한다
    // (vi.stubEnv 또는 인자 주입 — src/lib/share.test.ts 참고).
    //
    // 계좌에는 mock 폴백이 없어 빈 값이면 INVITE.accounts 가 빈 배열이 된다.
    // 이미지 베이스와 카카오 키는 공유 카드의 썸네일·경로를 좌우한다(SIS-16).
    env: {
      VITE_ACCOUNTS_GROOM: "",
      VITE_ACCOUNTS_BRIDE: "",
      VITE_IMAGE_BASE_URL: "",
      VITE_KAKAO_JS_KEY: "",
      // Supabase 도 같은 이유로 비운다. 로컬 .env 에는 실값이 있어서, 비우지 않으면
      // isSupabaseConfigured() 가 로컬에서만 true 가 된다(SIS-33).
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
    },
    // scripts/의 검토 게이트는 .mjs다. tsconfig·eslint 대상(src)이 아니므로
    // 확장자를 그대로 두고 테스트만 여기서 잡는다.
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    restoreMocks: true,
  },
}));
