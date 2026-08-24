import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createGuestbookEntry,
  deleteGuestbookEntry,
  EMPTY_GUESTBOOK_FORM,
  fetchGuestbookPage,
  type GuestbookForm,
  type GuestbookValues,
  MESSAGE_MAX,
  NAME_MAX,
  PAGE_SIZE,
  PASSWORD_MIN,
  passwordError,
  validateGuestbookForm,
} from "./guestbook";
import { getSupabase } from "./supabase";

vi.mock("./supabase", () => ({ getSupabase: vi.fn() }));

function form(overrides: Partial<GuestbookForm> = {}): GuestbookForm {
  return { name: "김하객", message: "결혼 축하드려요", password: "1234", ...overrides };
}

function values(overrides: Partial<GuestbookValues> = {}): GuestbookValues {
  return { name: "김하객", message: "결혼 축하드려요", password: "1234", ...overrides };
}

describe("validateGuestbookForm", () => {
  it("정상 입력을 통과시키고 앞뒤 공백을 걷는다", () => {
    const result = validateGuestbookForm(form({ name: "  김하객  ", message: "  축하해요  " }));

    expect(result).toEqual({ ok: true, values: values({ message: "축하해요" }) });
  });

  it("빈 폼은 세 칸 모두 오류를 낸다", () => {
    const result = validateGuestbookForm(EMPTY_GUESTBOOK_FORM);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["message", "name", "password"]);
  });

  it("공백만 적은 메시지는 통과시키지 않는다", () => {
    const result = validateGuestbookForm(form({ message: "   " }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.message).toBeTruthy();
  });

  it("상한 길이는 통과하고 한 자를 넘기면 막는다", () => {
    expect(validateGuestbookForm(form({ message: "가".repeat(MESSAGE_MAX) })).ok).toBe(true);
    expect(validateGuestbookForm(form({ message: "가".repeat(MESSAGE_MAX + 1) })).ok).toBe(false);
    expect(validateGuestbookForm(form({ name: "가".repeat(NAME_MAX) })).ok).toBe(true);
    expect(validateGuestbookForm(form({ name: "가".repeat(NAME_MAX + 1) })).ok).toBe(false);
  });

  it("비밀번호 하한은 DB 함수의 가드와 같다", () => {
    expect(validateGuestbookForm(form({ password: "1".repeat(PASSWORD_MIN) })).ok).toBe(true);
    expect(validateGuestbookForm(form({ password: "1".repeat(PASSWORD_MIN - 1) })).ok).toBe(false);
  });

  it("비밀번호의 앞뒤 공백은 걷지 않는다", () => {
    const result = validateGuestbookForm(form({ password: " 12 " }));

    expect(result).toEqual({ ok: true, values: values({ password: " 12 " }) });
  });
});

describe("passwordError", () => {
  it("하한을 채우면 오류가 없다", () => {
    expect(passwordError("1".repeat(PASSWORD_MIN))).toBeNull();
  });

  it("모자라면 안내를 돌려준다", () => {
    expect(passwordError("1")).toContain(`${PASSWORD_MIN}자`);
  });
});

interface Row {
  id: string;
  name: string;
  message: string;
  created_at: string;
}

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `id-${index}`,
    name: `하객${index}`,
    message: `축하해요 ${index}`,
    created_at: `2026-08-${String(22 - index).padStart(2, "0")}T00:00:00.000Z`,
  }));
}

type QueryResult = { data: Row[] | null; error: { code: string; message: string } | null };

interface QueryMock {
  from: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  abortSignal: ReturnType<typeof vi.fn>;
}

