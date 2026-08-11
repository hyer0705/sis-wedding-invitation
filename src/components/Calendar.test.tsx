import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMotion } from "../test/renderWithMotion";
import Calendar from "./Calendar";
import { INVITE } from "../invite";
import { monthGridOf } from "../lib/monthGrid";

// 격자 계산 자체는 lib/monthGrid.test.ts 가 본다. 여기서는 화면이 INVITE 를 기준으로
// 그려지는지, 저장 버튼이 실제로 .ics 를 내보내는지를 확인한다.

const grid = monthGridOf(INVITE.dateISO);

// jsdom 에는 Blob URL 이 없다. 다운로드 경로가 어디서 끊기는지 보려면 직접 심어야 한다.
const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:test");
const revokeObjectURL = vi.fn();
let icsText = "";

beforeEach(() => {
  icsText = "";
  createObjectURL.mockClear().mockImplementation((blob: Blob) => {
    // Blob.text() 는 비동기라 클릭 직후에는 읽을 수 없다. 생성 시점에 붙잡아 둔다.
    void blob.text().then((t) => (icsText = t));
    return "blob:test";
  });
  revokeObjectURL.mockClear();
  Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true });
  Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true });
});

afterEach(() => {
  Reflect.deleteProperty(URL as unknown as Record<string, unknown>, "createObjectURL");
  Reflect.deleteProperty(URL as unknown as Record<string, unknown>, "revokeObjectURL");
  vi.restoreAllMocks();
});

describe("Calendar", () => {
  it("DT-01 예식 일시와 장소를 보여 준다", () => {
    renderWithMotion(<Calendar />);

    expect(screen.getByText(`${INVITE.dateText} ${INVITE.dayText}`)).toBeInTheDocument();
    expect(screen.getByText(INVITE.venue)).toBeInTheDocument();
    expect(screen.getByText(INVITE.hall)).toBeInTheDocument();
  });

  it("DT-02 요일 헤더 일곱 칸과 그 달의 모든 날짜가 나온다", () => {
    renderWithMotion(<Calendar />);
    const table = screen.getByRole("table");

    expect(within(table).getAllByRole("columnheader")).toHaveLength(7);
    const lastDate = grid.weeks.flat().filter((d): d is number => d !== null).length;
    expect(within(table).getByText(String(lastDate))).toBeInTheDocument();
  });

  it("DT-02 예식일에만 예식일 표시를 붙인다", () => {
    renderWithMotion(<Calendar />);

    // 눈으로는 초록 원이지만, 색을 볼 수 없는 사람에게는 이 문구가 유일한 단서다.
    // exact 매칭이라 같은 낱말이 든 <caption>("…예식일입니다")은 걸리지 않는다.
    const marks = screen.getAllByText("예식일");
    expect(marks).toHaveLength(1);
    expect(marks[0].parentElement).toHaveTextContent(String(grid.weddingDay));
  });

  it("CV-04 D-Day 카운트다운을 같은 카드 안에 품는다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-01-14T11:00:00+09:00"));
    try {
      renderWithMotion(<Calendar />);
      expect(screen.getByText(/결혼식까지/)).toHaveTextContent("10일");
    } finally {
      vi.useRealTimers();
    }
  });

  it("DT-03 저장 버튼이 예식 일정을 담은 .ics 를 내려받게 한다", async () => {
    const user = userEvent.setup();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderWithMotion(<Calendar />);

    await user.click(screen.getByRole("button", { name: "캘린더에 저장" }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    // 예식 시각 11:00 KST = 02:00 UTC. 여기가 틀리면 하객 캘린더에 엉뚱한 시각이 박힌다.
    await vi.waitFor(() => expect(icsText).toContain("DTSTART:20270124T020000Z"));
    expect(icsText).toContain(INVITE.venue);
  });

  it("DT-03 저장 결과를 토스트로 알린다", async () => {
    const user = userEvent.setup();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderWithMotion(<Calendar />);

    await user.click(screen.getByRole("button", { name: "캘린더에 저장" }));

    // 파일 저장은 화면이 그대로라, 알림이 없으면 눌렸는지조차 알 수 없다.
    expect(screen.getByRole("status")).toHaveTextContent("캘린더 앱에서 일정을 확인해 주세요");
  });

  it("DT-03 저장에 실패하면 직접 등록하라고 알린다", async () => {
    const user = userEvent.setup();
    // 인앱 브라우저에서 Blob 생성이 막히는 상황을 흉내 낸다.
    createObjectURL.mockImplementation(() => {
      throw new Error("blocked");
    });
    renderWithMotion(<Calendar />);

    await user.click(screen.getByRole("button", { name: "캘린더에 저장" }));

    expect(screen.getByRole("status")).toHaveTextContent("일시를 직접 등록해 주세요");
  });
});
