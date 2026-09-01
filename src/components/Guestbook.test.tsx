import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMotion } from "../test/renderWithMotion";
import Guestbook from "./Guestbook";
import {
  createGuestbookEntry,
  deleteGuestbookEntry,
  fetchGuestbookPage,
  type GuestbookEntry,
  type GuestbookPage,
} from "../lib/guestbook";

vi.mock("../lib/guestbook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/guestbook")>();
  return {
    ...actual,
    fetchGuestbookPage: vi.fn(),
    createGuestbookEntry: vi.fn(),
    deleteGuestbookEntry: vi.fn(),
  };
});

function entry(index: number): GuestbookEntry {
  return {
    id: `id-${index}`,
    name: `하객${index}`,
    message: `축하해요 ${index}`,
    createdAt: `2026-08-${String(22 - index).padStart(2, "0")}T00:00:00.000Z`,
  };
}

function page(count: number, more = false): GuestbookPage {
  const entries = Array.from({ length: count }, (_, index) => entry(index));
  return { entries, nextCursor: more ? entries[entries.length - 1].createdAt : null };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchGuestbookPage).mockResolvedValue(page(0));
});

async function openWriteDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "축하 메시지 남기기" }));
  return screen.findByRole("dialog");
}

function list() {
  return screen.getByRole("list", { name: "남겨 주신 축하 메시지" });
}

describe("Guestbook 목록", () => {
  it("아직 글이 없으면 첫 마디를 청한다", async () => {
    renderWithMotion(<Guestbook />);

    expect(await screen.findByText(/아직 남겨진 축하 메시지가 없어요/)).toBeInTheDocument();
  });

  it("불러오지 못하면 안내를 띄운다", async () => {
    vi.mocked(fetchGuestbookPage).mockRejectedValue(new Error("네트워크 실패"));
    renderWithMotion(<Guestbook />);

    expect(await screen.findByText(/불러오지 못했어요/)).toBeInTheDocument();
  });

  it("다섯 건을 넘으면 전체보기를 보여준다", async () => {
    vi.mocked(fetchGuestbookPage).mockResolvedValue(page(5, true));
    renderWithMotion(<Guestbook />);

    expect(await screen.findByRole("button", { name: "전체보기" })).toBeInTheDocument();
  });

  it("더 없으면 전체보기를 감춘다", async () => {
    vi.mocked(fetchGuestbookPage).mockResolvedValue(page(5));
    renderWithMotion(<Guestbook />);

    await screen.findByText("축하해요 0");
    expect(screen.queryByRole("button", { name: "전체보기" })).not.toBeInTheDocument();
  });
});

