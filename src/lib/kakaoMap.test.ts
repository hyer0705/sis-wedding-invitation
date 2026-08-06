import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { drawVenueMap } from "./kakaoMap";

// 지도 SDK 는 CI 에 키가 없어 실물로 검증할 수 없다. 대신 네임스페이스를 흉내 내
// "우리가 SDK 에 무엇을 시키는지"와 마커 대체 텍스트 처리를 고정한다.

type Recorded = { center: unknown; level: number; draggable?: boolean; scrollwheel?: boolean };

let mapOptions: Recorded | null = null;
let markerCount = 0;

function fakeMaps() {
  return {
    load: (cb: () => void) => cb(),
    LatLng: class {
      constructor(
        readonly lat: number,
        readonly lng: number,
      ) {}
    },
    Map: class {
      constructor(_container: HTMLElement, options: Recorded) {
        mapOptions = options;
      }
    },
    Marker: class {
      constructor() {
        markerCount += 1;
      }
    },
  } as unknown as Parameters<typeof drawVenueMap>[0];
}

const PLACE = { lat: 37.507009, lng: 126.890296, label: "신도림 웨스턴베니비스 위치" };

let container: HTMLElement;

beforeEach(() => {
  mapOptions = null;
  markerCount = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
  vi.useRealTimers();
});

describe("drawVenueMap", () => {
  it("예식장 좌표를 중심으로 지도를 만들고 마커를 하나 찍는다", () => {
    drawVenueMap(fakeMaps(), container, PLACE);

    expect(mapOptions?.center).toMatchObject({ lat: PLACE.lat, lng: PLACE.lng });
    expect(markerCount).toBe(1);
  });

  it("지도를 끌거나 확대할 수 없게 둔다", () => {
    // 지도가 제스처를 가져가면 하객이 청첩장을 더 내려보지 못한다.
    drawVenueMap(fakeMaps(), container, PLACE);

    expect(mapOptions?.draggable).toBe(false);
    expect(mapOptions?.scrollwheel).toBe(false);
  });

  it("마커 이미지맵의 빈 alt 를 채운다", () => {
    // axe area-alt 가 critical 로 잡는 요소다. SDK 가 만드는 DOM 이라 밖에서 채운다.
    const area = document.createElement("area");
    area.setAttribute("href", "javascript:void(0)");
    area.setAttribute("alt", "");
    container.appendChild(area);

    drawVenueMap(fakeMaps(), container, PLACE);

    expect(area.getAttribute("alt")).toBe(PLACE.label);
  });

  it("마커가 늦게 붙어도 다시 확인해 채운다", () => {
    vi.useFakeTimers();
    drawVenueMap(fakeMaps(), container, PLACE);

    // 타일 로딩이 끝난 뒤에야 마커 DOM 이 들어오는 경우
    const area = document.createElement("area");
    area.setAttribute("href", "javascript:void(0)");
    area.setAttribute("alt", "");
    container.appendChild(area);
    vi.advanceTimersByTime(500);

    expect(area.getAttribute("alt")).toBe(PLACE.label);
  });

  it("이미 대체 텍스트가 있으면 건드리지 않는다", () => {
    const area = document.createElement("area");
    area.setAttribute("href", "javascript:void(0)");
    area.setAttribute("alt", "카카오가 넣어 준 설명");
    container.appendChild(area);

    drawVenueMap(fakeMaps(), container, PLACE);

    expect(area.getAttribute("alt")).toBe("카카오가 넣어 준 설명");
  });

  it("마커가 끝내 나타나지 않아도 타이머를 무한정 돌리지 않는다", () => {
    vi.useFakeTimers();
    drawVenueMap(fakeMaps(), container, PLACE);

    vi.advanceTimersByTime(10_000);

    expect(vi.getTimerCount()).toBe(0);
  });
});
