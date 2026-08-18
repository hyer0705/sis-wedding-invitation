import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
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

/** 미참석 회신을 동의 직전까지 채운다. 인원·식사를 건너뛴다. */
async function fillDeclining(user: User, { phone = "000-0000-0000" } = {}) {
  await user.click(screen.getByRole("button", { name: "신부측 하객" }));
  await user.click(await screen.findByRole("button", { name: "참석 어려워요" }));
  await user.type(await screen.findByLabelText("성함"), "김하객");
  await user.type(await screen.findByLabelText("연락처"), phone);
}

/**
 * 폼의 제출 버튼을 누른다. 이제 전송이 아니라 확인 팝업을 여는 자리다 (SIS-36).
 * 검증에 걸리면 팝업이 뜨지 않는다.
 */
async function pressSubmit(user: User) {
  await user.click(await screen.findByRole("button", { name: "참석 의사 전하기" }));
}

/** 확인 팝업의 「확인」을 눌러 실제로 전송한다 (SIS-36). */
async function confirmSend(user: User) {
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "확인" }));
}

/** 동의까지 마치고 확인 팝업을 연다. 제출을 보는 테스트가 여기서 시작한다. */
async function openConfirm(user: User, fill: (user: User) => Promise<void> = fillAttending) {
  await openForm(user);
  await fill(user);
  await user.click(await screen.findByRole("checkbox"));
  await pressSubmit(user);
  return screen.findByRole("dialog");
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
      await pressSubmit(user);

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
      await pressSubmit(user);

      expect(await screen.findByText(/연락처를 다시 확인해 주세요/)).toBeInTheDocument();
      expect(sendMock).not.toHaveBeenCalled();
    });

    // 검증 시점이 「전송 직전」에서 「팝업 열기 직전」으로 옮겨 왔다 (SIS-36).
    // 검증에 걸리면 팝업이 아예 뜨지 않으므로, 왜 아무 일도 없는지 알려 줄 자리가 필요하다.
    it("검증에 걸리면 팝업이 뜨지 않고 한 줄로 알린다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openForm(user);
      await fillAttending(user, { count: "0" });

      await user.click(await screen.findByRole("checkbox"));
      await pressSubmit(user);

      expect(screen.getByTestId("toast")).toHaveTextContent("입력을 확인해 주세요");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // 무엇이 틀렸는지는 각 칸의 인라인 오류가 말한다. 토스트가 그 문장을 되풀이하면
    // 스크린리더가 같은 내용을 두 번 읽는다.
    it("검증 실패 알림은 상세를 되풀이하지 않는다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openForm(user);
      await fillAttending(user, { phone: "000-00" });

      await user.click(await screen.findByRole("checkbox"));
      await pressSubmit(user);

      await screen.findByText(/연락처를 다시 확인해 주세요/);
      expect(screen.getByTestId("toast")).not.toHaveTextContent("연락처");
    });

    // 걸린 칸이 여럿이어도 첫 칸으로 초점이 간다. 화면 밖 칸이 틀렸으면 어디를
    // 고쳐야 하는지 알 수 없다.
    it("검증에 걸리면 첫 오류 칸으로 초점이 간다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openForm(user);
      await fillAttending(user, { count: "0", phone: "000-00" });

      await user.click(await screen.findByRole("checkbox"));
      await pressSubmit(user);

      await waitFor(() => expect(screen.getByLabelText("참석 인원 (본인 포함)")).toHaveFocus());
    });
  });

  // 여러 명이 와도 번호는 하나만 받는다 (SIS-36). placeholder 는 형식 예시를 그대로
  // 들고 있어야 해서(review-guard.mjs 의 예시 목록) 라벨 아래 자리를 따로 두었다.
  describe("연락처 안내 문구", () => {
    it("참석이면 대표 한 분만 남기라고 알린다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openForm(user);
      await fillAttending(user);

      const help = screen.getByText(/대표 한 분의 연락처만 남겨주세요/);
      expect(help).toBeInTheDocument();
      // 안내가 칸에 묶여 있어야 스크린리더가 함께 읽는다.
      expect(screen.getByLabelText("연락처")).toHaveAttribute("aria-describedby", expect.stringContaining(help.id));
    });

    it("형식 예시는 안내와 별개로 남는다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openForm(user);
      await fillAttending(user);

      // 하이픈 없이 적어도 된다는 정보가 안내 문구에 밀려 사라지면 안 된다.
      expect(screen.getByLabelText("연락처")).toHaveAttribute("placeholder", expect.stringContaining("ex)"));
    });

    // 인원 개념이 없는 자리에서 「대표 한 분」은 말이 되지 않는다. 미참석은 연락처가
    // 필수가 되면서(SIS-37) 안내할 것 자체가 없어졌다.
    it("미참석이면 안내 문구가 붙지 않는다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openForm(user);
      await fillDeclining(user);

      expect(await screen.findByLabelText("연락처")).toBeInTheDocument();
      expect(screen.queryByText(/대표 한 분의 연락처만 남겨주세요/)).not.toBeInTheDocument();
    });
  });

  // 회신은 보내고 나면 고칠 창구가 없다. 나가기 전에 한 번 되짚는 자리다 (SIS-36).
  describe("확인 팝업", () => {
    it("제출 버튼은 전송하지 않고 팝업을 연다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      const dialog = await openConfirm(user);

      expect(within(dialog).getByRole("heading", { name: "내용 확인" })).toBeInTheDocument();
      expect(sendMock).not.toHaveBeenCalled();
    });

    it("참석 회신은 채운 여섯 항목을 모두 보여준다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      const dialog = await openConfirm(user);

      const rows = within(dialog)
        .getAllByRole("term")
        .map((dt) => dt.textContent);
      expect(rows).toEqual(["하객 구분", "참석 여부", "성함", "참석 인원", "연락처", "식사 여부"]);
      // 보이는 값이 곧 저장되는 값이다 — 연락처는 하이픈이 걷힌 모양으로 보인다.
      expect(within(dialog).getByText("00000000000")).toBeInTheDocument();
      expect(within(dialog).getByText("2명")).toBeInTheDocument();
    });

    // 미참석의 인원 1·식사안함은 DB 의 not null 을 채우려고 넣은 값이라 화면에
    // 내보내면 고르지도 않은 답을 확인하게 된다.
    it("미참석 회신에서는 인원·식사를 싣지 않는다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      const dialog = await openConfirm(user, fillDeclining);

      const rows = within(dialog)
        .getAllByRole("term")
        .map((dt) => dt.textContent);
      expect(rows).toEqual(["하객 구분", "참석 여부", "성함", "연락처"]);
      expect(within(dialog).queryByText("식사안함")).not.toBeInTheDocument();
    });

    it("「뒤로」로 닫으면 폼이 채운 그대로 남는다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      const dialog = await openConfirm(user);

      await user.click(within(dialog).getByRole("button", { name: "뒤로" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.getByLabelText("성함")).toHaveValue("홍길동");
      expect(screen.getByLabelText("연락처")).toHaveValue("000-0000-0000");
      expect(screen.getByRole("checkbox")).toBeChecked();
      expect(sendMock).not.toHaveBeenCalled();
    });

    it("우상단 X 로도 값을 지키며 닫힌다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      const dialog = await openConfirm(user);

      await user.click(within(dialog).getByRole("button", { name: "닫기" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.getByLabelText("참석 인원 (본인 포함)")).toHaveValue("2");
      expect(sendMock).not.toHaveBeenCalled();
    });

    // 닫은 뒤 초점이 문서 맨 앞으로 떨어지면, 키보드로 훑던 사람이 폼을 다시 찾아
    // 내려와야 한다.
    it("닫으면 눌렀던 제출 버튼으로 초점이 돌아온다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      const dialog = await openConfirm(user);

      await user.click(within(dialog).getByRole("button", { name: "뒤로" }));

      await waitFor(() => expect(screen.getByRole("button", { name: "참석 의사 전하기" })).toHaveFocus());
    });
  });

  describe("제출", () => {
    it("정상 입력이면 스키마에 맞는 값을 보내고 완료 카드로 바뀐다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openConfirm(user);
      await confirmSend(user);

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
      // 팝업은 폼 안에 그려지고 폼은 완료 카드로 갈릴 때 통째로 사라진다. 여기서
      // 오버레이가 남으면 완료 카드가 그 뒤에 가려진 채 화면이 잠긴다.
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // 축의 대조·답례·회신 정정에 이 번호 말고는 창구가 없다 (SIS-37).
    it("미참석 회신도 연락처를 실어 보낸다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openConfirm(user, fillDeclining);
      await confirmSend(user);

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
      await fillDeclining(user, { phone: "000-00" });

      await user.click(await screen.findByRole("checkbox"));
      await pressSubmit(user);

      expect(await screen.findByText(/연락처를 다시 확인해 주세요/)).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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
      const dialog = await openConfirm(user);
      await confirmSend(user);

      expect(await screen.findByTestId("toast")).toHaveTextContent(/실패/);
      expect(screen.queryByText(/참석 의사가 전달되었습니다/)).not.toBeInTheDocument();
      // 팝업을 닫아 버리면 하객이 여섯 항목을 처음부터 다시 확인해야 한다 (SIS-36).
      expect(dialog).toBeInTheDocument();
      await waitFor(() => expect(within(dialog).getByRole("button", { name: "확인" })).toBeEnabled());
      // 그 자리에서 다시 누를 수 있다.
      await confirmSend(user);
      expect(sendMock).toHaveBeenCalledTimes(2);
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
