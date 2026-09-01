import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMotion } from "../test/renderWithMotion";
import Accounts, { shortRole } from "./Accounts";
import type { Account } from "../lib/private-data";

const FULL: { groom: Account[]; bride: Account[] } = {
  groom: [
    { role: "신랑", bank: "행복은행", number: "111-111-111111", holder: "김신랑" },
    { role: "신랑 아버지", bank: "행복은행", number: "222-222-222222", holder: "김아버지" },
  ],
  bride: [
    { role: "신부", bank: "행복은행", number: "333-333-333333", holder: "이신부" },
    { role: "신부 어머니", bank: "행복은행", number: "444-444-444444", holder: "이어머니" },
  ],
};

let accounts: { groom: Account[]; bride: Account[] } = FULL;

vi.mock("../invite", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../invite")>();
  return {
    INVITE: {
      ...actual.INVITE,
      get accounts() {
        return accounts;
      },
    },
  };
});

const { groom: GROOM, bride: BRIDE } = FULL;

const writeText = vi.fn();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  accounts = FULL;
  Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "clipboard");
  Reflect.deleteProperty(document as unknown as Record<string, unknown>, "execCommand");
});

function setupUser() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return user;
}

const panelOf = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}`) });
const copyButtons = () => screen.getAllByRole("button", { name: /계좌번호 복사$/ });

describe("Accounts", () => {
  it("Reveal 래퍼를 거친다", () => {
    const { container } = renderWithMotion(<Accounts />);

    expect(container.firstElementChild?.tagName).toBe("SECTION");
  });

  it("AC-01 양측 아코디언은 닫힌 채로 시작한다", () => {
    renderWithMotion(<Accounts />);

    expect(panelOf("신랑측")).toHaveAttribute("aria-expanded", "false");
    expect(panelOf("신부측")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(GROOM[0].holder, { exact: false })).not.toBeInTheDocument();
  });

  it("닫힌 아코디언은 없는 패널을 가리키지 않는다", async () => {
    const user = setupUser();
    renderWithMotion(<Accounts />);

    expect(panelOf("신랑측")).not.toHaveAttribute("aria-controls");

    await user.click(panelOf("신랑측"));

    const controls = panelOf("신랑측").getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(document.getElementById(controls as string)).toBeInTheDocument();
  });

  it("AC-01 아코디언을 열면 그 측의 계좌가 모두 나온다", async () => {
    const user = setupUser();
    renderWithMotion(<Accounts />);

    await user.click(panelOf("신랑측"));

    for (const account of GROOM) {
      expect(screen.getByText(`${account.bank} ${account.number}`)).toBeInTheDocument();
    }
    expect(copyButtons()).toHaveLength(GROOM.length);
  });

  it("AC-01 두 아코디언은 독립적으로 열고 닫힌다", async () => {
    const user = setupUser();
    renderWithMotion(<Accounts />);

    await user.click(panelOf("신랑측"));
    await user.click(panelOf("신부측"));

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
    await user.click(copyButtons()[0]);

    expect(writeText).toHaveBeenCalledWith(GROOM[0].number);
  });

  it("AC-02 복사에 성공하면 토스트로 알린다", async () => {
    const user = setupUser();
    renderWithMotion(<Accounts />);

    await user.click(panelOf("신부측"));
    await user.click(copyButtons()[0]);

    expect(await screen.findByRole("status")).toHaveTextContent("계좌번호가 복사되었습니다");
  });

  it("AC-02 복사에 실패하면 직접 복사하는 방법을 알려 준다", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    Object.defineProperty(document, "execCommand", { value: vi.fn().mockReturnValue(false), configurable: true });

    const user = setupUser();
    renderWithMotion(<Accounts />);

    await user.click(panelOf("신랑측"));
    await user.click(copyButtons()[0]);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("길게 눌러"));
  });

  it("복사 버튼은 어느 계좌의 것인지 이름으로 구분된다", async () => {
    const user = setupUser();
    renderWithMotion(<Accounts />);

    await user.click(panelOf("신랑측"));

    const first = GROOM[0];
    expect(
      screen.getByRole("button", { name: `${shortRole(first.role, "groom")} ${first.holder} 계좌번호 복사` }),
    ).toBeInTheDocument();
  });

  it("한쪽 계좌를 읽지 못하면 그 측 아코디언만 사라진다", () => {
    accounts = { groom: FULL.groom, bride: [] };

    renderWithMotion(<Accounts />);

    expect(panelOf("신랑측")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^신부측/ })).not.toBeInTheDocument();
  });

  it("계좌를 하나도 읽지 못하면 섹션째 사라진다", () => {
    accounts = { groom: [], bride: [] };

    const { container } = renderWithMotion(<Accounts />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByText("Thanks heart")).not.toBeInTheDocument();
  });

  it("AC-03 카카오페이 송금은 미채택이라 만들지 않는다", () => {
    renderWithMotion(<Accounts />);

    expect(screen.queryByText(/카카오페이/)).not.toBeInTheDocument();
  });
});

describe("shortRole", () => {
  it("아코디언 안에서는 집안 이름을 걷어낸다", () => {
    expect(shortRole("신랑 아버지", "groom")).toBe("아버지");
    expect(shortRole("신부 어머니", "bride")).toBe("어머니");
  });

  it("본인 계좌의 역할은 그대로 둔다", () => {
    expect(shortRole("신랑", "groom")).toBe("신랑");
    expect(shortRole("신부", "bride")).toBe("신부");
  });

  it("환경변수에 이미 짧게 적혀 와도 결과가 같다", () => {
    expect(shortRole("아버지", "groom")).toBe("아버지");
  });

  it("반대편 집안 이름은 건드리지 않는다", () => {
    expect(shortRole("신랑 아버지", "bride")).toBe("신랑 아버지");
  });
});
