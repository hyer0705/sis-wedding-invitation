import { afterEach, describe, expect, it, vi } from "vitest";
import { IMAGE_WIDTHS, imageSrcSet, imageUrl, ogImageUrl } from "./imageUrl";

// base 를 인자로 넘겨 환경변수와 무관하게 조합 규칙만 검증한다.
// 환경변수 폴백은 마지막 describe 에서 따로 본다.
const R2 = "https://pub-example.r2.dev";

describe("imageUrl", () => {
  it("베이스 URL 뒤에 이름·너비·확장자를 붙인다", () => {
    expect(imageUrl("wedding_1", 960, R2)).toBe("https://pub-example.r2.dev/wedding_1-960.webp");
  });

  it("베이스 URL 끝의 슬래시를 겹치지 않게 정리한다", () => {
    expect(imageUrl("wedding_1", 480, "https://pub-example.r2.dev/")).toBe("https://pub-example.r2.dev/wedding_1-480.webp");
    expect(imageUrl("wedding_1", 480, "https://pub-example.r2.dev///")).toBe("https://pub-example.r2.dev/wedding_1-480.webp");
  });

  it("베이스 URL 이 비어 있으면 로컬 /images 로 폴백한다", () => {
    // R2 를 붙이기 전이나 .env 없이 clone 한 상태에서도 개발이 되어야 한다.
    expect(imageUrl("wedding_1", 960, "")).toBe("/images/wedding_1-960.webp");
    expect(imageUrl("wedding_1", 960, "   ")).toBe("/images/wedding_1-960.webp");
  });

  it("경로형 베이스 URL 도 그대로 쓴다", () => {
    // r2.dev 대신 같은 도메인의 하위 경로로 옮겨도 코드 변경이 없어야 한다.
    expect(imageUrl("wedding_1", 480, "/assets")).toBe("/assets/wedding_1-480.webp");
  });
});

describe("imageSrcSet", () => {
  it("너비 2벌을 디스크립터와 함께 나열한다", () => {
    expect(imageSrcSet("wedding_1", R2)).toBe(
      "https://pub-example.r2.dev/wedding_1-480.webp 480w, https://pub-example.r2.dev/wedding_1-960.webp 960w",
    );
  });

  it("optimize 산출물과 같은 너비 목록을 쓴다", () => {
    // scripts/optimize-images.mjs 의 WIDTHS 와 어긋나면 404 가 난다.
    expect(IMAGE_WIDTHS).toEqual([480, 960]);
  });
});

describe("ogImageUrl", () => {
  const SITE = "https://example.com";

  it("이미지 베이스가 있으면 그 뒤에 붙인다", () => {
    expect(ogImageUrl(SITE, R2)).toBe("https://pub-example.r2.dev/og-image.jpg");
  });

  it("베이스가 비면 사이트 절대 주소로 메운다", () => {
    // 카카오톡 스크래퍼는 상대 경로를 못 읽는다. 로컬 폴백인 `/images/...` 를 그대로
    // 내보내면 공유 카드에서 썸네일이 통째로 빠진다.
    expect(ogImageUrl(SITE, "")).toBe("https://example.com/images/og-image.jpg");
  });

  it("경로형 베이스도 사이트 주소를 붙여 절대 URL 로 만든다", () => {
    // imageUrl 이 지원 사양으로 두고 있는 설정이다(같은 도메인 하위 경로로 옮기는 경우).
    // 여기서 상대 경로를 그대로 내보내면 카카오 스크래퍼가 읽지 못해 썸네일이 빠진다.
    expect(ogImageUrl(SITE, "/assets")).toBe("https://example.com/assets/og-image.jpg");
  });

  it("어느 쪽으로 가든 https 절대 URL 이다", () => {
    for (const url of [ogImageUrl(SITE, R2), ogImageUrl(SITE, ""), ogImageUrl(SITE, "/assets")]) {
      expect(url).toMatch(/^https:\/\//);
    }
  });

  it("사이트 주소 끝의 슬래시를 겹치지 않게 정리한다", () => {
    expect(ogImageUrl("https://example.com/", "")).toBe("https://example.com/images/og-image.jpg");
  });

  it("확장자가 JPEG 다", () => {
    // 외부 스크래퍼의 WebP 지원이 제각각이라 이 파일만 형식을 달리한다.
    expect(ogImageUrl(SITE, R2)).toMatch(/\.jpg$/);
  });
});

describe("환경변수 폴백", () => {
  // stubEnv 는 restoreMocks 대상이 아니라 직접 되돌린다.
  afterEach(() => vi.unstubAllEnvs());

  it("base 를 생략하면 VITE_IMAGE_BASE_URL 을 읽는다", () => {
    vi.stubEnv("VITE_IMAGE_BASE_URL", R2);
    expect(imageUrl("wedding_1", 960)).toBe("https://pub-example.r2.dev/wedding_1-960.webp");
  });

  it("VITE_IMAGE_BASE_URL 이 없으면 로컬 /images 를 쓴다", () => {
    vi.stubEnv("VITE_IMAGE_BASE_URL", "");
    expect(imageUrl("wedding_1", 960)).toBe("/images/wedding_1-960.webp");
  });
});