describe("Guestbook 작성", () => {
  it("빈 칸을 채우지 않으면 보내지 않는다", async () => {
    const user = userEvent.setup();
    renderWithMotion(<Guestbook />);

    const dialog = await openWriteDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "남기기" }));

    expect(createGuestbookEntry).not.toHaveBeenCalled();
    expect(await screen.findByText("성함을 입력해 주세요")).toBeInTheDocument();
  });

  it("비밀번호가 짧으면 보내지 않는다", async () => {
    const user = userEvent.setup();
    renderWithMotion(<Guestbook />);

    const dialog = await openWriteDialog(user);
    await user.type(within(dialog).getByLabelText("이름"), "김하객");
    await user.type(within(dialog).getByLabelText("축하 메시지"), "축하드려요");
    await user.type(within(dialog).getByLabelText("비밀번호"), "12");
    await user.click(within(dialog).getByRole("button", { name: "남기기" }));

    expect(createGuestbookEntry).not.toHaveBeenCalled();
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/4자 이상/);
  });

  it("남기면 목록을 다시 읽어 새 글을 보여준다", async () => {
    const user = userEvent.setup();
    vi.mocked(createGuestbookEntry).mockResolvedValue("new-id");
    renderWithMotion(<Guestbook />);

    const dialog = await openWriteDialog(user);
    await user.type(within(dialog).getByLabelText("이름"), "김하객");
    await user.type(within(dialog).getByLabelText("축하 메시지"), "축하드려요");
    await user.type(within(dialog).getByLabelText("비밀번호"), "1234");

    vi.mocked(fetchGuestbookPage).mockResolvedValue({
      entries: [{ id: "new-id", name: "김하객", message: "축하드려요", createdAt: "2026-08-24T00:00:00.000Z" }],
      nextCursor: null,
    });
    await user.click(within(dialog).getByRole("button", { name: "남기기" }));

    expect(createGuestbookEntry).toHaveBeenCalledWith({ name: "김하객", message: "축하드려요", password: "1234" });
    expect(await screen.findByText("축하드려요")).toBeInTheDocument();
  });

  it("전송이 실패해도 팝업을 닫지 않는다", async () => {
    const user = userEvent.setup();
    vi.mocked(createGuestbookEntry).mockRejectedValue(new Error("네트워크 실패"));
    renderWithMotion(<Guestbook />);

    const dialog = await openWriteDialog(user);
    await user.type(within(dialog).getByLabelText("이름"), "김하객");
    await user.type(within(dialog).getByLabelText("축하 메시지"), "축하드려요");
    await user.type(within(dialog).getByLabelText("비밀번호"), "1234");
    await user.click(within(dialog).getByRole("button", { name: "남기기" }));

    await screen.findByText(/남기지 못했어요/);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByLabelText("이름")).toHaveValue("김하객");
  });
});

describe("Guestbook 삭제", () => {
  beforeEach(() => {
    vi.mocked(fetchGuestbookPage).mockResolvedValue(page(3));
  });

  async function openDeleteDialog(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: "하객1 님이 남긴 메시지 지우기" }));
    return screen.findByRole("dialog");
  }

  it("비밀번호가 틀리면 팝업을 닫지 않고 알린다", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteGuestbookEntry).mockResolvedValue(false);
    renderWithMotion(<Guestbook />);

    const dialog = await openDeleteDialog(user);
    await user.type(within(dialog).getByLabelText("비밀번호"), "9999");
    await user.click(within(dialog).getByRole("button", { name: "지우기" }));

    expect(await screen.findByText("비밀번호가 맞지 않습니다")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(list()).getByText("축하해요 1")).toBeInTheDocument();
  });

  it("지운 뒤 다시 읽어 다음 글을 올린다", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteGuestbookEntry).mockResolvedValue(true);
    renderWithMotion(<Guestbook />);

    const dialog = await openDeleteDialog(user);
    vi.mocked(fetchGuestbookPage).mockResolvedValue({
      entries: [entry(0), entry(2), entry(3)],
      nextCursor: null,
    });
    await user.type(within(dialog).getByLabelText("비밀번호"), "1234");
    await user.click(within(dialog).getByRole("button", { name: "지우기" }));

    expect(deleteGuestbookEntry).toHaveBeenCalledWith("id-1", "1234");
    await waitFor(() => expect(within(list()).getByText("축하해요 3")).toBeInTheDocument());
    expect(within(list()).queryByText("축하해요 1")).not.toBeInTheDocument();
  });

  it("갱신이 실패해도 읽어 둔 글은 그대로 둔다", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteGuestbookEntry).mockResolvedValue(true);
    renderWithMotion(<Guestbook />);

    const dialog = await openDeleteDialog(user);
    vi.mocked(fetchGuestbookPage).mockRejectedValue(new Error("네트워크 실패"));
    await user.type(within(dialog).getByLabelText("비밀번호"), "1234");
    await user.click(within(dialog).getByRole("button", { name: "지우기" }));

    await waitFor(() => expect(deleteGuestbookEntry).toHaveBeenCalled());
    expect(within(list()).getByText("축하해요 0")).toBeInTheDocument();
    expect(screen.queryByText(/불러오지 못했어요/)).not.toBeInTheDocument();
  });
});
