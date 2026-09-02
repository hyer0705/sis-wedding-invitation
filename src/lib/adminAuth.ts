import type { Session } from "@supabase/supabase-js";
import { getAdminSupabase } from "./supabase";

function loginErrorMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return "이메일 또는 비밀번호가 올바르지 않습니다";
  if (/email not confirmed/i.test(message)) return "이메일 인증이 끝나지 않은 계정입니다 (Supabase 대시보드에서 확인하세요)";
  if (/too many requests|rate limit/i.test(message)) return "시도가 잦아 잠시 막혔습니다. 조금 뒤에 다시 시도해 주세요";
  return `로그인에 실패했습니다: ${message}`;
}

export async function isAdmin(): Promise<boolean> {
  const { data, error } = await getAdminSupabase().rpc("is_admin");
  if (error) throw new Error(`관리자 확인 실패 (${error.code || "unknown"}): ${error.message}`);
  return data === true;
}

export async function signIn(email: string, password: string): Promise<void> {
  const supabase = getAdminSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(loginErrorMessage(error.message));

  const admin = await isAdmin().catch(async (cause: unknown) => {
    await supabase.auth.signOut();
    throw cause;
  });

  if (!admin) {
    await supabase.auth.signOut();
    throw new Error("이 계정에는 관리자 권한이 없습니다 (admin_users 등록을 확인하세요)");
  }
}

export async function signOut(): Promise<void> {
  const { error } = await getAdminSupabase().auth.signOut();
  if (error) throw new Error(`로그아웃에 실패했습니다: ${error.message}`);
}

export async function currentSession(): Promise<Session | null> {
  const { data } = await getAdminSupabase().auth.getSession();
  return data.session;
}

export function onAuthChange(handler: (session: Session | null) => void): () => void {
  const { data } = getAdminSupabase().auth.onAuthStateChange((_event, session) => handler(session));
  return () => data.subscription.unsubscribe();
}
