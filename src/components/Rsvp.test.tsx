import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMotion } from "../test/renderWithMotion";
import Rsvp from "./Rsvp";
import { submitRsvp } from "../lib/rsvp";

// 전송을 mock 으로 덮고 호출 여부와 인자만 본다. 이제 submitRsvp 는 실제로
// Supabase 로 요청을 보내므로(SIS-20), 덮지 않으면 이 파일이 매번 네트워크를 탄다.
// supabase-js 가 실제로 무엇을 어디로 보내는지는 유닛 테스트(lib/rsvp.test.ts)와
// E2E(e2e/smoke.spec.ts)가 각각 본다.
vi.mock("../lib/rsvp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/rsvp")>();
  return { ...actual, submitRsvp: vi.fn() };
});

const sendMock = vi.mocked(submitRsvp);

/** 마감(2027-01-23) 한참 이전. 마감 안내가 아니라 폼이 그려지는 시점이다. */
const BEFORE_DEADLINE = new Date("2026-08-18T12:00:00+09:00").getTime();
const AFTER_DEADLINE = new Date("2027-01-24T00:00:00+09:00").getTime();

// 가짜 타이머가 아니라 Date.now 만 바꾼다. 마감 판정에 필요한 것은 시각뿐인데,
// 타이머까지 가짜로 두면 Motion 의 전환(AnimatePresence)이 진행되지 않아 단계가
// 나타나고 사라지는 것을 확인할 수 없다.
beforeEach(() => {
  localStorage.clear();
  sendMock.mockReset();
  sendMock.mockResolvedValue(undefined);
  vi.spyOn(Date, "now").mockReturnValue(BEFORE_DEADLINE);
});

afterEach(() => {
  vi.restoreAllMocks();
});

type User = ReturnType<typeof userEvent.setup>;

/**
 * 폼은 버튼 뒤에 숨어 있다. 대부분의 테스트가 여기서 시작한다.
 *
 * 여는 버튼이 사라진 뒤에야 폼이 들어오므로(AnimatePresence mode="wait") 첫 항목이
 * 나타날 때까지 기다린다.
 */
async function openForm(user: User) {
  await user.click(screen.getByRole("button", { name: "참석 여부 알리기" }));
  await screen.findByRole("button", { name: "신랑측 하객" });
}

/** 참석 회신을 동의 직전까지 채운다. 각 단계는 앞 단계를 채워야 나타난다. */
async function fillAttending(user: User, { count = "2", phone = "000-0000-0000" } = {}) {
  await user.click(screen.getByRole("button", { name: "신랑측 하객" }));
  await user.click(await screen.findByRole("button", { name: "참석합니다" }));
  await user.type(await screen.findByLabelText("성함"), "홍길동");
  await user.type(await screen.findByLabelText("참석 인원 (본인 포함)"), count);
  await user.type(await screen.findByLabelText("연락처"), phone);
  await user.click(await screen.findByRole("button", { name: "식사함" }));
}

