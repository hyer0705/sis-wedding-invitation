import { assetUrl, readImageBase } from "./imageUrl";

export const BGM_FILE = "bgm.mp3";

const LOCAL_FALLBACK = `/audio/${BGM_FILE}`;

export function bgmUrl(base?: string): string {
  const resolved = (base ?? readImageBase())?.trim();
  return resolved ? assetUrl(BGM_FILE, resolved) : LOCAL_FALLBACK;
}
