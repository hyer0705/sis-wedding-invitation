import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Session } from "@supabase/supabase-js";
import Admin from "./Admin";
import { currentSession, isAdmin, onAuthChange, signIn, signOut } from "../lib/adminAuth";
import { deleteRsvp, listRsvp, type RsvpRow } from "../lib/adminRsvp";

// 인증과 조회를 통째로 덮는다. 여기서 볼 것은 **화면이 무엇을 언제 부르고 결과를
// 어떻게 그리는가** 뿐이다. 실제 요청이 무엇을 어디로 보내는지는 유닛 테스트
// (lib/adminAuth.test.ts · lib/adminRsvp.test.ts)가 따로 본다.
vi.mock("../lib/adminAuth", () => ({
  currentSession: vi.fn(),
  isAdmin: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  onAuthChange: vi.fn(),
}));

// summarize 는 순수 함수라 덮지 않는다 — 집계 숫자가 화면에 제대로 앉는지까지 본다.
vi.mock("../lib/adminRsvp", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/adminRsvp")>();
  return { ...actual, listRsvp: vi.fn(), deleteRsvp: vi.fn() };
});

const sessionMock = vi.mocked(currentSession);
const adminMock = vi.mocked(isAdmin);
const signInMock = vi.mocked(signIn);
const signOutMock = vi.mocked(signOut);
const authChangeMock = vi.mocked(onAuthChange);
const listMock = vi.mocked(listRsvp);
const deleteMock = vi.mocked(deleteRsvp);

/** onAuthChange 에 넘어온 콜백. 로그인·로그아웃 뒤 화면이 바뀌는지 보려면 직접 불러야 한다. */
let notifyAuth: ((session: Session | null) => void) | undefined;

const SESSION = {} as Session;

