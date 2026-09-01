export const IMAGE_WIDTHS = [480, 960] as const;

export type ImageWidth = (typeof IMAGE_WIDTHS)[number];

const LOCAL_FALLBACK = "/images";

function normalizeBase(raw: string | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) return LOCAL_FALLBACK;
  return trimmed.replace(/\/+$/, "");
}

export function imageUrl(name: string, width: ImageWidth, base?: string): string {
  return `${normalizeBase(base ?? readImageBase())}/${name}-${width}.webp`;
}

export function imageSrcSet(name: string, base?: string): string {
  return IMAGE_WIDTHS.map((w) => `${imageUrl(name, w, base)} ${w}w`).join(", ");
}

export function assetUrl(file: string, base?: string): string {
  return `${normalizeBase(base ?? readImageBase())}/${file}`;
}

export const OG_IMAGE_FILE = "og-image.jpg";

export function ogImageUrl(siteUrl: string, base?: string): string {
  const resolved = normalizeBase(base ?? readImageBase());
  const origin = siteUrl.replace(/\/+$/, "");
  return /^https?:\/\//.test(resolved) ? `${resolved}/${OG_IMAGE_FILE}` : `${origin}${resolved}/${OG_IMAGE_FILE}`;
}

export function readImageBase(): string | undefined {
  const env = (import.meta.env ?? {}) as Record<string, string | undefined>;
  return env.VITE_IMAGE_BASE_URL;
}
