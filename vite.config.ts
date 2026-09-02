/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { INVITE } from "./src/invite";
import { ogImageUrl } from "./src/lib/imageUrl";

function inviteMeta(mode: string): Plugin {
  const { title, description } = INVITE.share;
  const siteUrl = INVITE.siteUrl.replace(/\/+$/, "");

  return {
    name: "invite-meta",
    transformIndexHtml(html) {
      const imageBase = loadEnv(mode, process.cwd(), "VITE_").VITE_IMAGE_BASE_URL ?? "";
      const ogImage = ogImageUrl(siteUrl, imageBase);

      const filled = html
        .replaceAll("__OG_TITLE__", title)
        .replaceAll("__OG_DESCRIPTION__", description)
        .replaceAll("__OG_IMAGE__", ogImage)
        .replaceAll("__SITE_URL__", siteUrl);

      const leftover = filled.match(/__[A-Z0-9_]+__/g)?.filter((m) => !m.startsWith("__VITE_"));
      if (leftover?.length) {
        throw new Error(`index.html 의 자리표시자를 채우지 못했습니다: ${[...new Set(leftover)].join(", ")}`);
      }
      return filled;
    },
  };
}

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
        return [];
      }

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
    env: {
      VITE_ACCOUNTS_GROOM: "",
      VITE_ACCOUNTS_BRIDE: "",
      VITE_IMAGE_BASE_URL: "",
      VITE_KAKAO_JS_KEY: "",
      VITE_SUPABASE_URL: "",
      VITE_SUPABASE_PUBLISHABLE_KEY: "",
    },
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    restoreMocks: true,
  },
}));
