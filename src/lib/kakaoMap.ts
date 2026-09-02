type KakaoLatLng = { readonly __brand: "LatLng" };
type KakaoMapInstance = { readonly __brand: "Map" };

type KakaoMapsNamespace = {
  load: (callback: () => void) => void;
  LatLng: new (lat: number, lng: number) => KakaoLatLng;
  Map: new (
    container: HTMLElement,
    options: { center: KakaoLatLng; level: number; draggable?: boolean; scrollwheel?: boolean },
  ) => KakaoMapInstance;
  Marker: new (options: { map: KakaoMapInstance; position: KakaoLatLng }) => unknown;
};

declare global {
  interface Window {
    kakao?: { maps?: KakaoMapsNamespace };
  }
}

const KAKAO_KEY = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;

const SCRIPT_ID = "kakao-maps-sdk";

let pending: Promise<KakaoMapsNamespace | null> | null = null;

export function loadKakaoMaps(): Promise<KakaoMapsNamespace | null> {
  if (pending) return pending;
  if (!KAKAO_KEY) return Promise.resolve(null);

  pending = new Promise<KakaoMapsNamespace | null>((resolve) => {
    const ready = () => {
      const maps = window.kakao?.maps;
      if (!maps) {
        resolve(null);
        return;
      }
      maps.load(() => resolve(maps));
    };

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", ready, { once: true });
      if (window.kakao?.maps) ready();
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false`;
    script.addEventListener("load", ready, { once: true });
    script.addEventListener("error", () => resolve(null), { once: true });
    document.head.appendChild(script);
  });

  return pending;
}

function labelMarkerAreas(container: HTMLElement, label: string): () => void {
  const fill = () => {
    for (const area of container.querySelectorAll("area")) {
      if (!area.getAttribute("alt")) area.setAttribute("alt", label);
    }
  };

  fill();

  const observer = new MutationObserver(fill);
  observer.observe(container, { childList: true, subtree: true });

  return () => observer.disconnect();
}

export function drawVenueMap(
  maps: KakaoMapsNamespace,
  container: HTMLElement,
  place: { lat: number; lng: number; label: string },
): () => void {
  const center = new maps.LatLng(place.lat, place.lng);
  const map = new maps.Map(container, {
    center,
    level: 4,
    draggable: false,
    scrollwheel: false,
  });
  new maps.Marker({ map, position: center });

  return labelMarkerAreas(container, place.label);
}
