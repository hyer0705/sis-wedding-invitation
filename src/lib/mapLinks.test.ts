import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isMobileDevice,
  kakaoMapUrl,
  naverAppUrl,
  naverWebUrl,
  openWithFallback,
  tmapAppUrl,
  tmapStoreUrl,
  type Place,
} from "./mapLinks";

const PLACE: Place = { name: "신도림 웨스턴베니비스", lat: 37.507009, lng: 126.890296 };

const IPAD_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15";
const MAC_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36";

describe("naverAppUrl", () => {
  it("좌표와 이름을 담아 네이버지도 앱을 연다", () => {
    const url = new URL(naverAppUrl(PLACE, "hb-hj-wedding.com"));

    expect(url.protocol).toBe("nmap:");
    expect(url.searchParams.get("lat")).toBe("37.507009");
    expect(url.searchParams.get("lng")).toBe("126.890296");
    expect(url.searchParams.get("name")).toBe(PLACE.name);
  });

  it("호출자 식별자를 함께 넘긴다 — 없으면 앱이 열리지 않는다", () => {
    const url = new URL(naverAppUrl(PLACE, "hb-hj-wedding.com"));

    expect(url.searchParams.get("appname")).toBe("hb-hj-wedding.com");
  });

  it("공백을 + 가 아니라 %20 으로 인코딩한다", () => {
    const url = naverAppUrl(PLACE, "example.com");

    expect(url).toContain("%20");
    expect(url).not.toContain("+");
  });
});

describe("naverWebUrl", () => {
  it("앱이 없을 때 열 웹 지도는 예식장 이름으로 찾는다", () => {
    expect(naverWebUrl(PLACE)).toBe(`https://map.naver.com/p/search/${encodeURIComponent(PLACE.name)}`);
  });
});

describe("kakaoMapUrl", () => {
  it("이름,위도,경도 순서로 길찾기 주소를 만든다", () => {
    expect(decodeURIComponent(kakaoMapUrl(PLACE))).toBe(`https://map.kakao.com/link/to/${PLACE.name},37.507009,126.890296`);
  });

  it("앱과 웹을 함께 처리하는 https 주소다", () => {
    expect(kakaoMapUrl(PLACE).startsWith("https://")).toBe(true);
  });
});

describe("tmapAppUrl", () => {
  it("x 에 경도를, y 에 위도를 싣는다", () => {
    const url = new URL(tmapAppUrl(PLACE));

    expect(url.searchParams.get("goalx")).toBe("126.890296");
    expect(url.searchParams.get("goaly")).toBe("37.507009");
  });

  it("iOS 가 읽는 이름으로도 같은 값을 넣는다", () => {
    const url = new URL(tmapAppUrl(PLACE));

    expect(url.searchParams.get("rGoX")).toBe(url.searchParams.get("goalx"));
    expect(url.searchParams.get("rGoY")).toBe(url.searchParams.get("goaly"));
    expect(url.searchParams.get("rGoName")).toBe(PLACE.name);
  });

  it("목적지 이름의 공백을 + 로 바꾸지 않는다", () => {
    expect(tmapAppUrl(PLACE)).not.toContain("+");
  });
});

describe("tmapStoreUrl", () => {
  it("아이폰이면 App Store 로 보낸다", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";

    expect(tmapStoreUrl(ua)).toContain("apps.apple.com");
  });

  it("그 밖에는 Play 스토어로 보낸다", () => {
    const ua = "Mozilla/5.0 (Linux; Android 14; SM-S911N) AppleWebKit/537.36";

    expect(tmapStoreUrl(ua)).toContain("play.google.com");
  });

  it("아이패드는 데스크톱을 자처해도 App Store 로 보낸다", () => {
    expect(tmapStoreUrl(IPAD_UA, 5)).toContain("apps.apple.com");
  });
});

