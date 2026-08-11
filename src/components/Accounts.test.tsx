import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMotion } from "../test/renderWithMotion";
import Accounts, { shortRole } from "./Accounts";
import type { Account } from "../lib/private-data";

// 계좌는 환경변수로만 들어오고 mock 폴백이 없다(src/invite.ts). 실행 환경마다 INVITE
// 값이 달라지므로 — 로컬에는 .env 가 있고 CI 에는 없다 — 기대값을 INVITE 에서 가져오면
// 테스트가 환경을 따라 흔들린다. 여기서는 고정 픽스처를 주입해 어디서든 같게 만든다.
//
// 픽스처 계좌번호는 모든 자리가 같은 숫자다. 검토 게이트(review-guard)가 이 형태를
// placeholder 로 보고 통과시킨다. 다만 0 으로만 채운 번호는 쓰지 말 것 — 배포 게이트가
// 그 값을 미완성 표시로 보고 막는다(scripts/verify-release.mjs 의 PLACEHOLDERS).
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

// getter 로 두어 테스트가 도중에 갈아 끼울 수 있게 한다.
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

/** Location.test 와 같은 이유 — userEvent.setup() 이 clipboard 를 갈아 끼우므로 그 뒤에 얹는다. */
function setupUser() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return user;
}

const panelOf = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}`) });
const copyButtons = () => screen.getAllByRole("button", { name: /계좌번호 복사$/ });

describe("Accounts", () => {
  it("AC-01 양측 아코디언은 닫힌 채로 시작한다", () => {
    renderWithMotion(<Accounts />);

    expect(panelOf("신랑측")).toHaveAttribute("aria-expanded", "false");
    expect(panelOf("신부측")).toHaveAttribute("aria-expanded", "false");
    // 닫혀 있는 동안에는 계좌가 DOM 에 없다 — 스크린리더가 접힌 내용을 읽어 버리지 않게 한다.
    expect(screen.queryByText(GROOM[0].holder, { exact: false })).not.toBeInTheDocument();
  });

  it("닫힌 아코디언은 없는 패널을 가리키지 않는다", async () => {
    const user = setupUser();
    renderWithMotion(<Accounts />);

    // 패널을 DOM 에서 빼므로, 닫힌 동안 aria-controls 를 남겨 두면 없는 id 를 가리킨다.
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

    // 은행·번호와 역할·예금주가 서로 다른 엘리먼트로 갈리므로 조각별로 찾는다.
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
    await user.click(copyButtons()[0]);

    // 하이픈을 지우지 않는다. 붙여넣은 값을 화면과 눈으로 대조할 수 있어야 한다.
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
    // 카카오톡 인앱 브라우저처럼 두 경로가 모두 막힌 환경이다. 아무 말 없이 끝나면
    // 하객은 복사가 됐는지 알 수 없다.
    writeText.mockRejectedValue(new Error("denied"));
    // jsdom 에는 execCommand 가 아예 없어 spyOn 이 걸리지 않는다. 값을 직접 얹는다.
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

    // 버튼이 넷 다 "복사"면 스크린리더로는 고를 수 없다.
    const first = GROOM[0];
    expect(
      screen.getByRole("button", { name: `${shortRole(first.role, "groom")} ${first.holder} 계좌번호 복사` }),
    ).toBeInTheDocument();
  });

  it("한쪽 계좌를 읽지 못하면 그 측 아코디언만 사라진다", () => {
    // 환경변수 형식이 깨져 parseAccounts 가 전부 버린 상태다. mock 으로 메우지 않으므로
    // 빈 배열이 그대로 온다 — 열어 봐야 아무것도 없는 아코디언을 두지 않는다.
    accounts = { groom: FULL.groom, bride: [] };

    renderWithMotion(<Accounts />);

    expect(panelOf("신랑측")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^신부측/ })).not.toBeInTheDocument();
  });

  it("계좌를 하나도 읽지 못하면 섹션째 사라진다", () => {
    // 안내 문구만 남고 계좌가 없는 카드는 하객에게 고장으로 보인다.
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
