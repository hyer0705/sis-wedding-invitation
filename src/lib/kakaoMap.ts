// MP-01 — 카카오맵 SDK 로더. 지도는 이 파일이 스크립트를 붙인 뒤에야 그릴 수 있다.
//
// index.html 에 script 태그를 박지 않는 이유가 둘 있다. 하나는 키가 없는 환경(로컬,
// CI, 키를 넣지 않은 프리뷰)에서 지도만 조용히 빠지고 나머지 섹션은 그대로 나와야 하기
// 때문이고, 다른 하나는 커버·갤러리 사진이 먼저 떠야 해서다. 지도 SDK 는 하객이 그
// 자리까지 내려온 뒤에 받아도 늦지 않다.

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
    // 공유에 쓰는 Kakao(대문자)와는 다른 객체다. 지도 SDK 는 소문자 kakao 에 붙는다.
    kakao?: { maps?: KakaoMapsNamespace };
  }
}

const KAKAO_KEY = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;

const SCRIPT_ID = "kakao-maps-sdk";

// 섹션이 두 번 그려져도(StrictMode 의 이중 실행) 스크립트는 한 번만 받는다.
let pending: Promise<KakaoMapsNamespace | null> | null = null;

/**
 * 지도 SDK 를 받아 준비된 네임스페이스를 돌려준다. 키가 없거나 받기에 실패하면 null 이다.
 *
 * `autoload=false` 로 받아 `kakao.maps.load()` 를 직접 부르는 것은, 스크립트 onload 가
 * 곧 지도 모듈 준비 완료를 뜻하지 않기 때문이다. 이 단계를 건너뛰면 첫 렌더에서
 * `kakao.maps.Map` 이 없다며 깨진다.
 */
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
      // 이미 다 받아 둔 스크립트라면 load 가 다시 오지 않는다.
      if (window.kakao?.maps) ready();
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&autoload=false`;
    script.addEventListener("load", ready, { once: true });
    // 키가 틀렸거나 도메인이 등록되지 않았을 때. 여기서 걸러야 지도 자리가 정적 안내로 남는다.
    script.addEventListener("error", () => resolve(null), { once: true });
    document.head.appendChild(script);
  });

  return pending;
}

/**
 * 마커 이미지맵의 `area` 에 대체 텍스트를 채우고, 이후에 생기는 것도 계속 채운다.
 *
 * 카카오는 마커에 `<area alt="" href="javascript:void(0)">` 를 붙인다. alt 가 빈 채로
 * 링크 구실을 하는 요소라 접근성 검사(axe `area-alt`)가 critical 로 잡고, 이는 M3 완료
 * 조건인 "critical/serious 0건"에 걸린다. SDK 가 만드는 DOM 이라 밖에서 채워 줄 수밖에 없다.
 *
 * 정해진 횟수만 확인하고 마는 대신 계속 지켜보는 이유는, 마커가 붙는 시점이 타일 로딩에
 * 매여 있어 느린 회선에서는 한참 뒤에 올 수 있어서다. 시간을 정해 두면 그 뒤에 온 마커를
 * 놓치고, 하필 CI 는 지도 키가 없어 이 경로를 아예 타지 않으므로 놓친 것이 드러나지도 않는다.
 *
 * 되돌려주는 함수로 감시를 멈춘다.
 */
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

/**
 * 목적지 한 곳에 마커를 찍은 지도를 그린다. 스크롤·드래그는 막는다 — 아래 설명 참고.
 *
 * 되돌려주는 함수를 부르면 마커 감시를 멈춘다. 섹션을 벗어날 때 정리용이다.
 */
export function drawVenueMap(
  maps: KakaoMapsNamespace,
  container: HTMLElement,
  place: { lat: number; lng: number; label: string },
): () => void {
  const center = new maps.LatLng(place.lat, place.lng);
  const map = new maps.Map(container, {
    center,
    level: 4,
    // 손가락으로 지도를 끌면 페이지가 아니라 지도가 움직여, 하객이 청첩장을 더 내려보지
    // 못하고 갇힌다. 지도는 위치만 보여 주고, 확대·이동은 아래 지도 앱 버튼이 맡는다.
    //
    // 이것만으로는 부족하다 — 카카오가 자기 요소에 touch-action:none 을 걸어 페이지
    // 세로 스크롤까지 함께 막는다. 그쪽은 global.css 의 .venue-map 규칙이 되돌린다.
    draggable: false,
    scrollwheel: false,
  });
  new maps.Marker({ map, position: center });

  return labelMarkerAreas(container, place.label);
}
