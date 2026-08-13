import { afterEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithMotion } from "../test/renderWithMotion";
import DDay, { useCountdown } from "./DDay";
import { INVITE } from "../invite";
import { AFTER_MESSAGE, WEDDING_DAY_MESSAGE, countdownAt } from "../lib/countdown";

// 경계 계산 자체는 lib/countdown.test.ts가 검증한다. 여기서는 화면이 INVITE.dateISO를
// 기준으로 세 상태의 문구를 맞게 바꾸는지만 본다.
//
// 시간을 세는 일은 useCountdown이 맡고 DDay는 받은 값을 그리기만 한다(SIS-10). 그래서
// 그리는 쪽은 값을 직접 넣어 확인하고, 타이머는 훅만 따로 확인한다.
function renderAt(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
  return renderWithMotion(<DDay countdown={countdownAt(INVITE.dateISO, Date.now())} />);
}

/** 훅만 돌리기 위한 최소 컴포넌트. 화면에 그리는 것은 확인 대상이 아니다. */
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
    // 0만 나열된 카운트다운은 의미가 없다. 라벨째 사라져야 한다.
    expect(screen.queryByText("시")).not.toBeInTheDocument();
    expect(screen.queryByText(/결혼식까지/)).not.toBeInTheDocument();
  });

  it("useCountdown은 예식 전에만 1초 타이머를 건다", () => {
    // 페이지는 예식 후 한 달간 열려 있다(CM-08). 그동안 바뀔 것이 없는 화면을
    // 초당 한 번씩 다시 그리지 않는지 확인한다.
    // globalThis.setInterval에 스파이를 걸지 않는다. fake timer가 심어 둔 가짜 구현을
    // "원본"으로 기억해 두었다가 restoreMocks가 그것을 전역에 되돌려 놓기 때문이다.
    // 등록된 타이머 수를 직접 세면 그 함정을 피한다.
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2027-01-14T11:00:00+09:00"));
    const before = renderWithMotion(<CountdownProbe />);
    expect(screen.getByTestId("phase")).toHaveTextContent("before");
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    before.unmount();
    expect(vi.getTimerCount()).toBe(0); // 언마운트 때 정리된다

    vi.setSystemTime(new Date("2027-02-24T11:00:00+09:00"));
    renderWithMotion(<CountdownProbe />);
    expect(screen.getByTestId("phase")).toHaveTextContent("after");
    expect(vi.getTimerCount()).toBe(0);
  });
});
