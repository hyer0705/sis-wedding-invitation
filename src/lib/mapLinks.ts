// MP-03 — 길찾기 3종. 앱을 직접 여는 주소와, 앱이 없을 때 갈 곳을 함께 만든다.
//
// 세 서비스가 요구하는 형태가 제각각이라 하나로 묶지 못했다.
//   네이버지도 — nmap:// 스킴만 앱을 연다. 앱이 없으면 아무 일도 일어나지 않으므로
//                웹 지도를 따로 준비한다.
//   카카오맵   — map.kakao.com/link 주소 하나로 앱과 웹이 모두 처리된다. 스킴이 필요 없다.
//   티맵       — 스킴만 있고 웹 지도가 없다. 앱이 없으면 스토어로 보낸다.
//
// 카카오'내비'가 아니라 카카오'맵'인 이유: 카카오내비는 JavaScript SDK 로만 열 수 있고
// (Kakao.Navi.start), SDK 1.41.0 부터는 앱이 없는 사람을 설치 페이지로만 보낸다. 지도
// 키가 없는 환경에서도 길찾기가 동작해야 한다는 조건과, 앱이 없는 하객을 스토어로 튕겨
// 보내지 않아야 한다는 점에서 카카오맵 링크가 맞다. 버튼 라벨도 실제로 열리는 앱 이름을
// 적는다 — "카카오내비"라 써 두고 카카오맵이 열리면 그게 더 혼란스럽다.

export type Place = {
  /** 지도 앱에 목적지 이름으로 표시된다. */
  name: string;
  lat: number;
  lng: number;
};

/** 티맵 앱이 없을 때 보낼 스토어. iOS 앱 ID·안드로이드 패키지는 2026-08-06 기준 확인값이다. */
const TMAP_STORE = {
  ios: "https://apps.apple.com/kr/app/id431589174",
  android: "https://play.google.com/store/apps/details?id=com.skt.tmap.ku",
};

/**
 * 네이버지도 앱에서 목적지를 띄운다.
 *
 * 길찾기(`nmap://route/*`)가 아니라 장소 표시(`nmap://place`)인 것은, 출발지를 넘기지
 * 않으면 앱이 위치 권한을 먼저 묻고 그 사이 화면이 비기 때문이다. 장소를 띄우면 하객이
 * 대중교통·자동차를 직접 고를 수 있다.
 *
 * `appname` 은 네이버가 요구하는 호출자 식별자다. 웹에서는 도메인을 적는다.
 */
export function naverAppUrl(place: Place, appName: string): string {
  const query = new URLSearchParams({
    lat: String(place.lat),
    lng: String(place.lng),
    name: place.name,
    appname: appName,
  });
  return `nmap://place?${query}`;
}

/** 네이버지도 앱이 없을 때 열 웹 지도. 좌표가 아니라 이름으로 찾는다 — 주소가 바뀌어도 따라온다. */
export function naverWebUrl(place: Place): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(place.name)}`;
}

/**
 * 카카오맵 길찾기. 앱이 있으면 앱이, 없으면 웹 지도가 열린다 — 폴백이 따로 필요 없다.
 * 경로 조각의 순서는 카카오가 정한 `이름,위도,경도`다.
 */
export function kakaoMapUrl(place: Place): string {
  const target = [place.name, place.lat, place.lng].join(",");
  return `https://map.kakao.com/link/to/${encodeURIComponent(target)}`;
}

/**
 * 티맵 목적지 안내.
 *
 * 파라미터를 두 벌 넣는 것은 iOS 와 안드로이드가 서로 다른 이름을 읽기 때문이다
 * (iOS `rGoName`·`rGoX`·`rGoY`, 안드로이드 `goalname`·`goalx`·`goaly`). 티맵은 URL
 * 스킴을 공식 문서로 내놓지 않아 한쪽만 넣으면 다른 기기에서 조용히 실패한다. 읽지 않는
 * 파라미터는 그냥 무시된다.
 *
 * x 가 경도, y 가 위도다 — 다른 두 서비스와 순서가 반대라 헷갈리기 쉽다.
 */
export function tmapAppUrl(place: Place): string {
  const query = new URLSearchParams({
    goalname: place.name,
    goalx: String(place.lng),
    goaly: String(place.lat),
    rGoName: place.name,
    rGoX: String(place.lng),
    rGoY: String(place.lat),
  });
  return `tmap://route?${query}`;
}

/** 티맵 앱이 없을 때 보낼 스토어. 판별에 실패하면 안드로이드로 본다(국내 점유율 기준). */
export function tmapStoreUrl(userAgent: string): string {
  return /iPhone|iPad|iPod/i.test(userAgent) ? TMAP_STORE.ios : TMAP_STORE.android;
}

type OpenOptions = {
  /** 앱이 열릴 때까지 기다리는 시간(ms). */
  delayMs?: number;
  navigate?: (url: string) => void;
  /** 페이지가 여전히 화면에 있는지. 앱이 열렸다면 거짓이 된다. */
  isVisible?: () => boolean;
};

const defaultNavigate = (url: string) => {
  window.location.href = url;
};

const defaultIsVisible = () => document.visibilityState === "visible";

/**
 * 앱 스킴을 시도하고, 앱이 열리지 않았으면 대체 주소로 보낸다.
 *
 * 브라우저는 스킴 이동의 성공·실패를 알려주지 않는다. 앱이 열리면 페이지가 뒤로 밀려
 * 숨겨지므로, 정해진 시간 뒤에도 페이지가 그대로 보이고 있으면 앱이 없다고 본다.
 *
 * 시간을 넉넉히(1.2초) 잡는 이유는 카카오톡 인앱 브라우저 때문이다. 앱 전환이 일반
 * 브라우저보다 느려 짧게 잡으면 앱이 뜨는 도중에 폴백이 끼어들고, 하객은 앱과 스토어가
 * 연달아 열리는 것을 보게 된다.
 *
 * 되돌려주는 함수를 부르면 예약된 폴백을 취소한다 — 화면을 벗어날 때 정리용이다.
 */
export function openWithFallback(appUrl: string, fallbackUrl: string, options: OpenOptions = {}): () => void {
  const { delayMs = 1200, navigate = defaultNavigate, isVisible = defaultIsVisible } = options;

  navigate(appUrl);

  const timer = window.setTimeout(() => {
    if (!isVisible()) return; // 앱으로 넘어갔다
    navigate(fallbackUrl);
  }, delayMs);

  return () => window.clearTimeout(timer);
}
