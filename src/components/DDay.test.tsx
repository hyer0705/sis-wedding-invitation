import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithMotion } from "../test/renderWithMotion";
import DDay, { useCountdown } from "./DDay";
import { INVITE } from "../invite";
import { AFTER_MESSAGE, WEDDING_DAY_MESSAGE, countdownAt } from "../lib/countdown";

function renderAt(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
  return renderWithMotion(<DDay countdown={countdownAt(INVITE.dateISO, Date.now())} />);
}

function CountdownProbe() {
  const t = useCountdown();
  return <span data-testid="phase">{t.phase}</span>;
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
    expect(screen.queryByText("시")).not.toBeInTheDocument();
    expect(screen.queryByText(/결혼식까지/)).not.toBeInTheDocument();
  });

  it("useCountdown은 예식 전에만 1초 타이머를 건다", () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2027-01-14T11:00:00+09:00"));
    const before = renderWithMotion(<CountdownProbe />);
    expect(screen.getByTestId("phase")).toHaveTextContent("before");
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    before.unmount();
    expect(vi.getTimerCount()).toBe(0);

    vi.setSystemTime(new Date("2027-02-24T11:00:00+09:00"));
    renderWithMotion(<CountdownProbe />);
    expect(screen.getByTestId("phase")).toHaveTextContent("after");
    expect(vi.getTimerCount()).toBe(0);
  });
});