function row(overrides: Partial<RsvpRow> = {}): RsvpRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    side: "신랑측",
    attend: "참석",
    name: "김민준",
    count: 4,
    meal: "식사함",
    phone: "01012345678",
    created_at: "2026-08-18T12:03:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  notifyAuth = undefined;

  authChangeMock.mockImplementation((handler) => {
    notifyAuth = handler;
    return () => {};
  });
  sessionMock.mockResolvedValue(SESSION);
  adminMock.mockResolvedValue(true);
  listMock.mockResolvedValue([]);
  signOutMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("문지기", () => {
  it("세션이 없으면 로그인 화면을 그린다", async () => {
    sessionMock.mockResolvedValue(null);

    render(<Admin />);

    expect(await screen.findByRole("heading", { name: "관리자 로그인" })).toBeInTheDocument();
    expect(screen.getByLabelText("이메일")).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호")).toBeInTheDocument();
  });

  it("세션이 없으면 회신을 읽지 않는다", async () => {
    sessionMock.mockResolvedValue(null);

    render(<Admin />);
    await screen.findByRole("heading", { name: "관리자 로그인" });

    expect(listMock).not.toHaveBeenCalled();
  });

  // 이 화면이 없으면 같은 상태가 「아직 회신이 없습니다」로 보인다. RLS 는 권한이
  // 없을 때 오류가 아니라 빈 목록을 주기 때문이다.
  it("로그인은 됐지만 등록되지 않은 계정에 안내를 그린다", async () => {
    adminMock.mockResolvedValue(false);

    render(<Admin />);

    expect(await screen.findByRole("heading", { name: "아직 관리자로 등록되지 않았습니다" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그아웃" })).toBeInTheDocument();
  });

  // 이슈의 핵심 규칙 — 목록보다 isAdmin() 을 먼저 본다.
  it("등록되지 않은 계정에는 회신을 읽지 않는다", async () => {
    adminMock.mockResolvedValue(false);

    render(<Admin />);
    await screen.findByRole("heading", { name: "아직 관리자로 등록되지 않았습니다" });

    expect(listMock).not.toHaveBeenCalled();
    expect(screen.queryByText("아직 회신이 없습니다.")).not.toBeInTheDocument();
  });

  it("권한 확인이 실패하면 오류와 다시 시도를 그린다", async () => {
    adminMock.mockRejectedValue(new Error("관리자 확인 실패 (503): 서버에 닿지 못했습니다"));

    render(<Admin />);

    expect(await screen.findByRole("heading", { name: "확인에 실패했습니다" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("서버에 닿지 못했습니다");
  });

  it("로그아웃하면 로그인 화면으로 돌아간다", async () => {
    const user = userEvent.setup();
    adminMock.mockResolvedValue(false);

    render(<Admin />);
    await screen.findByRole("heading", { name: "아직 관리자로 등록되지 않았습니다" });

    await user.click(screen.getByRole("button", { name: "로그아웃" }));
    expect(signOutMock).toHaveBeenCalled();

    // 실제로는 Supabase 가 알려 주는 자리다
    sessionMock.mockResolvedValue(null);
    notifyAuth?.(null);

    expect(await screen.findByRole("heading", { name: "관리자 로그인" })).toBeInTheDocument();
  });
});

describe("로그인", () => {
  beforeEach(() => {
    sessionMock.mockResolvedValue(null);
  });

  it("실패하면 사람이 읽을 메시지를 보여 준다", async () => {
    const user = userEvent.setup();
    signInMock.mockRejectedValue(new Error("이메일 또는 비밀번호가 올바르지 않습니다"));

    render(<Admin />);
    await screen.findByRole("heading", { name: "관리자 로그인" });

    await user.type(screen.getByLabelText("이메일"), "admin@example.com");
    await user.type(screen.getByLabelText("비밀번호"), "틀린비밀번호");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("이메일 또는 비밀번호가 올바르지 않습니다");
    // 화면에 그대로 남아 다시 시도할 수 있어야 한다
    expect(screen.getByRole("button", { name: "로그인" })).toBeEnabled();
  });

  it("권한이 없는 계정이면 그 사실을 알려 준다", async () => {
    const user = userEvent.setup();
    // signIn 은 로그인 직후 권한까지 보고, 아니면 로그아웃한 뒤 던진다(adminAuth.ts)
    signInMock.mockRejectedValue(new Error("이 계정에는 관리자 권한이 없습니다 (admin_users 등록을 확인하세요)"));

    render(<Admin />);
    await screen.findByRole("heading", { name: "관리자 로그인" });

    await user.type(screen.getByLabelText("이메일"), "guest@example.com");
    await user.type(screen.getByLabelText("비밀번호"), "비밀번호");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("관리자 권한이 없습니다");
  });

  it("빈 칸으로 제출하면 요청을 보내지 않는다", async () => {
    const user = userEvent.setup();

    render(<Admin />);
    await screen.findByRole("heading", { name: "관리자 로그인" });

    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("이메일과 비밀번호를 모두 입력해 주세요.");
    expect(signInMock).not.toHaveBeenCalled();
  });

  it("성공하면 회신 화면으로 넘어간다", async () => {
    const user = userEvent.setup();
    signInMock.mockResolvedValue(undefined);

    render(<Admin />);
    await screen.findByRole("heading", { name: "관리자 로그인" });

    await user.type(screen.getByLabelText("이메일"), "admin@example.com");
    await user.type(screen.getByLabelText("비밀번호"), "비밀번호");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => expect(signInMock).toHaveBeenCalledWith("admin@example.com", "비밀번호"));

    // 성공 뒤 화면을 바꾸는 것은 onAuthChange 다
    sessionMock.mockResolvedValue(SESSION);
    notifyAuth?.(SESSION);

    expect(await screen.findByRole("heading", { name: "회신 집계" })).toBeInTheDocument();
  });
});

describe("회신 목록", () => {
  it("한 건도 없으면 그렇게 적는다", async () => {
    render(<Admin />);

    expect(await screen.findByText("아직 회신이 없습니다.")).toBeInTheDocument();
  });

  it("집계를 그린다", async () => {
    listMock.mockResolvedValue([
      row({ id: "a", attend: "참석", count: 4, meal: "식사함", side: "신랑측" }),
      row({ id: "b", attend: "참석", count: 2, meal: "미정", side: "신부측" }),
      row({ id: "c", attend: "미참석", count: 1, side: "신부측" }),
    ]);

    render(<Admin />);
    await screen.findByRole("heading", { name: "회신 집계" });

    // 참석 인원 6명 = 4 + 2 (미참석의 1 은 자리표시 값이라 세지 않는다)
    const headcount = screen.getByText("참석 인원").closest("dl");
    expect(headcount).toHaveTextContent("6명");

    // 「미참석 1」은 필터 버튼에도 있다. 집계 카드 안에서만 찾는다.
    const summary = screen.getByRole("region", { name: "회신 집계" });
    expect(within(summary).getByText("회신 3건")).toBeInTheDocument();
    expect(within(summary).getByText("미참석 1")).toBeInTheDocument();
  });

  // 측별로 나뉘는 것은 건수가 아니라 사람 수다 — 좌석·식수를 나눌 때 보는 값이다.
  it("양가를 인원과 건수로 나눠 그린다", async () => {
    listMock.mockResolvedValue([
      row({ id: "a", attend: "참석", count: 4, side: "신랑측" }),
      row({ id: "b", attend: "참석", count: 3, side: "신랑측" }),
      row({ id: "c", attend: "참석", count: 2, side: "신부측" }),
    ]);

    render(<Admin />);
    await screen.findByRole("heading", { name: "회신 집계" });

    // 「신랑측」은 필터·목록에도 있다. 집계 카드 안에서만 찾는다.
    const summary = screen.getByRole("region", { name: "회신 집계" });

    const groom = within(summary).getByText("신랑측").closest("div");
    expect(groom).toHaveTextContent("7명");
    expect(groom).toHaveTextContent("2건");

    const bride = within(summary).getByText("신부측").closest("div");
    expect(bride).toHaveTextContent("2명");
    expect(bride).toHaveTextContent("1건");
  });

  it("회신 한 건의 내용을 그린다", async () => {
    listMock.mockResolvedValue([row()]);

    render(<Admin />);
    const item = await screen.findByRole("listitem");

    expect(within(item).getByText("김민준")).toBeInTheDocument();
    expect(within(item).getByText("참석")).toBeInTheDocument();
    expect(within(item).getByText("신랑측")).toBeInTheDocument();
    expect(within(item).getByText("4명")).toBeInTheDocument();
    expect(within(item).getByText("식사함")).toBeInTheDocument();
    // 저장값은 숫자만이고 화면에서 하이픈을 붙인다(csv.ts 의 formatPhone)
    expect(within(item).getByText("010-1234-5678")).toBeInTheDocument();
  });

  // 미참석 회신의 count·meal 은 DB not null 을 채우려고 넣은 자리표시 값이다.
  it("미참석 회신에는 인원·식사를 보여 주지 않는다", async () => {
    listMock.mockResolvedValue([row({ attend: "미참석", count: 1, meal: "식사함" })]);

    render(<Admin />);
    const item = await screen.findByRole("listitem");

    expect(within(item).getByText("미참석")).toBeInTheDocument();
    expect(within(item).queryByText("1명")).not.toBeInTheDocument();
    expect(within(item).queryByText("식사함")).not.toBeInTheDocument();
  });

  it("읽지 못하면 오류를 보여 준다", async () => {
    listMock.mockRejectedValue(new Error("회신 조회 실패 (503): 서버에 닿지 못했습니다"));

    render(<Admin />);

    expect(await screen.findByText("회신을 불러오지 못했습니다")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("서버에 닿지 못했습니다");
  });
});

describe("필터", () => {
  beforeEach(() => {
    listMock.mockResolvedValue([
      row({ id: "a", name: "김민준", attend: "참석", side: "신랑측", count: 4 }),
      row({ id: "b", name: "이서연", attend: "미참석", side: "신부측", count: 1 }),
    ]);
  });

  it("참석 여부로 목록을 좁힌다", async () => {
    const user = userEvent.setup();

    render(<Admin />);
    await screen.findByRole("heading", { name: "회신 집계" });
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "참석 1" }));

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText("김민준")).toBeInTheDocument();
  });

  it("이름으로 찾는다", async () => {
    const user = userEvent.setup();

    render(<Admin />);
    await screen.findByRole("heading", { name: "회신 집계" });

    await user.type(screen.getByLabelText("이름이나 연락처로 검색"), "이서");

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText("이서연")).toBeInTheDocument();
  });

  it("맞는 것이 없으면 검색어를 적어 알린다", async () => {
    const user = userEvent.setup();

    render(<Admin />);
    await screen.findByRole("heading", { name: "회신 집계" });

    await user.type(screen.getByLabelText("이름이나 연락처로 검색"), "박도윤");

    expect(await screen.findByText("‘박도윤’와 맞는 회신이 없습니다.")).toBeInTheDocument();
  });

  // 거른 상태로 내려받은 CSV 를 전체로 착각하면 식수를 잘못 주문한다.
  it("집계와 CSV 는 걸러도 전체를 본다", async () => {
    const user = userEvent.setup();

    render(<Admin />);
    await screen.findByRole("heading", { name: "회신 집계" });

    await user.click(screen.getByRole("button", { name: "참석 1" }));

    expect(screen.getByText("회신 2건")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /CSV 내려받기 \(2건\)/ })).toBeInTheDocument();
  });

  it("필터 해제로 되돌린다", async () => {
    const user = userEvent.setup();

    render(<Admin />);
    await screen.findByRole("heading", { name: "회신 집계" });

    await user.click(screen.getByRole("button", { name: "참석 1" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "필터 해제" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("삭제", () => {
  beforeEach(() => {
    listMock.mockResolvedValue([row({ id: "a", name: "김민준" }), row({ id: "b", name: "이서연" })]);
  });

  it("바로 지우지 않고 확인을 먼저 받는다", async () => {
    const user = userEvent.setup();

    render(<Admin />);
    await screen.findByRole("heading", { name: "회신 집계" });

    await user.click(within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: "삭제" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "이 회신을 지울까요?" })).toBeInTheDocument();
    // 누구를 지우는지 팝업에 다시 적는다
    expect(within(dialog).getByText(/김민준/)).toBeInTheDocument();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("취소하면 아무것도 지우지 않는다", async () => {
    const user = userEvent.setup();

    render(<Admin />);
    await screen.findByRole("heading", { name: "회신 집계" });

    await user.click(within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: "삭제" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "취소" }));

    expect(deleteMock).not.toHaveBeenCalled();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("Esc 로도 닫힌다", async () => {
    const user = userEvent.setup();

    render(<Admin />);
    await screen.findByRole("heading", { name: "회신 집계" });

    await user.click(within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: "삭제" }));
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("확인하면 지우고 목록에서 걷어낸다", async () => {
    const user = userEvent.setup();
    deleteMock.mockResolvedValue(undefined);

    render(<Admin />);
    await screen.findByRole("heading", { name: "회신 집계" });

    await user.click(within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: "삭제" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith("a"));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    expect(screen.queryByText("김민준")).not.toBeInTheDocument();
  });

  it("실패하면 목록을 그대로 두고 이유를 알린다", async () => {
    const user = userEvent.setup();
    deleteMock.mockRejectedValue(new Error("회신 삭제 실패: 지워진 행이 없습니다 — 권한이 없거나 이미 지워진 회신입니다"));

    render(<Admin />);
    await screen.findByRole("heading", { name: "회신 집계" });

    await user.click(within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: "삭제" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "삭제" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("지워진 행이 없습니다");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("개인정보", () => {
  it("CSV 에 무엇이 들었는지 버튼 옆에 적는다", async () => {
    listMock.mockResolvedValue([row()]);

    render(<Admin />);
    await screen.findByRole("heading", { name: "회신 집계" });

    const note = screen.getByText(/하객의 이름과 연락처가 들어 있습니다/);
    expect(note).toBeInTheDocument();
    // 버튼을 읽을 때 함께 읽히도록 묶어 둔다
    expect(screen.getByRole("button", { name: /CSV 내려받기/ })).toHaveAccessibleDescription(
      expect.stringContaining("이름과 연락처"),
    );
  });

  it("회신이 없으면 내려받기를 잠근다", async () => {
    render(<Admin />);
    await screen.findByRole("heading", { name: "회신 집계" });

    expect(screen.getByRole("button", { name: /CSV 내려받기/ })).toBeDisabled();
  });
});

describe("방명록 탭", () => {
  it("준비 중임을 알린다 — SIS-21 이 백엔드를 세운 뒤 채운다", async () => {
    const user = userEvent.setup();

    render(<Admin />);
    await screen.findByRole("heading", { name: "회신 집계" });

    await user.click(screen.getByRole("tab", { name: "방명록" }));

    expect(screen.getByText("방명록은 준비 중입니다")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "회신 집계" })).not.toBeInTheDocument();
  });

  it("회신 탭으로 되돌아온다", async () => {
    const user = userEvent.setup();

    render(<Admin />);
    await screen.findByRole("heading", { name: "회신 집계" });

    await user.click(screen.getByRole("tab", { name: "방명록" }));
    await user.click(screen.getByRole("tab", { name: /회신/ }));

    expect(screen.getByRole("heading", { name: "회신 집계" })).toBeInTheDocument();
  });
});
