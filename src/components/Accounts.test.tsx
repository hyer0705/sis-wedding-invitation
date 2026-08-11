import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMotion } from "../test/renderWithMotion";
import Accounts, { shortRole } from "./Accounts";
import { INVITE } from "../invite";

// 계좌번호를 이 파일에 적지 않는다. review-guard 의 개인정보 예외는 src/invite.ts 한
// 파일뿐이라 리터럴을 쓰면 커밋이 막히고, 무엇보다 실값이 리포에 남는다.
// 기대값은 전부 INVITE.accounts 에서 가져온다.
const GROOM = INVITE.accounts.groom;
const BRIDE = INVITE.accounts.bride;

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "clipboard");
  Reflect.deleteProperty(document as unknown as Record<string, unknown>, "execCommand");
});

/** Location.test 와 같은 이유 — userEvent.setup() 이 clipboard 를 갈아 끼우므로 그 뒤에 얹는다. */
function setupUser() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return user;
}

const panelOf = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}`) });

describe("Accounts", () => {
  it("AC-01 양측 아코디언은 닫힌 채로 시작한다", () => {
    renderWithMotion(<Accounts />);

    expect(panelOf("신랑측")).toHaveAttribute("aria-expanded", "false");
    expect(panelOf("신부측")).toHaveAttribute("aria-expanded", "false");
    // 닫혀 있는 동안에는 계좌가 DOM 에 없다 — 스크린리더가 접힌 내용을 읽어 버리지 않게 한다.
    expect(screen.queryByText(GROOM[0].holder, { exact: false })).not.toBeInTheDocument();
  });

  it("AC-01 아코디언을 열면 그 측의 계좌가 모두 나온다", async () => {
    const user = setupUser();
    renderWithMotion(<Accounts />);

    await user.click(panelOf("신랑측"));

    // 은행·번호와 역할·예금주가 서로 다른 엘리먼트로 갈리므로 조각별로 찾는다.
    for (const account of GROOM) {
      expect(screen.getByText(`${account.bank} ${account.number}`)).toBeInTheDocument();
    }
    expect(screen.getAllByRole("button", { name: /계좌번호 복사$/ })).toHaveLength(GROOM.length);
  });

  it("AC-01 두 아코디언은 독립적으로 열고 닫힌다", async () => {
    const user = setupUser();
    renderWithMotion(<Accounts />);

    await user.click(panelOf("신랑측"));
    await user.click(panelOf("신부측"));

    // 한쪽을 연다고 다른 쪽이 닫히지 않는다 — 양가를 나란히 보려는 하객이 있다.
    expect(panelOf("신랑측")).toHaveAttribute("aria-expanded", "true");
    expect(panelOf("신부측")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(`${BRIDE[0].bank} ${BRIDE[0].number}`)).toBeInTheDocument();

    await user.click(panelOf("신랑측"));

    expect(panelOf("신랑측")).toHaveAttribute("aria-expanded", "false");
    expect(panelOf("신부측")).toHaveAttribute("aria-expanded", "true");
  });

  it("AC-02 복사 버튼은 화면에 보이는 것과 같은 값을(하이픈째) 클립보드에 넣는다", async () => {
    const user = setupUser();
    renderWithMotion(<Accounts />);

    await user.click(panelOf("신랑측"));
    await user.click(screen.getAllByRole("button", { name: /계좌번호 복사$/ })[0]);

    // 하이픈을 지우지 않는다. 붙여넣은 값을 화면과 눈으로 대조할 수 있어야 한다.
    expect(writeText).toHaveBeenCalledWith(GROOM[0].number);
  });

  it("AC-02 복사에 성공하면 토스트로 알린다", async () => {
    const user = setupUser();
    renderWithMotion(<Accounts />);

    await user.click(panelOf("신부측"));
    await user.click(screen.getAllByRole("button", { name: /계좌번호 복사$/ })[0]);

    expect(await screen.findByRole("status")).toHaveTextContent("계좌번호가 복사되었습니다");
  });

  it("AC-02 복사에 실패하면 직접 복사하는 방법을 알려 준다", async () => {
    // 카카오톡 인앱 브라우저처럼 두 경로가 모두 막힌 환경이다. 아무 말 없이 끝나면
    // 하객은 복사가 됐는지 알 수 없다.
    writeText.mockRejectedValue(new Error("denied"));
    // jsdom 에는 execCommand 가 아예 없어 spyOn 이 걸리지 않는다. 값을 직접 얹는다.
    Object.defineProperty(document, "execCommand", { value: vi.fn().mockReturnValue(false), configurable: true });

    const user = setupUser();
    renderWithMotion(<Accounts />);

    await user.click(panelOf("신랑측"));
    await user.click(screen.getAllByRole("button", { name: /계좌번호 복사$/ })[0]);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("길게 눌러"));
  });

  it("복사 버튼은 어느 계좌의 것인지 이름으로 구분된다", async () => {
    const user = setupUser();
    renderWithMotion(<Accounts />);

    await user.click(panelOf("신랑측"));

    // 버튼이 넷 다 "복사"면 스크린리더로는 고를 수 없다.
    const first = GROOM[0];
    expect(
      screen.getByRole("button", { name: `${shortRole(first.role, "groom")} ${first.holder} 계좌번호 복사` }),
    ).toBeInTheDocument();
  });

  it("AC-03 카카오페이 송금은 미채택이라 만들지 않는다", () => {
    renderWithMotion(<Accounts />);

    expect(screen.queryByText(/카카오페이/)).not.toBeInTheDocument();
  });
});

describe("shortRole", () => {
  it("아코디언 안에서는 집안 이름을 걷어낸다", () => {
    // "신랑측" 아코디언 안의 "신랑 아버지"는 집안 이름이 두 번 나온 셈이다.
    expect(shortRole("신랑 아버지", "groom")).toBe("아버지");
    expect(shortRole("신부 어머니", "bride")).toBe("어머니");
  });

  it("본인 계좌의 역할은 그대로 둔다", () => {
    expect(shortRole("신랑", "groom")).toBe("신랑");
    expect(shortRole("신부", "bride")).toBe("신부");
  });

  it("환경변수에 이미 짧게 적혀 와도 결과가 같다", () => {
    // .env 를 누가 어떻게 적든 화면은 같아야 한다.
    expect(shortRole("아버지", "groom")).toBe("아버지");
  });

  it("반대편 집안 이름은 건드리지 않는다", () => {
    // 신부측 아코디언에 "신랑 아버지"가 들어오는 것은 데이터가 잘못된 것이다.
    // 조용히 다듬어 감추면 잘못 들어온 계좌를 알아채기 어려워진다.
    expect(shortRole("신랑 아버지", "bride")).toBe("신랑 아버지");
  });
});
