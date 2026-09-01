export type Place = {
  name: string;
  lat: number;
  lng: number;
};

const TMAP_STORE = {
  ios: "https://apps.apple.com/kr/app/id431589174",
  android: "https://play.google.com/store/apps/details?id=com.skt.tmap.ku",
};

function toQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
}

export function naverAppUrl(place: Place, appName: string): string {
  const query = toQuery({
    lat: String(place.lat),
    lng: String(place.lng),
    name: place.name,
    appname: appName,
  });
  return `nmap://place?${query}`;
}

export function naverWebUrl(place: Place): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(place.name)}`;
}

export function kakaoMapUrl(place: Place): string {
  const target = [place.name, place.lat, place.lng].join(",");
  return `https://map.kakao.com/link/to/${encodeURIComponent(target)}`;
}

export function tmapAppUrl(place: Place): string {
  const query = toQuery({
    goalname: place.name,
    goalx: String(place.lng),
    goaly: String(place.lat),
    rGoName: place.name,
    rGoX: String(place.lng),
    rGoY: String(place.lat),
  });
  return `tmap://route?${query}`;
}

function isIosDevice(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

export function isMobileDevice(userAgent: string, maxTouchPoints = 0): boolean {
  return /Android|Windows Phone/i.test(userAgent) || isIosDevice(userAgent, maxTouchPoints);
}

export function tmapStoreUrl(userAgent: string, maxTouchPoints = 0): string {
  return isIosDevice(userAgent, maxTouchPoints) ? TMAP_STORE.ios : TMAP_STORE.android;
}

type OpenOptions = {
  delayMs?: number;
  navigate?: (url: string) => void;
  isVisible?: () => boolean;
  now?: () => number;
  onHidden?: (handler: () => void) => () => void;
};

const defaultNavigate = (url: string) => {
  window.location.href = url;
};

const defaultIsVisible = () => document.visibilityState === "visible";

const defaultOnHidden = (handler: () => void) => {
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") handler();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pagehide", handler);

  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", handler);
  };
};

export function openWithFallback(appUrl: string, fallbackUrl: string, options: OpenOptions = {}): () => void {
  const {
    delayMs = 1200,
    navigate = defaultNavigate,
    isVisible = defaultIsVisible,
    now = () => Date.now(),
    onHidden = defaultOnHidden,
  } = options;

  const startedAt = now();
  let settled = false;
  let timer = 0;
  let unsubscribe: () => void = () => {};

  const claim = () => {
    if (settled) return false;
    settled = true;
    if (timer) window.clearTimeout(timer);
    unsubscribe();
    return true;
  };

  unsubscribe = onHidden(claim);

  navigate(appUrl);

  timer = window.setTimeout(() => {
    if (!claim()) return;
    if (!isVisible()) return;
    if (now() - startedAt > delayMs * 2) return;
    navigate(fallbackUrl);
  }, delayMs);

  return () => {
    claim();
  };
}
