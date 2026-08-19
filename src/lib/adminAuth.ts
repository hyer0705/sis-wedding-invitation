// SIS-22 — 관리자 로그인. AD-01 의 「비밀번호 접근 제한」을 Supabase Auth 로 푼다.
//
// **비밀번호는 이 코드 어디에도 없다.** 정적 사이트라 번들에 넣는 순간 누구나
// 꺼내 볼 수 있고, `.env` 도 빌드 결과물에 박히므로 마찬가지다. 대조는 Supabase 가
// 하고, 여기는 입력을 넘겨 세션을 받아 오는 일만 한다.
//
// 계정은 대시보드에서 만든다. 이 리포에는 이메일도 uuid 도 적지 않는다.
import type { Session } from "@supabase/supabase-js";
import { getAdminSupabase } from "./supabase";

/**
 * Supabase 가 돌려주는 영문 메시지를 화면에 그대로 띄우지 않는다.
 *
 * 원문(`Invalid login credentials`)은 로그인하는 사람이 읽을 글이 아니고, 무엇을
 * 다시 해야 하는지도 알려 주지 않는다.
 */
function loginErrorMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return "이메일 또는 비밀번호가 올바르지 않습니다";
  if (/email not confirmed/i.test(message)) return "이메일 인증이 끝나지 않은 계정입니다 (Supabase 대시보드에서 확인하세요)";
  if (/too many requests|rate limit/i.test(message)) return "시도가 잦아 잠시 막혔습니다. 조금 뒤에 다시 시도해 주세요";
  return `로그인에 실패했습니다: ${message}`;
}

/** 이 계정이 관리자로 등록되어 있는지. RLS 와 같은 함수를 본다(supabase/schema.sql). */
export async function isAdmin(): Promise<boolean> {
  const { data, error } = await getAdminSupabase().rpc("is_admin");
  if (error) throw new Error(`관리자 확인 실패 (${error.code || "unknown"}): ${error.message}`);
  return data === true;
}

/**
 * 로그인한다. 성공하면 세션이 브라우저에 남아 새로고침해도 유지된다.
 *
 * **로그인 직후 관리자인지까지 확인하고, 아니면 곧바로 로그아웃한다.** 로그인은
 * 됐지만 admin_users 에 없는 계정은 RLS 가 회신을 한 건도 주지 않는데, 그 상태는
 * 화면에서 「회신이 아직 없어요」와 구별되지 않는다. 명단이 비어 보이는 것을
 * 권한 문제로 알아채려면 여기서 갈라 두어야 한다.
 *
 * @throws 사람이 읽을 한국어 메시지
 */
export async function signIn(email: string, password: string): Promise<void> {
  const supabase = getAdminSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(loginErrorMessage(error.message));

  // 권한 확인이 오류로 끝나도 세션은 남는다. 들고 있을 이유가 없으므로 걷어낸다.
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

/** 저장된 세션. 새로고침 직후 로그인 화면을 건너뛸지 판단하는 데 쓴다. */
export async function currentSession(): Promise<Session | null> {
  const { data } = await getAdminSupabase().auth.getSession();
  return data.session;
}

/**
 * 로그인·로그아웃·토큰 갱신을 구독한다. 반환값을 부르면 구독이 끊긴다.
 *
 * 탭을 두 개 열어 둔 경우까지 맞추기 위한 것이다 — 한쪽에서 로그아웃하면
 * 다른 쪽도 로그인 화면으로 돌아가야 한다.
 */
export function onAuthChange(handler: (session: Session | null) => void): () => void {
  const { data } = getAdminSupabase().auth.onAuthStateChange((_event, session) => handler(session));
  return () => data.subscription.unsubscribe();
}
