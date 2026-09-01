import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMotion } from "../test/renderWithMotion";
import Location from "./Location";
import { INVITE } from "../invite";
import { openWithFallback } from "../lib/mapLinks";

vi.mock("../lib/kakaoMap", () => ({
  loadKakaoMaps: vi.fn().mockResolvedValue(null),
  drawVenueMap: vi.fn(),
}));

vi.mock("../lib/mapLinks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/mapLinks")>()),
  openWithFallback: vi.fn(() => () => {}),
}));

const writeText = vi.fn();

const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
const DESKTOP_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36";

function useDevice(userAgent: string, maxTouchPoints = 0) {
  Object.defineProperty(navigator, "userAgent", { value: userAgent, configurable: true });
  Object.defineProperty(navigator, "maxTouchPoints", { value: maxTouchPoints, configurable: true });
}

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  vi.mocked(openWithFallback).mockClear();
  useDevice(MOBILE_UA, 5);
});

afterEach(() => {
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "clipboard");
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "userAgent");
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "maxTouchPoints");
});

function setupUser() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return user;
}

const linkTo = (name: string) => screen.getByRole("link", { name });

describe("Location", () => {
  it("MP-02 예식장과 도로명 주소를 보여 준다", () => {
    renderWithMotion(<Location />);

    const title = screen.getByTestId("venue-title");
    expect(title).toHaveTextContent(INVITE.venue);
    expect(title).toHaveTextContent(INVITE.hall.split(" ")[0]);
    expect(title.querySelector("br")).not.toBeNull();
    expect(screen.getByText(INVITE.address)).toBeInTheDocument();
  });

  it("c안의 옛 주소가 남아 있지 않다", () => {
    renderWithMotion(<Location />);

    expect(screen.queryByText(/경인로 577/)).not.toBeInTheDocument();
  });

  it("MP-03 지도 앱 세 곳으로 가는 링크가 있다", () => {
    renderWithMotion(<Location />);

    expect(linkTo("네이버지도")).toBeInTheDocument();
    expect(linkTo("카카오맵")).toBeInTheDocument();
    expect(linkTo("티맵")).toBeInTheDocument();
  });

  it("MP-03 각 버튼에 해당 앱 로고가 붙는다", () => {
    renderWithMotion(<Location />);

    const expected = {
      네이버지도: "logo-naver-map.webp",
      카카오맵: "logo-kakao-map.webp",
      티맵: "logo-tmap.webp",
    };

    for (const [label, file] of Object.entries(expected)) {
      const logo = linkTo(label).querySelector("img");
      expect(logo, `${label} 버튼에 로고가 없습니다`).not.toBeNull();
      expect(logo).toHaveAttribute("src", expect.stringContaining(file));
    }
  });

  it("로고가 라벨을 두 번 읽히게 하지 않는다", () => {
    renderWithMotion(<Location />);

    for (const label of ["네이버지도", "카카오맵", "티맵"]) {
      const link = linkTo(label);
      expect(link.querySelector("img")).toHaveAttribute("alt", "");
      expect(link.querySelector("img")).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("앱이 없는 하객도 갈 곳이 있도록 링크의 기본 주소는 웹이다", () => {
    renderWithMotion(<Location />);

    for (const label of ["네이버지도", "카카오맵", "티맵"]) {
      expect(linkTo(label)).toHaveAttribute("href", expect.stringMatching(/^https:\/\//));
    }
  });

  it("카카오맵 링크에 예식장 좌표가 실린다", () => {
    renderWithMotion(<Location />);

    const href = decodeURIComponent(linkTo("카카오맵").getAttribute("href") ?? "");
    expect(href).toContain(String(INVITE.coords.lat));
    expect(href).toContain(String(INVITE.coords.lng));
  });

  it("MP-04·05 지하철·버스·자가용·주차 안내가 모두 나온다", () => {
    renderWithMotion(<Location />);

    expect(screen.getByText("지하철")).toBeInTheDocument();
    expect(screen.getByText("버스")).toBeInTheDocument();
    expect(screen.getByText("자가용")).toBeInTheDocument();
    expect(screen.getByText("주차")).toBeInTheDocument();
  });

  it("버스 번호를 간선과 지선으로 나눠 적는다", () => {
    renderWithMotion(<Location />);

    const bus = screen.getByText(/간선·직행·일반/);
    for (const number of [...INVITE.transport.bus.trunk, ...INVITE.transport.bus.branch]) {
      expect(bus).toHaveTextContent(number);
    }
  });

  it("MP-06 셔틀버스는 미채택이라 만들지 않는다", () => {
    renderWithMotion(<Location />);

    expect(screen.queryByText(/셔틀/)).not.toBeInTheDocument();
  });

  it("지도 키가 없어도 섹션이 깨지지 않고 안내로 대신한다", async () => {
    renderWithMotion(<Location />);

    expect(await screen.findByText(/아래 지도 앱에서 위치를 확인/)).toBeInTheDocument();
    expect(linkTo("네이버지도")).toBeInTheDocument();
  });

  it("SIS-42 모바일에서는 네이버지도가 앱 스킴을 먼저 시도한다", async () => {
    const user = userEvent.setup();
    renderWithMotion(<Location />);

    await user.click(linkTo("네이버지도"));

    expect(openWithFallback).toHaveBeenCalledWith(expect.stringMatching(/^nmap:\/\//), expect.stringContaining("map.naver.com"));
  });

  it("SIS-42 PC 에서는 네이버지도가 스킴을 시도하지 않고 새 탭으로 열린다", async () => {
    useDevice(DESKTOP_UA);
    const user = userEvent.setup();
    renderWithMotion(<Location />);

    const link = linkTo("네이버지도");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("href", expect.stringContaining("map.naver.com"));

    await user.click(link);

    expect(openWithFallback).not.toHaveBeenCalled();
  });

  it("SIS-42 PC 에서 티맵은 스토어로 보내지 않고 다른 앱을 안내한다", async () => {
    useDevice(DESKTOP_UA);
    const user = userEvent.setup();
    renderWithMotion(<Location />);

    expect(screen.queryByRole("link", { name: "티맵" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "티맵" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/네이버지도나 카카오맵/));
    expect(screen.queryByText(/apps\.apple\.com|play\.google\.com/)).not.toBeInTheDocument();
    expect(openWithFallback).not.toHaveBeenCalled();
  });

  it("SIS-42 모바일에서 티맵은 앱을 여는 링크 그대로다", async () => {
    const user = userEvent.setup();
    renderWithMotion(<Location />);

    await user.click(linkTo("티맵"));

    expect(openWithFallback).toHaveBeenCalledWith(expect.stringMatching(/^tmap:\/\//), expect.stringContaining("apps.apple.com"));
  });

  it("MP-02 주소 복사 버튼이 INVITE 의 주소를 그대로 복사한다", async () => {
    const user = setupUser();
    renderWithMotion(<Location />);

    await user.click(screen.getByRole("button", { name: "주소 복사하기" }));

    expect(writeText).toHaveBeenCalledWith(INVITE.address);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("주소가 복사되었습니다"));
  });

  it("복사에 실패하면 성공했다고 알리지 않는다", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    Object.defineProperty(document, "execCommand", { value: vi.fn().mockReturnValue(false), configurable: true });
    const user = setupUser();
    renderWithMotion(<Location />);

    await user.click(screen.getByRole("button", { name: "주소 복사하기" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/복사에 실패했어요/));
    Reflect.deleteProperty(document as unknown as Record<string, unknown>, "execCommand");
  });
});