function mockQuery(result: QueryResult): QueryMock {
  const builder: Record<string, unknown> = {
    then: (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  };

  const select = vi.fn(() => builder);
  const order = vi.fn(() => builder);
  const limit = vi.fn(() => builder);
  const lt = vi.fn(() => builder);
  const abortSignal = vi.fn(() => builder);
  Object.assign(builder, { select, order, limit, lt, abortSignal });

  const from = vi.fn(() => builder);
  vi.mocked(getSupabase).mockReturnValue({ from } as never);

  return { from, select, order, limit, lt, abortSignal };
}

describe("fetchGuestbookPage", () => {
  let lt: ReturnType<typeof vi.fn>;
  let limit: ReturnType<typeof vi.fn>;
  let order: ReturnType<typeof vi.fn>;
  let select: ReturnType<typeof vi.fn>;
  let from: ReturnType<typeof vi.fn>;
  let abortSignal: ReturnType<typeof vi.fn>;

  function respond(result: QueryResult) {
    ({ from, select, order, limit, lt, abortSignal } = mockQuery(result));
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("최신순으로 읽고 id 로 순서를 고정한다", async () => {
    respond({ data: makeRows(3), error: null });

    await fetchGuestbookPage();

    expect(from).toHaveBeenCalledWith("guestbook");
    expect(order).toHaveBeenNthCalledWith(1, "created_at", { ascending: false });
    expect(order).toHaveBeenNthCalledWith(2, "id", { ascending: false });
  });

  it("password_hash 를 요청하지 않는다", async () => {
    respond({ data: [], error: null });

    await fetchGuestbookPage();

    expect(select).toHaveBeenCalledWith("id, name, message, created_at");
    expect(select.mock.calls[0][0]).not.toContain("password");
  });

  it("다음 쪽이 있는지 보려고 한 건을 더 요청한다", async () => {
    respond({ data: [], error: null });

    await fetchGuestbookPage(null, PAGE_SIZE);

    expect(limit).toHaveBeenCalledWith(PAGE_SIZE + 1);
  });

  it("더 있으면 여분을 잘라내고 마지막 시각을 커서로 돌려준다", async () => {
    const rows = makeRows(PAGE_SIZE + 1);
    respond({ data: rows, error: null });

    const page = await fetchGuestbookPage(null, PAGE_SIZE);

    expect(page.entries).toHaveLength(PAGE_SIZE);
    expect(page.entries.at(-1)?.id).toBe(`id-${PAGE_SIZE - 1}`);
    expect(page.nextCursor).toBe(rows[PAGE_SIZE - 1].created_at);
  });

  it("여분이 없으면 커서를 비운다", async () => {
    respond({ data: makeRows(PAGE_SIZE), error: null });

    const page = await fetchGuestbookPage(null, PAGE_SIZE);

    expect(page.entries).toHaveLength(PAGE_SIZE);
    expect(page.nextCursor).toBeNull();
  });

  it("한 건도 없으면 빈 목록과 빈 커서를 돌려준다", async () => {
    respond({ data: [], error: null });

    await expect(fetchGuestbookPage()).resolves.toEqual({ entries: [], nextCursor: null });
  });

  it("커서를 받으면 그보다 이전 글만 읽는다", async () => {
    respond({ data: makeRows(2), error: null });

    await fetchGuestbookPage("2026-08-20T00:00:00.000Z");

    expect(lt).toHaveBeenCalledWith("created_at", "2026-08-20T00:00:00.000Z");
  });

  it("커서가 없으면 범위를 좁히지 않는다", async () => {
    respond({ data: makeRows(2), error: null });

    await fetchGuestbookPage();

    expect(lt).not.toHaveBeenCalled();
  });

  it("컬럼 이름을 화면이 쓰는 이름으로 옮긴다", async () => {
    respond({ data: makeRows(1), error: null });

    const page = await fetchGuestbookPage();

    expect(page.entries[0]).toEqual({
      id: "id-0",
      name: "하객0",
      message: "축하해요 0",
      createdAt: "2026-08-22T00:00:00.000Z",
    });
  });

  it("오류가 돌아오면 던진다", async () => {
    respond({ data: null, error: { code: "42501", message: "permission denied" } });

    await expect(fetchGuestbookPage()).rejects.toThrow(/42501/);
  });

  it("코드가 비어 있어도 던진다", async () => {
    respond({ data: null, error: { code: "", message: "Failed to fetch" } });

    await expect(fetchGuestbookPage()).rejects.toThrow(/unknown/);
  });

  it("취소 신호를 받으면 요청에 함께 실어 보낸다", async () => {
    respond({ data: makeRows(1), error: null });
    const controller = new AbortController();

    await fetchGuestbookPage(null, PAGE_SIZE, controller.signal);

    expect(abortSignal).toHaveBeenCalledWith(controller.signal);
  });

  it("취소 신호가 없으면 붙이지 않는다", async () => {
    respond({ data: makeRows(1), error: null });

    await fetchGuestbookPage();

    expect(abortSignal).not.toHaveBeenCalled();
  });
});

describe("createGuestbookEntry", () => {
  let rpc: ReturnType<typeof vi.fn>;

  function respond(result: { data: unknown; error: { code: string; message: string } | null }) {
    rpc = vi.fn(() => Promise.resolve(result));
    vi.mocked(getSupabase).mockReturnValue({ rpc } as never);
  }

  it("테이블이 아니라 함수를 부른다", async () => {
    respond({ data: "new-id", error: null });

    await expect(createGuestbookEntry(values())).resolves.toBe("new-id");
    expect(rpc).toHaveBeenCalledWith("create_guestbook_entry", {
      entry_name: "김하객",
      entry_message: "결혼 축하드려요",
      entry_password: "1234",
    });
  });

  it("오류가 돌아오면 던진다", async () => {
    respond({ data: null, error: { code: "22023", message: "비밀번호는 4자 이상이어야 합니다" } });

    await expect(createGuestbookEntry(values())).rejects.toThrow(/22023/);
  });
});

describe("deleteGuestbookEntry", () => {
  let rpc: ReturnType<typeof vi.fn>;

  function respond(result: { data: unknown; error: { code: string; message: string } | null }) {
    rpc = vi.fn(() => Promise.resolve(result));
    vi.mocked(getSupabase).mockReturnValue({ rpc } as never);
  }

  it("id 와 비밀번호를 함수에 넘긴다", async () => {
    respond({ data: true, error: null });

    await expect(deleteGuestbookEntry("entry-1", "1234")).resolves.toBe(true);
    expect(rpc).toHaveBeenCalledWith("delete_guestbook_entry", { entry_id: "entry-1", entry_password: "1234" });
  });

  it("비밀번호가 틀리면 오류가 아니라 false 다", async () => {
    respond({ data: false, error: null });

    await expect(deleteGuestbookEntry("entry-1", "9999")).resolves.toBe(false);
  });

  it("오류가 돌아오면 던진다", async () => {
    respond({ data: null, error: { code: "42501", message: "permission denied for function" } });

    await expect(deleteGuestbookEntry("entry-1", "1234")).rejects.toThrow(/42501/);
  });
});
