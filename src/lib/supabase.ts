// SIS-33 — Supabase 클라이언트. RSVP(SIS-20)·방명록(SIS-21)이 이 하나를 공유한다.
//
// 이 청첩장은 정적 배포라 서버가 없다. 브라우저가 Supabase 를 직접 부르며,
// 접근 통제는 전적으로 RLS 정책(supabase/schema.sql)이 한다. 그래서 클라이언트에
// 박히는 publishable 키는 노출되어도 되는 값이고, **RLS 가 유일한 방어선**이다.
//
// R2 자격증명과 정반대다. R2 는 `VITE_` 를 붙이면 안 되고, 여기는 붙여야 한다.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_KEY = "VITE_SUPABASE_URL";
const PUBLISHABLE_KEY = "VITE_SUPABASE_PUBLISHABLE_KEY";

/**
 * 환경변수 형식을 검증한다. 순수 함수이며 테스트가 직접 부른다.
 *
 * 값이 틀린 채로 배포되면 하객의 참석 회신이 조용히 실패한다 — 폼은 그대로
 * 동작하는 것처럼 보이므로 아무도 모른다. 그래서 형식을 여기서 좁게 막는다.
 *
 * @returns 사람이 읽을 오류 메시지. 문제가 없으면 null
 */
export function supabaseEnvError(url: string | undefined, key: string | undefined): string | null {
  if (!url || !key) {
    const missing = [!url && URL_KEY, !key && PUBLISHABLE_KEY].filter(Boolean).join(", ");
    return `${missing} 가 설정되지 않았습니다 (.env 확인)`;
  }

  // Project ID(project ref)만 적어 넣기 쉬운 자리다. 전체 URL 이어야 한다.
  if (!/^https:\/\/[^/\s]+$/.test(url.replace(/\/+$/, ""))) {
    return `${URL_KEY} 가 https 절대 URL 이 아닙니다 — Project ID 가 아니라 https://<project-ref>.supabase.co 형식이어야 합니다`;
  }

  // 시크릿 키가 `VITE_` 로 들어오면 청첩장 JS 에 그대로 박혀 RLS 를 통째로
  // 우회할 수 있는 키가 공개된다. 사고의 크기가 달라 별도 메시지로 막는다.
  if (key.startsWith("sb_secret_")) {
    return `${PUBLISHABLE_KEY} 에 secret 키가 들어 있습니다 — 이 값은 브라우저 번들에 박힙니다. publishable 키로 바꾸세요`;
  }
  // 레거시 anon 키(JWT)도 아직은 동작하지만 2026년 말 지원이 끝난다. 그때 조용히
  // 죽는 것보다 지금 막는 편이 낫다 — 예식은 2027년 1월이다.
  if (!key.startsWith("sb_publishable_")) {
    return `${PUBLISHABLE_KEY} 형식이 아닙니다 — 대시보드 Settings → API Keys 의 sb_publishable_ 로 시작하는 값을 쓰세요 (레거시 anon 키는 2026년 말 지원 종료)`;
  }
  return null;
}

let client: SupabaseClient | null = null;

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

/** 환경변수가 갖춰졌는지. 폼을 그릴지 판단하는 데 쓴다(SIS-15). */
export function isSupabaseConfigured(): boolean {
  return supabaseEnvError(envUrl, envKey) === null;
}

/**
 * 클라이언트를 한 번만 만들어 재사용한다. 모듈 최상단에서 만들지 않는 이유는
 * 환경변수가 없는 환경(CI·테스트)에서 import 만으로 터지지 않게 하기 위해서다.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  const error = supabaseEnvError(envUrl, envKey);
  if (error) throw new Error(error);

  client = createClient(envUrl as string, envKey as string, {
    // 로그인이 없는 청첩장이다. 세션을 만들지 않으므로 localStorage 를 건드릴
    // 이유가 없고, 사생활 보호 모드에서 저장이 막혀도 영향받지 않는다.
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
