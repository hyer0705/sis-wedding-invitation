import { afterEach, describe, expect, it, vi } from "vitest";
import { kakaoMapUrl, naverAppUrl, naverWebUrl, openWithFallback, tmapAppUrl, tmapStoreUrl, type Place } from "./mapLinks";

// 좌표가 어긋나면 하객이 엉뚱한 건물 앞에 선다. 링크 형식은 눈으로 확인하기 어려우므로
// 값이 어느 자리에 실리는지를 고정해 둔다. 특히 티맵은 x 가 경도라 순서가 뒤집히기 쉽다.
const PLACE: Place = { name: "신도림 웨스턴베니비스", lat: 37.507009, lng: 126.890296 };

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

  it("공백이 들어간 예식장 이름을 인코딩한다", () => {
    expect(naverAppUrl(PLACE, "example.com")).not.toContain(" ");
  });
});

describe("naverWebUrl", () => {
  it("앱이 없을 때 열 웹 지도는 예식장 이름으로 찾는다", () => {
    expect(naverWebUrl(PLACE)).toBe(`https://map.naver.com/p/search/${encodeURIComponent(PLACE.name)}`);
  });
});

describe("kakaoMapUrl", () => {
  it("이름,위도,경도 순서로 길찾기 주소를 만든다", () => {
    // 순서를 뒤집으면 카카오가 조용히 엉뚱한 곳을 찍는다.
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

    // 앱으로 넘어간 상태. 여기서 폴백이 나가면 돌아왔을 때 스토어가 떠 있다.
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
});
