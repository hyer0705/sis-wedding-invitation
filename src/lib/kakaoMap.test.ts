import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { drawVenueMap } from "./kakaoMap";

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
    drawVenueMap(fakeMaps(), container, PLACE);

    expect(mapOptions?.draggable).toBe(false);
    expect(mapOptions?.scrollwheel).toBe(false);
  });

  it("마커 이미지맵의 빈 alt 를 채운다", () => {
    const area = document.createElement("area");
    area.setAttribute("href", "javascript:void(0)");
    area.setAttribute("alt", "");
    container.appendChild(area);

    drawVenueMap(fakeMaps(), container, PLACE);

    expect(area.getAttribute("alt")).toBe(PLACE.label);
  });

  it("마커가 한참 뒤에 붙어도 채운다", async () => {
    drawVenueMap(fakeMaps(), container, PLACE);

    const area = document.createElement("area");
    area.setAttribute("href", "javascript:void(0)");
    area.setAttribute("alt", "");
    container.appendChild(area);
    await waitFor(() => expect(area.getAttribute("alt")).toBe(PLACE.label));
  });

  it("이미 대체 텍스트가 있으면 건드리지 않는다", () => {
    const area = document.createElement("area");
    area.setAttribute("href", "javascript:void(0)");
    area.setAttribute("alt", "카카오가 넣어 준 설명");
    container.appendChild(area);

    drawVenueMap(fakeMaps(), container, PLACE);

    expect(area.getAttribute("alt")).toBe("카카오가 넣어 준 설명");
  });

  it("정리하면 더 이상 마커를 지켜보지 않는다", async () => {
    const dispose = drawVenueMap(fakeMaps(), container, PLACE);
    dispose();

    const area = document.createElement("area");
    area.setAttribute("href", "javascript:void(0)");
    area.setAttribute("alt", "");
    container.appendChild(area);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(area.getAttribute("alt")).toBe("");
  });
});
