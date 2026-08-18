import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteRsvp, listRsvp, summarize, type RsvpRow } from "./adminRsvp";
import { getAdminSupabase } from "./supabase";

// rsvp.test.ts 와 같은 이유로 클라이언트째 대신 세운다 — 진짜 프로젝트로 요청이
// 나가면 안 되고, 여기서 볼 것은 "무엇을 부르고 결과를 어떻게 다루는가" 뿐이다.
vi.mock("./supabase", () => ({ getAdminSupabase: vi.fn() }));

function row(overrides: Partial<RsvpRow> = {}): RsvpRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    side: "신랑측",
    attend: "참석",
    name: "홍길동",
    count: 2,
    meal: "식사함",
    phone: "01012345678",
    created_at: "2026-08-18T12:03:00.000Z",
    ...overrides,
  };
}

describe("listRsvp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("최신순으로 읽는다", async () => {
    const order = vi.fn().mockResolvedValue({ data: [row()], error: null });
    const select = vi.fn().mockReturnValue({ order });
    const from = vi.fn().mockReturnValue({ select });
    vi.mocked(getAdminSupabase).mockReturnValue({ from } as never);

    await expect(listRsvp()).resolves.toHaveLength(1);
    expect(from).toHaveBeenCalledWith("rsvp");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("오류를 던진다", async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { code: "42501", message: "denied" } });
    vi.mocked(getAdminSupabase).mockReturnValue({ from: () => ({ select: () => ({ order }) }) } as never);

    await expect(listRsvp()).rejects.toThrow("42501");
  });

  // RLS 는 권한이 없으면 오류가 아니라 빈 목록을 준다. 여기서 갈라내지 않는다는
  // 사실 자체를 고정해 둔다 — 화면이 isAdmin() 을 먼저 부르는 근거다.
  it("권한이 없어 0건이 와도 오류로 보지 않는다", async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    vi.mocked(getAdminSupabase).mockReturnValue({ from: () => ({ select: () => ({ order }) }) } as never);

    await expect(listRsvp()).resolves.toEqual([]);
  });
});

describe("deleteRsvp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockDelete(result: { data: unknown; error: unknown }) {
    const select = vi.fn().mockResolvedValue(result);
    const eq = vi.fn().mockReturnValue({ select });
    const del = vi.fn().mockReturnValue({ eq });
    vi.mocked(getAdminSupabase).mockReturnValue({ from: () => ({ delete: del }) } as never);
    return { del, eq, select };
  }

  it("id 로 한 건만 지운다", async () => {
    const { eq } = mockDelete({ data: [{ id: "abc" }], error: null });

    await expect(deleteRsvp("abc")).resolves.toBeUndefined();
    expect(eq).toHaveBeenCalledWith("id", "abc");
  });

  // 권한이 없으면 오류 없이 0건이 지워진다. 그대로 통과시키면 화면에서는
  // 지워진 것처럼 보이고 새로고침하면 되살아난다.
  it("지워진 행이 없으면 실패로 본다", async () => {
    mockDelete({ data: [], error: null });

    await expect(deleteRsvp("abc")).rejects.toThrow("지워진 행이 없습니다");
  });
});

describe("summarize", () => {
  it("참석·미참석과 인원을 센다", () => {
    const summary = summarize([
      row({ attend: "참석", count: 2, meal: "식사함" }),
      row({ attend: "참석", count: 1, meal: "미정", side: "신부측" }),
      row({ attend: "미참석", count: 1, meal: "식사안함" }),
    ]);

    expect(summary.responses).toBe(3);
    expect(summary.attending).toBe(2);
    expect(summary.absent).toBe(1);
    expect(summary.headcount).toBe(3);
    expect(summary.side).toEqual({ 신랑측: 2, 신부측: 1 });
  });

  // 미참석 회신의 count(1)는 자리표시 값이다. 식수에 더하면 그만큼 더 주문한다.
  it("미참석 회신은 식수에 넣지 않는다", () => {
    const summary = summarize([
      row({ attend: "참석", count: 2, meal: "식사함" }),
      row({ attend: "미참석", count: 1, meal: "식사함" }),
    ]);

    expect(summary.meals).toEqual({ 식사함: 2, 식사안함: 0, 미정: 0 });
    expect(summary.headcount).toBe(2);
  });

  it("빈 목록도 다룬다", () => {
    expect(summarize([])).toEqual({
      responses: 0,
      attending: 0,
      absent: 0,
      headcount: 0,
      meals: { 식사함: 0, 식사안함: 0, 미정: 0 },
      side: { 신랑측: 0, 신부측: 0 },
    });
  });
});
