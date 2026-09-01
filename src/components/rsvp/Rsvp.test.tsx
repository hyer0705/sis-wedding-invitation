import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMotion } from "../../test/renderWithMotion";
import Rsvp from "./Rsvp";
import { submitRsvp } from "../../lib/rsvp";

vi.mock("../../lib/rsvp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/rsvp")>();
  return { ...actual, submitRsvp: vi.fn() };
});

const sendMock = vi.mocked(submitRsvp);

const BEFORE_DEADLINE = new Date("2026-08-18T12:00:00+09:00").getTime();
const AFTER_DEADLINE = new Date("2027-01-24T00:00:00+09:00").getTime();

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

async function openForm(user: User) {
  await user.click(screen.getByRole("button", { name: "참석 여부 알리기" }));
  await screen.findByRole("button", { name: "신랑측 하객" });
}

async function fillAttending(user: User, { count = "2", phone = "000-0000-0000" } = {}) {
  await user.click(screen.getByRole("button", { name: "신랑측 하객" }));
  await user.click(await screen.findByRole("button", { name: "참석합니다" }));
  await user.type(await screen.findByLabelText("성함"), "홍길동");
  await user.type(await screen.findByLabelText("참석 인원 (본인 포함)"), count);
  await user.type(await screen.findByLabelText("연락처"), phone);
  await user.click(await screen.findByRole("button", { name: "식사함" }));
}

async function fillDeclining(user: User, { phone = "000-0000-0000" } = {}) {
  await user.click(screen.getByRole("button", { name: "신부측 하객" }));
  await user.click(await screen.findByRole("button", { name: "참석 어려워요" }));
  await user.type(await screen.findByLabelText("성함"), "김하객");
  await user.type(await screen.findByLabelText("연락처"), phone);
}

async function pressSubmit(user: User) {
  await user.click(await screen.findByRole("button", { name: "참석 의사 전하기" }));
}

async function confirmSend(user: User) {
  const dialog = await screen.findByRole("dialog");
  await user.click(within(dialog).getByRole("button", { name: "확인" }));
}

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

  describe("단계별 노출", () => {
    it("앞 항목을 채워야 다음 항목이 나타난다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openForm(user);

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

    it("미참석이면 성함 다음이 연락처고, 채워야 동의가 나온다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openForm(user);

      await user.click(screen.getByRole("button", { name: "신부측 하객" }));
      await user.click(await screen.findByRole("button", { name: "참석 어려워요" }));
      await user.type(await screen.findByLabelText("성함"), "김하객");

      const phone = await screen.findByLabelText("연락처");
      expect(phone).toHaveValue("");
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

  describe("연락처 안내 문구", () => {
    it("참석이면 대표 한 분만 남기라고 알린다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openForm(user);
      await fillAttending(user);

      const help = screen.getByText(/대표 한 분의 연락처만 남겨주세요/);
      expect(help).toBeInTheDocument();
      expect(screen.getByLabelText("연락처")).toHaveAttribute("aria-describedby", expect.stringContaining(help.id));
    });

    it("형식 예시는 안내와 별개로 남는다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openForm(user);
      await fillAttending(user);

      expect(screen.getByLabelText("연락처")).toHaveAttribute("placeholder", expect.stringContaining("ex)"));
    });

    it("미참석이면 안내 문구가 붙지 않는다", async () => {
      const user = userEvent.setup();
      renderWithMotion(<Rsvp />);
      await openForm(user);
      await fillDeclining(user);

      expect(await screen.findByLabelText("연락처")).toBeInTheDocument();
      expect(screen.queryByText(/대표 한 분의 연락처만 남겨주세요/)).not.toBeInTheDocument();
    });
  });

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
      expect(within(dialog).getByText("00000000000")).toBeInTheDocument();
      expect(within(dialog).getByText("2명")).toBeInTheDocument();
    });

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
        phone: "00000000000",
      });

      expect(await screen.findByText(/참석 의사가 전달되었습니다/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "참석 의사 전하기" })).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

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
        count: 1,
        meal: "식사안함",
        phone: "00000000000",
      });
    });

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

    it("전송이 실패하면 완료 카드로 넘어가지 않고 다시 시도할 수 있다", async () => {
      const user = userEvent.setup();
      const logged = vi.spyOn(console, "error").mockImplementation(() => {});
      sendMock.mockRejectedValue(new Error("network"));
      renderWithMotion(<Rsvp />);
      const dialog = await openConfirm(user);
      await confirmSend(user);

      expect(await screen.findByTestId("toast")).toHaveTextContent(/실패/);
      expect(screen.queryByText(/참석 의사가 전달되었습니다/)).not.toBeInTheDocument();
      expect(dialog).toBeInTheDocument();
      await waitFor(() => expect(within(dialog).getByRole("button", { name: "확인" })).toBeEnabled());
      await confirmSend(user);
      expect(sendMock).toHaveBeenCalledTimes(2);
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
    async function reachConsent(user: User) {
      await openForm(user);
      await fillAttending(user);
      await screen.findByRole("checkbox");
    }

    it("수집 항목에 연락처가 들어 있다", async () => {
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