describe("Rsvp", () => {
  it("처음에는 폼 대신 여는 버튼만 보인다", async () => {
    const user = userEvent.setup();
    renderWithMotion(<Rsvp />);

    expect(screen.queryByRole("button", { name: "신랑측 하객" })).not.toBeInTheDocument();

    await openForm(user);
    expect(await screen.findByRole("button", { name: "신랑측 하객" })).toBeInTheDocument();
  });

  // 항목을 한 번에 하나씩 내보낸다. 여섯 칸을 한꺼번에 펼치면 카드가 화면 두 배가 된다.
  describe("단계별 노출", () => {
    it("앞 항목을 채워야 다음 항목이 나타난다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openForm(user);

      // 하객 구분만 보인다.
      expect(screen.queryByRole("button", { name: "참석합니다" })).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "신랑측 하객" }));
      expect(await screen.findByRole("button", { name: "참석합니다" })).toBeInTheDocument();
      expect(screen.queryByLabelText("성함")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "참석합니다" }));
      expect(await screen.findByLabelText("성함")).toBeInTheDocument();
      expect(screen.queryByLabelText("참석 인원 (본인 포함)")).not.toBeInTheDocument();

      await user.type(screen.getByLabelText("성함"), "홍길동");
      expect(await screen.findByLabelText("참석 인원 (본인 포함)")).toBeInTheDocument();
      expect(screen.queryByLabelText("연락처")).not.toBeInTheDocument();

      await user.type(screen.getByLabelText("참석 인원 (본인 포함)"), "2");
      expect(await screen.findByLabelText("연락처")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "식사함" })).not.toBeInTheDocument();

      await user.type(screen.getByLabelText("연락처"), "000-0000-0000");
      expect(await screen.findByRole("button", { name: "식사함" })).toBeInTheDocument();
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "식사함" }));
      expect(await screen.findByRole("checkbox")).toBeInTheDocument();
    });

    // 연락처가 필수로 돌아오면서(SIS-37) 미참석도 「채워야 다음이 나온다」를 따른다.
    // 인원·식사만 건너뛰므로 성함 다음이 연락처고, 그 다음이 곧 동의다.
    it("미참석이면 성함 다음이 연락처고, 채워야 동의가 나온다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openForm(user);

      await user.click(screen.getByRole("button", { name: "신부측 하객" }));
      await user.click(await screen.findByRole("button", { name: "참석 어려워요" }));
      await user.type(await screen.findByLabelText("성함"), "김하객");

      const phone = await screen.findByLabelText("연락처");
      expect(phone).toHaveValue("");
      // 비어 있는 동안에는 동의가 나오지 않는다.
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();

      await user.type(phone, "000-0000-0000");
      expect(await screen.findByRole("checkbox")).toBeInTheDocument();

      expect(screen.queryByLabelText("참석 인원 (본인 포함)")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "식사함" })).not.toBeInTheDocument();
    });

    it("참석에서 미참석으로 바꾸면 인원은 사라지고 연락처는 남는다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openForm(user);

      await fillAttending(user);
      expect(screen.getByLabelText("연락처")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "참석 어려워요" }));

      await waitFor(() => expect(screen.queryByLabelText("참석 인원 (본인 포함)")).not.toBeInTheDocument());
      // 지워 버리면 방금 적은 번호가 눈앞에서 사라진다. 미참석에서도 쓰는 칸이다.
      expect(screen.getByLabelText("연락처")).toHaveValue("000-0000-0000");
    });
  });

  describe("검증", () => {
    it("동의 전에는 제출 버튼이 잠겨 있다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openForm(user);
      await fillAttending(user);

      const submit = await screen.findByRole("button", { name: "참석 의사 전하기" });
      expect(submit).toBeDisabled();

      await user.click(screen.getByRole("checkbox"));
      expect(submit).toBeEnabled();
    });

    it("인원이 범위를 벗어나면 제출하지 않고 알린다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openForm(user);
      await fillAttending(user, { count: "0" });

      await user.click(await screen.findByRole("checkbox"));
      await user.click(screen.getByRole("button", { name: "참석 의사 전하기" }));

      expect(await screen.findByText(/참석 인원은 1~20명/)).toBeInTheDocument();
      expect(sendMock).not.toHaveBeenCalled();
    });

    // 폼이 DB 제약(rsvp_phone_required_for_attendees)보다 느슨하면 참석 회신만
    // 23514 로 거부되는데, 화면에서는 원인이 보이지 않는다.
    it("연락처 자릿수가 모자라면 제출하지 않고 알린다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openForm(user);
      await fillAttending(user, { phone: "000-00" });

      await user.click(await screen.findByRole("checkbox"));
      await user.click(screen.getByRole("button", { name: "참석 의사 전하기" }));

      expect(await screen.findByText(/연락처를 다시 확인해 주세요/)).toBeInTheDocument();
      expect(sendMock).not.toHaveBeenCalled();
    });
  });

  describe("제출", () => {
    it("정상 입력이면 스키마에 맞는 값을 보내고 완료 카드로 바뀐다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openForm(user);
      await fillAttending(user);
      await user.click(await screen.findByRole("checkbox"));
      await user.click(screen.getByRole("button", { name: "참석 의사 전하기" }));

      await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(1));
      expect(sendMock).toHaveBeenCalledWith({
        side: "신랑측",
        attend: "참석",
        name: "홍길동",
        count: 2,
        meal: "식사함",
        // 하이픈은 폼이 걷어낸다.
        phone: "00000000000",
      });

      expect(await screen.findByText(/참석 의사가 전달되었습니다/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "참석 의사 전하기" })).not.toBeInTheDocument();
    });

    // 축의 대조·답례·회신 정정에 이 번호 말고는 창구가 없다 (SIS-37).
    it("미참석 회신도 연락처를 실어 보낸다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openForm(user);

      await user.click(screen.getByRole("button", { name: "신부측 하객" }));
      await user.click(await screen.findByRole("button", { name: "참석 어려워요" }));
      await user.type(await screen.findByLabelText("성함"), "김하객");
      await user.type(await screen.findByLabelText("연락처"), "000-0000-0000");
      await user.click(await screen.findByRole("checkbox"));
      await user.click(screen.getByRole("button", { name: "참석 의사 전하기" }));

      await waitFor(() => expect(sendMock).toHaveBeenCalledTimes(1));
      expect(sendMock).toHaveBeenCalledWith({
        side: "신부측",
        attend: "미참석",
        name: "김하객",
        // 인원을 묻지 않으므로 1 로 채운다 — DB 의 count 는 not null 이다.
        count: 1,
        meal: "식사안함",
        phone: "00000000000",
      });
    });

    // 잘못 적힌 번호가 그대로 저장되면 예식 전에 걸어도 닿지 않는다.
    it("미참석이 적은 연락처도 자릿수가 틀리면 제출하지 않고 알린다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openForm(user);

      await user.click(screen.getByRole("button", { name: "신부측 하객" }));
      await user.click(await screen.findByRole("button", { name: "참석 어려워요" }));
      await user.type(await screen.findByLabelText("성함"), "김하객");
      await user.type(await screen.findByLabelText("연락처"), "000-00");
      await user.click(await screen.findByRole("checkbox"));
      await user.click(screen.getByRole("button", { name: "참석 의사 전하기" }));

      expect(await screen.findByText(/연락처를 다시 확인해 주세요/)).toBeInTheDocument();
      expect(sendMock).not.toHaveBeenCalled();
    });

    // 실패를 삼키면 하객도 고객도 회신이 유실된 것을 알 수 없다 (SIS-33).
    it("전송이 실패하면 완료 카드로 넘어가지 않고 다시 시도할 수 있다", async () => {
      const user = userEvent.setup();
      // 실패 원인은 콘솔로 나간다(Rsvp.tsx). 여기서는 일부러 실패시키는 것이라
      // 테스트 출력에 섞이지 않게 덮되, 실제로 남는지는 확인한다.
      const logged = vi.spyOn(console, "error").mockImplementation(() => {});
      sendMock.mockRejectedValue(new Error("network"));
      renderWithMotion(<Rsvp />);
      await openForm(user);
      await fillAttending(user);
      await user.click(await screen.findByRole("checkbox"));
      await user.click(screen.getByRole("button", { name: "참석 의사 전하기" }));

      expect(await screen.findByRole("status")).toHaveTextContent(/실패/);
      expect(screen.queryByText(/참석 의사가 전달되었습니다/)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "참석 의사 전하기" })).toBeEnabled();
      // 화면 안내는 무엇이 실패해도 같은 한 줄이다. 원인을 구분할 유일한 자리라
      // 이 로그가 사라지면 원격에서 실패를 진단할 방법이 없어진다.
      expect(logged).toHaveBeenCalled();
    });

    it("이미 회신한 브라우저에는 여는 버튼 대신 완료 카드를 보여준다", () => {
      localStorage.setItem("rsvp-submitted", "1");
      renderWithMotion(<Rsvp />);

      expect(screen.getByText(/참석 의사가 전달되었습니다/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "참석 여부 알리기" })).not.toBeInTheDocument();
    });
  });

  it("마감일이 지나면 폼 대신 마감 안내를 보여준다", () => {
    vi.spyOn(Date, "now").mockReturnValue(AFTER_DEADLINE);
    renderWithMotion(<Rsvp />);

    expect(screen.getByText(/참석 회신이 마감되었습니다/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "참석 여부 알리기" })).not.toBeInTheDocument();
  });

  describe("개인정보 처리방침(RS-03)", () => {
    /** 동의 단계까지 가야 안내가 보인다. */
    async function reachConsent(user: User) {
      await openForm(user);
      await fillAttending(user);
      await screen.findByRole("checkbox");
    }

    it("수집 항목에 연락처가 들어 있다", async () => {
      // 연락처를 받기로 하면서 생긴 법적 요구다. 문구에서 빠지면 고지가 효력을 잃는다.
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await reachConsent(user);

      expect(screen.getByText(/이름, 연락처, 참석 여부, 참석 인원 수, 식사 여부/)).toBeInTheDocument();
    });

    it("자세히 보기를 눌러야 전문이 펼쳐진다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await reachConsent(user);

      expect(screen.queryByText("개인정보 처리방침")).not.toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "개인정보 처리방침 자세히 보기" }));
      expect(screen.getByText("개인정보 처리방침")).toBeInTheDocument();
      expect(screen.getByText(/데이터 저장 리전: 대한민국\(서울\)/)).toBeInTheDocument();
    });

    // 카드가 화면 몇 배로 늘어나지 않도록 전문은 자체 높이 안에서만 스크롤한다.
    it("전문은 스크롤 영역으로 들어가 키보드로 훑을 수 있다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await reachConsent(user);
      await user.click(screen.getByRole("button", { name: "개인정보 처리방침 자세히 보기" }));

      const panel = screen.getByRole("region", { name: "개인정보 처리방침" });
      expect(panel).toHaveAttribute("tabindex", "0");
    });
  });
});
