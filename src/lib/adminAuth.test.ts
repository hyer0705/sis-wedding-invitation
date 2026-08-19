import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAdmin, signIn, signOut } from "./adminAuth";
import { getAdminSupabase } from "./supabase";

vi.mock("./supabase", () => ({ getAdminSupabase: vi.fn() }));

function mockClient({
  signInError = null,
  adminResult = { data: true, error: null },
}: {
  signInError?: { message: string } | null;
  adminResult?: { data: unknown; error: unknown };
} = {}) {
  const signInWithPassword = vi.fn().mockResolvedValue({ error: signInError });
  const supabaseSignOut = vi.fn().mockResolvedValue({ error: null });
  const rpc = vi.fn().mockResolvedValue(adminResult);

  vi.mocked(getAdminSupabase).mockReturnValue({
    auth: { signInWithPassword, signOut: supabaseSignOut },
    rpc,
  } as never);

  return { signInWithPassword, supabaseSignOut, rpc };
}

describe("signIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("로그인 뒤 관리자 권한까지 확인한다", async () => {
    const { signInWithPassword, rpc } = mockClient();

    await expect(signIn("admin@example.com", "pw")).resolves.toBeUndefined();
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "admin@example.com", password: "pw" });
    expect(rpc).toHaveBeenCalledWith("is_admin");
  });

  // 원문(Invalid login credentials)은 로그인하는 사람이 읽을 글이 아니다.
  it("자격 오류를 한국어로 바꾼다", async () => {
    mockClient({ signInError: { message: "Invalid login credentials" } });

    await expect(signIn("admin@example.com", "틀린값")).rejects.toThrow("이메일 또는 비밀번호가 올바르지 않습니다");
  });

  // 로그인만 된 계정은 RLS 가 회신을 한 건도 주지 않는데, 화면에서는 그것이
  // 「아직 회신이 없어요」와 구별되지 않는다. 세션을 들고 있을 이유가 없다.
  it("관리자가 아니면 곧바로 로그아웃하고 알린다", async () => {
    const { supabaseSignOut } = mockClient({ adminResult: { data: false, error: null } });

    await expect(signIn("guest@example.com", "pw")).rejects.toThrow("관리자 권한이 없습니다");
    expect(supabaseSignOut).toHaveBeenCalled();
  });

  it("권한 확인이 실패해도 세션을 남기지 않는다", async () => {
    const { supabaseSignOut } = mockClient({ adminResult: { data: null, error: { code: "42501", message: "denied" } } });

    await expect(signIn("admin@example.com", "pw")).rejects.toThrow("42501");
    expect(supabaseSignOut).toHaveBeenCalled();
  });
});

describe("isAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("true 만 관리자로 본다", async () => {
    mockClient({ adminResult: { data: null, error: null } });
    await expect(isAdmin()).resolves.toBe(false);
  });
});

describe("signOut", () => {
  it("실패하면 알린다", async () => {
    vi.mocked(getAdminSupabase).mockReturnValue({
      auth: { signOut: vi.fn().mockResolvedValue({ error: { message: "network" } }) },
    } as never);

    await expect(signOut()).rejects.toThrow("로그아웃에 실패했습니다");
  });
});