describe("isMobileDevice", () => {
  it("아이폰과 안드로이드는 모바일이다", () => {
    expect(isMobileDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(true);
    expect(isMobileDevice("Mozilla/5.0 (Linux; Android 14; SM-S911N)")).toBe(true);
  });

  it("PC 는 모바일이 아니다", () => {
    expect(isMobileDevice(MAC_UA)).toBe(false);
    expect(isMobileDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0")).toBe(false);
  });

  it("아이패드는 맥과 UA 가 같아도 터치 지점 수로 갈린다", () => {
    expect(isMobileDevice(IPAD_UA, 5)).toBe(true);
    expect(isMobileDevice(MAC_UA, 0)).toBe(false);
  });
});

describe("openWithFallback", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("먼저 앱 주소로 이동한다", () => {
    vi.useFakeTimers();
    const navigate = vi.fn();

    openWithFallback("tmap://route", "https://example.com", { navigate, isVisible: () => true });

    expect(navigate).toHaveBeenCalledExactlyOnceWith("tmap://route");
  });

  it("기다린 뒤에도 페이지가 그대로면 앱이 없다고 보고 대체 주소로 보낸다", () => {
    vi.useFakeTimers();
    const navigate = vi.fn();

    openWithFallback("tmap://route", "https://example.com", { delayMs: 1200, navigate, isVisible: () => true });
    vi.advanceTimersByTime(1200);

    expect(navigate).toHaveBeenLastCalledWith("https://example.com");
  });

  it("앱이 열려 페이지가 숨겨졌으면 대체 주소로 보내지 않는다", () => {
    vi.useFakeTimers();
    const navigate = vi.fn();

    openWithFallback("tmap://route", "https://example.com", { delayMs: 1200, navigate, isVisible: () => false });
    vi.advanceTimersByTime(1200);

    expect(navigate).toHaveBeenCalledExactlyOnceWith("tmap://route");
  });

  it("취소하면 예약된 이동이 일어나지 않는다", () => {
    vi.useFakeTimers();
    const navigate = vi.fn();

    const cancel = openWithFallback("tmap://route", "https://example.com", { delayMs: 1200, navigate, isVisible: () => true });
    cancel();
    vi.advanceTimersByTime(1200);

    expect(navigate).toHaveBeenCalledExactlyOnceWith("tmap://route");
  });

  it("앱이 떠서 페이지가 숨겨지면 그 자리에서 폴백을 버린다", () => {
    vi.useFakeTimers();
    const navigate = vi.fn();
    let hide = () => {};

    openWithFallback("tmap://route", "https://example.com", {
      delayMs: 1200,
      navigate,
      isVisible: () => true,
      onHidden: (handler) => {
        hide = handler;
        return () => {};
      },
    });
    hide();
    vi.advanceTimersByTime(1200);

    expect(navigate).toHaveBeenCalledExactlyOnceWith("tmap://route");
  });

  it("정지됐다 뒤늦게 깨어난 타이머는 폴백하지 않는다", () => {
    vi.useFakeTimers();
    const navigate = vi.fn();
    const clock = [0, 30_000];

    openWithFallback("tmap://route", "https://example.com", {
      delayMs: 1200,
      navigate,
      isVisible: () => true,
      now: () => clock.shift() ?? 30_000,
      onHidden: () => () => {},
    });
    vi.advanceTimersByTime(1200);

    expect(navigate).toHaveBeenCalledExactlyOnceWith("tmap://route");
  });

  it("정상 범위 안에서 깨어났으면 폴백한다", () => {
    vi.useFakeTimers();
    const navigate = vi.fn();
    const clock = [0, 1300];

    openWithFallback("tmap://route", "https://example.com", {
      delayMs: 1200,
      navigate,
      isVisible: () => true,
      now: () => clock.shift() ?? 1300,
      onHidden: () => () => {},
    });
    vi.advanceTimersByTime(1200);

    expect(navigate).toHaveBeenLastCalledWith("https://example.com");
  });
});
