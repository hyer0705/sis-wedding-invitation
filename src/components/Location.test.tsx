import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMotion } from "../test/renderWithMotion";
import Location from "./Location";
import { INVITE } from "../invite";

// 지도 SDK 는 네트워크를 타므로 테스트에서는 언제나 "쓸 수 없음"으로 둔다. 키가 없는
// 환경에서도 섹션 전체가 멀쩡해야 한다는 것이 MP-01 의 조건이라, 그 상태가 곧 기본값이다.
vi.mock("../lib/kakaoMap", () => ({
  loadKakaoMaps: vi.fn().mockResolvedValue(null),
  drawVenueMap: vi.fn(),
}));

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "clipboard");
});

/**
 * userEvent.setup() 이 navigator.clipboard 를 자체 스텁으로 갈아 끼우므로, 우리 것은
 * 그 뒤에 얹어야 한다. 순서를 바꾸면 복사가 늘 성공해 실패 경로를 검증할 수 없다.
 */
function setupUser() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return user;
}

const linkTo = (name: string) => screen.getByRole("link", { name });

describe("Location", () => {
  it("MP-02 예식장과 도로명 주소를 보여 준다", () => {
    renderWithMotion(<Location />);

    // 층수는 주소에만 둔다 — 제목에도 넣으면 "7F"가 두 줄 연달아 보인다.
    expect(screen.getByText(`${INVITE.venue} ${INVITE.hall.split(" ")[0]}`)).toBeInTheDocument();
    expect(screen.getByText(INVITE.address)).toBeInTheDocument();
  });

  it("c안의 옛 주소가 남아 있지 않다", () => {
    // 경인로 577 은 틀린 주소다. 시안에서 옮겨 오다 되살아나기 쉬운 값이라 못을 박는다.
    renderWithMotion(<Location />);

    expect(screen.queryByText(/경인로 577/)).not.toBeInTheDocument();
  });

  it("MP-03 지도 앱 세 곳으로 가는 링크가 있다", () => {
    renderWithMotion(<Location />);

    expect(linkTo("네이버지도")).toBeInTheDocument();
    expect(linkTo("카카오맵")).toBeInTheDocument();
    expect(linkTo("티맵")).toBeInTheDocument();
  });

  it("앱이 없는 하객도 갈 곳이 있도록 링크의 기본 주소는 웹이다", () => {
    // href 에 앱 스킴을 넣으면 앱이 없을 때 아무 일도 일어나지 않는다.
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
    // 지도가 없다고 길찾기까지 멈추면 안 된다.
    expect(linkTo("네이버지도")).toBeInTheDocument();
  });

  it("MP-02 주소 복사 버튼이 INVITE 의 주소를 그대로 복사한다", async () => {
    const user = setupUser();
    renderWithMotion(<Location />);

    await user.click(screen.getByRole("button", { name: "주소 복사하기" }));

    expect(writeText).toHaveBeenCalledWith(INVITE.address);
    expect(await screen.findByRole("status")).toHaveTextContent("주소가 복사되었습니다");
  });

  it("복사에 실패하면 성공했다고 알리지 않는다", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    Object.defineProperty(document, "execCommand", { value: vi.fn().mockReturnValue(false), configurable: true });
    const user = setupUser();
    renderWithMotion(<Location />);

    await user.click(screen.getByRole("button", { name: "주소 복사하기" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/복사하지 못했어요/));
    Reflect.deleteProperty(document as unknown as Record<string, unknown>, "execCommand");
  });
});
