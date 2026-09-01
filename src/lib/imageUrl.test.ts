import { afterEach, describe, expect, it, vi } from "vitest";
import { assetUrl, IMAGE_WIDTHS, imageSrcSet, imageUrl, ogImageUrl } from "./imageUrl";

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
    expect(imageUrl("wedding_1", 960, "")).toBe("/images/wedding_1-960.webp");
    expect(imageUrl("wedding_1", 960, "   ")).toBe("/images/wedding_1-960.webp");
  });

  it("경로형 베이스 URL 도 그대로 쓴다", () => {
    expect(imageUrl("wedding_1", 480, "/assets")).toBe("/assets/wedding_1-480.webp");
  });
});

describe("assetUrl", () => {
  it("파일명을 그대로 붙이고 너비 접미사를 넣지 않는다", () => {
    expect(assetUrl("logo-tmap.webp", R2)).toBe("https://pub-example.r2.dev/logo-tmap.webp");
  });

  it("사진과 같은 슬래시·폴백 규칙을 쓴다", () => {
    expect(assetUrl("logo-tmap.webp", "https://pub-example.r2.dev///")).toBe("https://pub-example.r2.dev/logo-tmap.webp");
    expect(assetUrl("logo-tmap.webp", "")).toBe("/images/logo-tmap.webp");
  });

  it("optimize:logos 가 만드는 파일명과 어긋나지 않는다", () => {
    for (const file of ["logo-naver-map.webp", "logo-kakao-map.webp", "logo-tmap.webp"]) {
      expect(assetUrl(file, R2)).toBe(`${R2}/${file}`);
    }
  });
});

describe("imageSrcSet", () => {
  it("너비 2벌을 디스크립터와 함께 나열한다", () => {
    expect(imageSrcSet("wedding_1", R2)).toBe(
      "https://pub-example.r2.dev/wedding_1-480.webp 480w, https://pub-example.r2.dev/wedding_1-960.webp 960w",
    );
  });

  it("optimize 산출물과 같은 너비 목록을 쓴다", () => {
    expect(IMAGE_WIDTHS).toEqual([480, 960]);
  });
});

describe("ogImageUrl", () => {
  const SITE = "https://example.com";

  it("이미지 베이스가 있으면 그 뒤에 붙인다", () => {
    expect(ogImageUrl(SITE, R2)).toBe("https://pub-example.r2.dev/og-image.jpg");
  });

  it("베이스가 비면 사이트 절대 주소로 메운다", () => {
    expect(ogImageUrl(SITE, "")).toBe("https://example.com/images/og-image.jpg");
  });

  it("경로형 베이스도 사이트 주소를 붙여 절대 URL 로 만든다", () => {
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
    expect(ogImageUrl(SITE, R2)).toMatch(/\.jpg$/);
  });
});

describe("환경변수 폴백", () => {
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
