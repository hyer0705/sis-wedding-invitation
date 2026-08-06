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
 * 쿼리 문자열을 만든다.
 *
 * URLSearchParams 를 쓰지 않는 이유는 그것이 폼 인코딩(application/x-www-form-urlencoded)
 * 규칙이라 공백을 `%20` 이 아니라 `+` 로 바꾸기 때문이다. 지도 앱이 값을 퍼센트 디코딩으로만
 * 풀면 `+` 가 그대로 남아, 목적지 이름이 "신도림+웨스턴베니비스"로 보인다. 좌표는 숫자라
 * 길 안내 자체는 되지만 하객에게 예식장 이름이 깨져 보인다.
 */
function toQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
}

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
  const query = toQuery({
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
  now?: () => number;
  /** 페이지가 숨겨지는 순간을 알린다. 되돌려주는 함수로 구독을 끊는다. */
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
  // iOS Safari 는 앱으로 넘어갈 때 visibilitychange 없이 pagehide 만 주는 경우가 있다.
  window.addEventListener("pagehide", handler);

  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pagehide", handler);
  };
};

/**
 * 앱 스킴을 시도하고, 앱이 열리지 않았을 때만 대체 주소로 보낸다.
 *
 * 브라우저는 스킴 이동의 성공·실패를 알려주지 않으므로 "페이지가 아직 보이는가"로 판단한다.
 * 시간을 넉넉히(1.2초) 잡는 것은 카카오톡 인앱 브라우저 때문이다. 앱 전환이 일반 브라우저보다
 * 느려 짧게 잡으면 앱이 뜨는 도중에 폴백이 끼어들어, 하객은 앱과 스토어가 연달아 열리는 것을 본다.
 *
 * 판단을 세 겹으로 두는 이유는 타이머 하나만으로는 정반대 결과가 나오기 때문이다.
 *
 *   1. 숨겨지는 순간 취소 — 앱이 뜨면 그 자리에서 폴백을 버린다.
 *   2. 깨어난 시점의 가시성 — 그때까지 보이고 있으면 앱이 없다고 본다.
 *   3. 경과 시간 — 예정보다 한참 늦게 깨어났다면 그동안 정지돼 있었다는 뜻이다.
 *
 * 3번이 필요한 것은 iOS 가 앱 전환 중 JS 실행을 정지시키기 때문이다. 정지된 타이머는 하객이
 * 청첩장으로 돌아온 뒤에야 깨어나고 그 순간 페이지는 다시 "보이는" 상태다. 2번만 두면 앱이
 * 있는 하객이 돌아올 때마다 스토어로 튕겨 나간다 — 앱이 없는 사람보다 있는 사람이 더 많이
 * 겪는 오작동이라 이쪽이 더 나쁘다.
 *
 * 되돌려주는 함수를 부르면 예약된 폴백을 취소한다.
 */
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
  // 0 은 setTimeout 이 돌려주지 않는 값이라 "아직 예약 전"을 뜻한다.
  let timer = 0;
  let unsubscribe: () => void = () => {};

  /** 폴백을 여기서 끝낸다. 처음 부른 쪽만 true 를 받는다 — 뒤늦은 호출은 아무것도 하지 않는다. */
  const claim = () => {
    if (settled) return false;
    settled = true;
    if (timer) window.clearTimeout(timer);
    unsubscribe();
    return true;
  };

  // 1. 앱이 열려 페이지가 숨겨지면 폴백을 그 자리에서 버린다.
  unsubscribe = onHidden(claim);

  navigate(appUrl);

  timer = window.setTimeout(() => {
    if (!claim()) return;
    if (!isVisible()) return; // 2. 앱으로 넘어갔다
    if (now() - startedAt > delayMs * 2) return; // 3. 정지됐다 재개된 타이머다
    navigate(fallbackUrl);
  }, delayMs);

  return () => {
    claim();
  };
}
