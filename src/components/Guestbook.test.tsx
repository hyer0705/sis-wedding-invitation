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

// 지우기 팝업이 대상 글을 그대로 다시 보여주므로, 같은 글이 화면에 둘이 된다.
// 「목록에 남아 있는가」를 물을 때는 목록 안에서만 찾는다.
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

  // 메인은 다섯 건까지만 보인다. 여섯 번째가 있는지로 「전체보기」를 띄울지 정하므로,
  // 건수를 따로 세는 요청은 나가지 않는다.
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

  // 비밀번호 하한은 DB 함수의 가드와 같은 값이다. 화면이 더 느슨하면 그 글만 22023 으로
  // 거부되고, 하객에게는 원인이 보이지 않는 안내 한 줄만 뜬다.
  it("비밀번호가 짧으면 보내지 않는다", async () => {
    const user = userEvent.setup();
    renderWithMotion(<Guestbook />);

    const dialog = await openWriteDialog(user);
    await user.type(within(dialog).getByLabelText("이름"), "김하객");
    await user.type(within(dialog).getByLabelText("축하 메시지"), "축하드려요");
    await user.type(within(dialog).getByLabelText("비밀번호"), "12");
    await user.click(within(dialog).getByRole("button", { name: "남기기" }));

    expect(createGuestbookEntry).not.toHaveBeenCalled();
    // 안내 문구(gb-help)도 「4자 이상」을 담고 있으므로 오류만 골라 본다.
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

  // 전송이 실패했는데 팝업이 닫히면 하객은 방금 쓴 글을 통째로 잃고 처음부터 다시 쓴다.
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

  // 비밀번호가 틀린 것은 전송 실패가 아니라 대조 실패다. 팝업이 닫히면 다시 처음부터다.
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

  // 메인은 최신 다섯 건을 보이는 자리라, 한 건이 빠지면 여섯 번째가 올라와야 한다.
  // 쌓아 둔 쪽이 없어 되감길 것도 없다 — 전체보기는 반대로 그 항목만 뺀다.
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

  // 저장은 됐는데 갱신만 실패한 경우다. 읽어 둔 글까지 안내 문구로 덮으면 하객은
  // 저장이 안 된 줄 알고 같은 글을 한 번 더 남긴다.
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
