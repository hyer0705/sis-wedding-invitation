/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { INVITE } from "./src/invite";

/**
 * index.html 의 제목·설명·OG 태그를 INVITE 에서 채운다.
 *
 * 예전에는 index.html 에 날짜를 직접 적어 뒀는데, 예식 일시가 바뀔 때 그쪽이
 * 따라오지 않아 카톡 공유 카드에 1년 넘게 어긋난 날짜가 실려 있었다(SIS-24).
 * 값이 한 곳에서만 나오게 해 그 어긋남 자체를 없앤다.
 */
function inviteMeta(): Plugin {
  const title = `${INVITE.groom.name} ♥ ${INVITE.bride.name} 결혼합니다`;
  const description = `${INVITE.dateText} ${INVITE.dayText} · ${INVITE.venue} ${INVITE.hall}`;
  const siteUrl = INVITE.siteUrl.replace(/\/+$/, "");

  return {
    name: "invite-meta",
    transformIndexHtml(html) {
      const filled = html
        .replaceAll("__OG_TITLE__", title)
        .replaceAll("__OG_DESCRIPTION__", description)
        .replaceAll("__SITE_URL__", siteUrl);

      // 채우지 못한 자리가 남으면 빌드를 세운다. 조용히 넘어가면 카톡 공유
      // 카드에 __OG_TITLE__ 같은 문자열이 그대로 실린다.
      const leftover = filled.match(/__[A-Z0-9_]+__/g);
      if (leftover) {
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
  plugins: [react(), inviteMeta(), imageOriginPreconnect(mode)],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // scripts/의 검토 게이트는 .mjs다. tsconfig·eslint 대상(src)이 아니므로
    // 확장자를 그대로 두고 테스트만 여기서 잡는다.
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    restoreMocks: true,
  },
}));
