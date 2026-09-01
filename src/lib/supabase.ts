import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_KEY = "VITE_SUPABASE_URL";
const PUBLISHABLE_KEY = "VITE_SUPABASE_PUBLISHABLE_KEY";

export function supabaseEnvError(url: string | undefined, key: string | undefined): string | null {
  if (!url || !key) {
    const missing = [!url && URL_KEY, !key && PUBLISHABLE_KEY].filter(Boolean).join(", ");
    return `${missing} 가 설정되지 않았습니다 (.env 확인)`;
  }

  if (!/^https:\/\/[^/\s]+$/.test(url.replace(/\/+$/, ""))) {
    return `${URL_KEY} 가 https 절대 URL 이 아닙니다 — Project ID 가 아니라 https://<project-ref>.supabase.co 형식이어야 합니다`;
  }

  if (key.startsWith("sb_secret_")) {
    return `${PUBLISHABLE_KEY} 에 secret 키가 들어 있습니다 — 이 값은 브라우저 번들에 박힙니다. publishable 키로 바꾸세요`;
  }
  if (!key.startsWith("sb_publishable_")) {
    return `${PUBLISHABLE_KEY} 형식이 아닙니다 — 대시보드 Settings → API Keys 의 sb_publishable_ 로 시작하는 값을 쓰세요 (레거시 anon 키는 2026년 말 지원 종료)`;
  }
  return null;
}

let client: SupabaseClient | null = null;

const envUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export function isSupabaseConfigured(): boolean {
  return supabaseEnvError(envUrl, envKey) === null;
}

export function getSupabase(): SupabaseClient {
  if (client) return client;

  const error = supabaseEnvError(envUrl, envKey);
  if (error) throw new Error(error);

  client = createClient(envUrl as string, envKey as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

let adminClient: SupabaseClient | null = null;

export function getAdminSupabase(): SupabaseClient {
  if (adminClient) return adminClient;

  const error = supabaseEnvError(envUrl, envKey);
  if (error) throw new Error(error);

  adminClient = createClient(envUrl as string, envKey as string, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "sis-admin-auth" },
  });
  return adminClient;
}
