import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithMotion } from "../test/renderWithMotion";
import DDay from "./DDay";
import { INVITE } from "../invite";
import { AFTER_MESSAGE, WEDDING_DAY_MESSAGE } from "../lib/countdown";

// 경계 계산 자체는 lib/countdown.test.ts가 검증한다. 여기서는 화면이 INVITE.dateISO를
// 기준으로 세 상태의 문구를 맞게 바꾸는지만 본다.
function renderAt(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
  return renderWithMotion(<DDay />);
}

describe("DDay", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("예식 전에는 남은 일수를 이름과 함께 보여준다", () => {
    renderAt("2027-01-14T11:00:00+09:00");

    const message = screen.getByText(/결혼식까지/);
    expect(message).toHaveTextContent(`${INVITE.groom.first}, ${INVITE.bride.first}의 결혼식까지 10일`);
  });

  it("예식 전에는 일·시·분·초 카운트다운이 보인다", () => {
    renderAt("2027-01-14T11:00:00+09:00");

    for (const label of ["일", "시", "분", "초"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("예식 당일에는 당일 문구로 바뀐다", () => {
    renderAt("2027-01-24T09:00:00+09:00");

    expect(screen.getByText(WEDDING_DAY_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(/결혼식까지/)).not.toBeInTheDocument();
  });

  it("예식 시각을 지나도 그날 안이면 당일 문구를 유지한다", () => {
    renderAt("2027-01-24T20:00:00+09:00");

    expect(screen.getByText(WEDDING_DAY_MESSAGE)).toBeInTheDocument();
  });

  it("예식 다음 날부터는 감사 문구만 남고 카운트다운이 사라진다", () => {
    renderAt("2027-01-25T00:00:00+09:00");

    expect(screen.getByText(AFTER_MESSAGE)).toBeInTheDocument();
    // 0만 나열된 카운트다운은 의미가 없다. 라벨째 사라져야 한다.
    expect(screen.queryByText("시")).not.toBeInTheDocument();
    expect(screen.queryByText(/결혼식까지/)).not.toBeInTheDocument();
  });

  it("예식 전에는 1초마다 갱신되고 예식 이후에는 타이머를 걸지 않는다", () => {
    // 페이지는 예식 후 한 달간 열려 있다(CM-08). 그동안 바뀔 것이 없는 화면을
    // 초당 한 번씩 다시 그리지 않는지 확인한다.
    // 스파이는 fake timer로 교체된 뒤에 걸어야 한다 — 순서가 바뀌면 진짜 타이머를 본다.
    vi.useFakeTimers();
    const setInterval = vi.spyOn(globalThis, "setInterval");

    vi.setSystemTime(new Date("2027-01-14T11:00:00+09:00"));
    const before = renderWithMotion(<DDay />);
    expect(setInterval).toHaveBeenCalled();
    before.unmount();

    setInterval.mockClear();
    vi.setSystemTime(new Date("2027-02-24T11:00:00+09:00"));
    renderWithMotion(<DDay />);
    expect(setInterval).not.toHaveBeenCalled();
  });
});
