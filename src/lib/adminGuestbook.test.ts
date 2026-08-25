import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteGuestbookAsAdmin, filterGuestbook, listGuestbook } from "./adminGuestbook";
import { getAdminSupabase } from "./supabase";
import type { GuestbookEntry } from "./guestbook";

vi.mock("./supabase", () => ({ getAdminSupabase: vi.fn() }));

function entry(overrides: Partial<GuestbookEntry> = {}): GuestbookEntry {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    name: "김민준",
    message: "결혼 축하합니다",
    createdAt: "2026-08-24T12:03:00.000Z",
    ...overrides,
  };
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    name: "김민준",
    message: "결혼 축하합니다",
    created_at: "2026-08-24T12:03:00.000Z",
    ...overrides,
  };
}

function stubList(result: { data: unknown; error: unknown }) {
  const second = vi.fn().mockResolvedValue(result);
  const first = vi.fn().mockReturnValue({ order: second });
  const select = vi.fn().mockReturnValue({ order: first });
  const from = vi.fn().mockReturnValue({ select });
  vi.mocked(getAdminSupabase).mockReturnValue({ from } as never);

  return { from, select, first, second };
}

describe("listGuestbook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("최신순으로 읽고 camelCase 로 옮긴다", async () => {
    const { from, first, second } = stubList({ data: [row()], error: null });

    await expect(listGuestbook()).resolves.toEqual([entry()]);
    expect(from).toHaveBeenCalledWith("guestbook");
    expect(first).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(second).toHaveBeenCalledWith("id", { ascending: false });
  });

  it("password_hash 가 딸려 오지 않도록 컬럼을 지정해 읽는다", async () => {
    const { select } = stubList({ data: [], error: null });

    await listGuestbook();

    expect(select).toHaveBeenCalledWith("id, name, message, created_at");
    expect(select).not.toHaveBeenCalledWith("*");
  });

  it("오류를 던진다", async () => {
    stubList({ data: null, error: { code: "42501", message: "denied" } });

    await expect(listGuestbook()).rejects.toThrow("42501");
  });

  it("권한이 없어 0건이 와도 오류로 보지 않는다", async () => {
    stubList({ data: [], error: null });

    await expect(listGuestbook()).resolves.toEqual([]);
  });
});

describe("deleteGuestbookAsAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function stubDelete(result: { data: unknown; error: unknown }) {
    const select = vi.fn().mockResolvedValue(result);
    const eq = vi.fn().mockReturnValue({ select });
    const del = vi.fn().mockReturnValue({ eq });
    const rpc = vi.fn();
    vi.mocked(getAdminSupabase).mockReturnValue({ from: () => ({ delete: del }), rpc } as never);

    return { del, eq, rpc };
  }

  it("테이블 정책으로 지운다", async () => {
    const { eq, rpc } = stubDelete({ data: [{ id: "a" }], error: null });

    await expect(deleteGuestbookAsAdmin("a")).resolves.toBeUndefined();
    expect(eq).toHaveBeenCalledWith("id", "a");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("지워진 행이 없으면 실패로 본다", async () => {
    stubDelete({ data: [], error: null });

    await expect(deleteGuestbookAsAdmin("a")).rejects.toThrow("지워진 행이 없습니다");
  });

  it("오류를 던진다", async () => {
    stubDelete({ data: null, error: { code: "42501", message: "denied" } });

    await expect(deleteGuestbookAsAdmin("a")).rejects.toThrow("42501");
  });
});

describe("filterGuestbook", () => {
  const entries = [
    entry({ id: "a", name: "김민준", message: "두 분의 앞날을 축복합니다" }),
    entry({ id: "b", name: "이서연", message: "행복하게 잘 사세요" }),
  ];

  it("검색어가 비면 전부 준다", () => {
    expect(filterGuestbook(entries, "   ")).toHaveLength(2);
  });

  it("이름으로 찾는다", () => {
    expect(filterGuestbook(entries, "이서")).toEqual([entries[1]]);
  });

  it("내용으로도 찾는다", () => {
    expect(filterGuestbook(entries, "축복")).toEqual([entries[0]]);
  });

  it("맞는 것이 없으면 빈 목록을 준다", () => {
    expect(filterGuestbook(entries, "박도윤")).toEqual([]);
  });

  it("원본을 건드리지 않는다", () => {
    const result = filterGuestbook(entries, "");
    result.pop();

    expect(entries).toHaveLength(2);
  });
});
