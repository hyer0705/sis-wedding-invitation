import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithMotion } from "../test/renderWithMotion";
import GuestbookAll from "./GuestbookAll";
import { deleteGuestbookEntry, fetchGuestbookPage, type GuestbookEntry, type GuestbookPage, PAGE_SIZE } from "../lib/guestbook";
import { closeGuestbook } from "../lib/navigation";

vi.mock("../lib/guestbook", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/guestbook")>();
  return { ...actual, fetchGuestbookPage: vi.fn(), deleteGuestbookEntry: vi.fn() };
});

vi.mock("../lib/navigation", () => ({ closeGuestbook: vi.fn() }));

function entry(index: number): GuestbookEntry {
  return {
    id: `id-${index}`,
    name: `하객${index}`,
    message: `축하해요 ${index}`,
    createdAt: `2026-08-24T00:00:${String(59 - index).padStart(2, "0")}.000Z`,
  };
}

function pageFrom(start: number, count: number, more: boolean): GuestbookPage {
  const entries = Array.from({ length: count }, (_, index) => entry(start + index));
  return { entries, nextCursor: more ? entries[entries.length - 1].createdAt : null };
}

function list() {
  return screen.getByRole("list", { name: "남겨 주신 축하 메시지" });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(fetchGuestbookPage).mockResolvedValue(pageFrom(0, PAGE_SIZE, true));
});

describe("GuestbookAll 목록", () => {
  it("첫 쪽을 읽어 보여준다", async () => {
    renderWithMotion(<GuestbookAll />);

    expect(await screen.findByText("축하해요 0")).toBeInTheDocument();
    expect(within(list()).getAllByRole("listitem")).toHaveLength(PAGE_SIZE);
  });

  it("X 를 누르면 청첩장으로 돌아간다", async () => {
    const user = userEvent.setup();
    renderWithMotion(<GuestbookAll />);

    await user.click(await screen.findByRole("button", { name: "청첩장으로 돌아가기" }));

    expect(closeGuestbook).toHaveBeenCalled();
  });

  it("불러오지 못하면 안내를 띄운다", async () => {
    vi.mocked(fetchGuestbookPage).mockRejectedValue(new Error("네트워크 실패"));
    renderWithMotion(<GuestbookAll />);

    expect(await screen.findByText(/불러오지 못했어요/)).toBeInTheDocument();
  });
});

describe("GuestbookAll 더보기", () => {
  it("다음 쪽을 이어 붙인다", async () => {
    const user = userEvent.setup();
    renderWithMotion(<GuestbookAll />);

    await screen.findByText("축하해요 0");
    vi.mocked(fetchGuestbookPage).mockResolvedValue(pageFrom(PAGE_SIZE, PAGE_SIZE, false));
    await user.click(screen.getByRole("button", { name: "더보기" }));

    await waitFor(() => expect(within(list()).getAllByRole("listitem")).toHaveLength(PAGE_SIZE * 2));
    expect(within(list()).getByText("축하해요 0")).toBeInTheDocument();
    expect(within(list()).getByText(`축하해요 ${PAGE_SIZE}`)).toBeInTheDocument();
  });

  it("커서를 넘겨 그보다 이전 글만 청한다", async () => {
    const user = userEvent.setup();
    const first = pageFrom(0, PAGE_SIZE, true);
    vi.mocked(fetchGuestbookPage).mockResolvedValue(first);
    renderWithMotion(<GuestbookAll />);

    await screen.findByText("축하해요 0");
    await user.click(screen.getByRole("button", { name: "더보기" }));

    await waitFor(() => expect(fetchGuestbookPage).toHaveBeenLastCalledWith(first.nextCursor, PAGE_SIZE, expect.anything()));
  });

  it("마지막 쪽이면 더보기를 감춘다", async () => {
    vi.mocked(fetchGuestbookPage).mockResolvedValue(pageFrom(0, 3, false));
    renderWithMotion(<GuestbookAll />);

    await screen.findByText("축하해요 0");
    expect(screen.queryByRole("button", { name: "더보기" })).not.toBeInTheDocument();
  });

  it("더 불러오지 못하면 알리고 읽던 목록은 그대로 둔다", async () => {
    const user = userEvent.setup();
    renderWithMotion(<GuestbookAll />);

    await screen.findByText("축하해요 0");
    vi.mocked(fetchGuestbookPage).mockRejectedValue(new Error("네트워크 실패"));
    await user.click(screen.getByRole("button", { name: "더보기" }));

    expect(await screen.findByText(/더 불러오지 못했어요/)).toBeInTheDocument();
    expect(within(list()).getAllByRole("listitem")).toHaveLength(PAGE_SIZE);
  });
});

describe("GuestbookAll 삭제", () => {
  it("쌓아 둔 쪽을 되감지 않고 지운 글만 뺀다", async () => {
    const user = userEvent.setup();
    renderWithMotion(<GuestbookAll />);

    await screen.findByText("축하해요 0");
    vi.mocked(fetchGuestbookPage).mockResolvedValue(pageFrom(PAGE_SIZE, PAGE_SIZE, false));
    await user.click(screen.getByRole("button", { name: "더보기" }));
    await waitFor(() => expect(within(list()).getAllByRole("listitem")).toHaveLength(PAGE_SIZE * 2));

    vi.mocked(deleteGuestbookEntry).mockResolvedValue(true);
    vi.mocked(fetchGuestbookPage).mockClear();
    await user.click(screen.getByRole("button", { name: "하객3 님이 남긴 메시지 지우기" }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("비밀번호"), "1234");
    await user.click(within(dialog).getByRole("button", { name: "지우기" }));

    await waitFor(() => expect(within(list()).getAllByRole("listitem")).toHaveLength(PAGE_SIZE * 2 - 1));
    expect(within(list()).queryByText("축하해요 3")).not.toBeInTheDocument();
    expect(fetchGuestbookPage).not.toHaveBeenCalled();
  });
});
