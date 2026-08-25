import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminGuestbook from "./AdminGuestbook";
import { deleteGuestbookAsAdmin, listGuestbook } from "../lib/adminGuestbook";
import { deleteGuestbookEntry } from "../lib/guestbook";
import type { GuestbookEntry } from "../lib/guestbook";

vi.mock("../lib/adminGuestbook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/adminGuestbook")>();
  return { ...actual, listGuestbook: vi.fn(), deleteGuestbookAsAdmin: vi.fn() };
});

vi.mock("../lib/guestbook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/guestbook")>();
  return { ...actual, deleteGuestbookEntry: vi.fn() };
});

const listMock = vi.mocked(listGuestbook);
const deleteMock = vi.mocked(deleteGuestbookAsAdmin);
const guestDeleteMock = vi.mocked(deleteGuestbookEntry);

function entry(overrides: Partial<GuestbookEntry> = {}): GuestbookEntry {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    name: "김민준",
    message: "두 분의 앞날을 축복합니다",
    createdAt: "2026-08-24T12:03:00.000Z",
    ...overrides,
  };
}

const TWO = [
  entry({ id: "a", name: "김민준", message: "두 분의 앞날을 축복합니다" }),
  entry({ id: "b", name: "이서연", message: "행복하게 잘 사세요" }),
];

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue([]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("목록", () => {
  it("한 건도 없으면 그렇게 적는다", async () => {
    render(<AdminGuestbook />);

    expect(await screen.findByText("아직 남겨 주신 메시지가 없습니다.")).toBeInTheDocument();
  });

  it("건수와 메시지를 그린다", async () => {
    listMock.mockResolvedValue(TWO);

    render(<AdminGuestbook />);
    await screen.findByRole("heading", { name: "방명록" });

    expect(screen.getByText("남겨 주신 메시지").closest("dl")).toHaveTextContent("2건");

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("김민준")).toBeInTheDocument();
    expect(within(items[0]).getByText("두 분의 앞날을 축복합니다")).toBeInTheDocument();
  });

  it("페이지를 나누지 않고 한 번에 보여 준다", async () => {
    listMock.mockResolvedValue(Array.from({ length: 24 }, (_, index) => entry({ id: `id-${index}` })));

    render(<AdminGuestbook />);
    await screen.findByRole("heading", { name: "방명록" });

    expect(screen.getAllByRole("listitem")).toHaveLength(24);
    expect(screen.queryByRole("button", { name: "더보기" })).not.toBeInTheDocument();
  });

  it("읽지 못하면 오류를 보여 준다", async () => {
    listMock.mockRejectedValue(new Error("방명록 조회 실패 (503): 서버에 닿지 못했습니다"));

    render(<AdminGuestbook />);

    expect(await screen.findByText("방명록을 불러오지 못했습니다")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("서버에 닿지 못했습니다");
  });
});

describe("검색", () => {
  beforeEach(() => {
    listMock.mockResolvedValue(TWO);
  });

  it("이름으로 좁힌다", async () => {
    const user = userEvent.setup();

    render(<AdminGuestbook />);
    await screen.findByRole("heading", { name: "방명록" });

    await user.type(screen.getByLabelText("이름이나 내용으로 검색"), "이서");

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText("이서연")).toBeInTheDocument();
  });

  it("내용으로도 좁힌다", async () => {
    const user = userEvent.setup();

    render(<AdminGuestbook />);
    await screen.findByRole("heading", { name: "방명록" });

    await user.type(screen.getByLabelText("이름이나 내용으로 검색"), "행복");

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("맞는 것이 없으면 검색어를 적어 알린다", async () => {
    const user = userEvent.setup();

    render(<AdminGuestbook />);
    await screen.findByRole("heading", { name: "방명록" });

    await user.type(screen.getByLabelText("이름이나 내용으로 검색"), "박도윤");

    expect(await screen.findByText("‘박도윤’ 검색 결과가 없습니다.")).toBeInTheDocument();
  });

  it("좁혀도 전체 건수는 그대로 둔다", async () => {
    const user = userEvent.setup();

    render(<AdminGuestbook />);
    await screen.findByRole("heading", { name: "방명록" });

    await user.type(screen.getByLabelText("이름이나 내용으로 검색"), "이서");

    expect(screen.getByText("남겨 주신 메시지").closest("dl")).toHaveTextContent("2건");
  });

  it("검색을 지우면 되돌아온다", async () => {
    const user = userEvent.setup();

    render(<AdminGuestbook />);
    await screen.findByRole("heading", { name: "방명록" });

    await user.type(screen.getByLabelText("이름이나 내용으로 검색"), "이서");
    await user.click(screen.getByRole("button", { name: "검색 지우기" }));

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("삭제", () => {
  beforeEach(() => {
    listMock.mockResolvedValue(TWO);
  });

  async function openDialog() {
    const user = userEvent.setup();

    render(<AdminGuestbook />);
    await screen.findByRole("heading", { name: "방명록" });

    await user.click(within(screen.getAllByRole("listitem")[0]).getByRole("button", { name: /삭제/ }));
    return { user, dialog: await screen.findByRole("dialog") };
  }

  it("바로 지우지 않고 확인을 먼저 받는다", async () => {
    const { dialog } = await openDialog();

    expect(within(dialog).getByRole("heading", { name: "이 메시지를 지울까요?" })).toBeInTheDocument();
    expect(within(dialog).getByText("김민준")).toBeInTheDocument();
    expect(within(dialog).getByText("두 분의 앞날을 축복합니다")).toBeInTheDocument();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("긴 글은 뒤를 자르되 이모지를 쪼개지 않는다", async () => {
    const long = `${"가".repeat(79)}🎉${"나".repeat(30)}`;
    listMock.mockResolvedValue([entry({ id: "a", message: long })]);

    const { dialog } = await openDialog();

    const quote = dialog.querySelector(".admin-gb-quote");
    expect(quote?.textContent).toBe(`${"가".repeat(79)}🎉…`);
    expect(quote?.textContent).not.toContain("�");
  });

  it("취소하면 아무것도 지우지 않는다", async () => {
    const { user, dialog } = await openDialog();

    await user.click(within(dialog).getByRole("button", { name: "취소" }));

    expect(deleteMock).not.toHaveBeenCalled();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("Esc 로도 닫힌다", async () => {
    const { user } = await openDialog();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it("확인하면 지우고 목록에서 걷어낸다", async () => {
    deleteMock.mockResolvedValue(undefined);
    const { user, dialog } = await openDialog();

    await user.click(within(dialog).getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith("a"));
    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    expect(screen.queryByText("두 분의 앞날을 축복합니다")).not.toBeInTheDocument();
  });

  it("비밀번호를 묻지 않고 하객용 삭제를 부르지 않는다", async () => {
    deleteMock.mockResolvedValue(undefined);
    const { user, dialog } = await openDialog();

    expect(within(dialog).queryByLabelText(/비밀번호/)).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(deleteMock).toHaveBeenCalled());
    expect(guestDeleteMock).not.toHaveBeenCalled();
  });

  it("실패하면 목록을 그대로 두고, 오류에 글 내용을 싣지 않는다", async () => {
    deleteMock.mockRejectedValue(new Error("방명록 삭제 실패: 지워진 행이 없습니다 — 권한이 없거나 이미 지워진 메시지입니다"));
    const { user, dialog } = await openDialog();

    await user.click(within(dialog).getByRole("button", { name: "삭제" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("지워진 행이 없습니다");
    expect(alert).not.toHaveTextContent("두 분의 앞날을 축복합니다");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});
