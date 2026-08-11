// 사진은 Cloudflare R2 에 두고 여기서 URL 을 만든다 (SIS-28).
//
// `VITE_IMAGE_BASE_URL` 이 비어 있으면 `/images` 로 폴백한다. 폴백을 두는 이유는
// .env 없이 clone 한 사람과 CI 가 R2 없이도 개발·테스트를 돌릴 수 있게 하기
// 위함이다 — `npm run optimize` 산출물이 로컬 public/images/ 에 그대로 남는다.
// 배포에서 베이스 URL 이 비어 있는 것은 배포 게이트(`npm run verify`)가 잡는다.

/** `npm run optimize` 가 만드는 너비 2벌. 여기 값이 파일명 접미사가 된다. */
export const IMAGE_WIDTHS = [480, 960] as const;

export type ImageWidth = (typeof IMAGE_WIDTHS)[number];

const LOCAL_FALLBACK = "/images";

/** 뒤에 붙는 슬래시를 떼어 `base + "/" + 파일명` 조합이 항상 한 겹이 되게 한다. */
function normalizeBase(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) return LOCAL_FALLBACK;
  return trimmed.replace(/\/+$/, "");
}

/**
 * 최적화 산출물의 URL 을 만든다.
 *
 * @param name  확장자·너비 접미사를 뺀 이름 (예: `wedding_1`)
 * @param width `IMAGE_WIDTHS` 중 하나
 * @param base  베이스 URL. 생략하면 `VITE_IMAGE_BASE_URL`
 */
export function imageUrl(name: string, width: ImageWidth, base?: string): string {
  return `${normalizeBase(base ?? readBase())}/${name}-${width}.webp`;
}

/**
 * `srcSet` 문자열을 만든다. 너비 목록이 파일명과 디스크립터 양쪽에 쓰이므로
 * 호출부에서 두 번 적지 않도록 여기서 함께 만든다.
 */
export function imageSrcSet(name: string, base?: string): string {
  return IMAGE_WIDTHS.map((w) => `${imageUrl(name, w, base)} ${w}w`).join(", ");
}

/**
 * 카톡 공유 카드·OG 태그의 썸네일 파일. 사진 중에 유일한 JPEG 인데, 외부 스크래퍼의
 * WebP 지원이 제각각이라 이것만 형식을 달리한다.
 */
export const OG_IMAGE_FILE = "og-image.jpg";

/**
 * 공유 썸네일의 **절대** URL 을 만든다.
 *
 * 상대 경로를 쓰지 않는 이유는 카카오톡 스크래퍼가 절대 URL 만 읽기 때문이다. 예전에
 * share.ts 가 `${location.origin}/og-image.jpg` 를 썼는데, 파일은 R2 에만 있고
 * 배포본에는 없어서(SIS-28) 그 경로가 404 였다 — 카톡 카드에 썸네일이 통째로 빠진다.
 *
 * 베이스 URL 이 비면(로컬 폴백) 사이트 절대 주소로 메워 형태만 유지한다. 그 주소로
 * 실제로 받아올 수 있는지는 배포 게이트(`npm run verify`)가 확인한다.
 *
 * @param siteUrl 배포 주소(`INVITE.siteUrl`). 베이스 URL 이 없을 때만 쓰인다
 * @param base    이미지 베이스 URL. 생략하면 `VITE_IMAGE_BASE_URL`
 */
export function ogImageUrl(siteUrl: string, base?: string): string {
  const resolved = normalizeBase(base ?? readBase());
  const origin = siteUrl.replace(/\/+$/, "");
  return resolved === LOCAL_FALLBACK ? `${origin}${LOCAL_FALLBACK}/${OG_IMAGE_FILE}` : `${resolved}/${OG_IMAGE_FILE}`;
}

// Playwright(E2E)는 Vite 를 거치지 않고 이 파일을 읽을 수 있어 import.meta.env 가
// 없다. invite.ts 와 같은 방식으로 방어한다.
function readBase(): string | undefined {
  const env = (import.meta.env ?? {}) as Record<string, string | undefined>;
  return env.VITE_IMAGE_BASE_URL;
}
