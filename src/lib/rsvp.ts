// ⚠ 이 모듈은 SIS-20 에서 Supabase insert(`src/lib/supabase.ts`)로 통째로 교체된다.
// 백엔드를 Supabase 로 확정하면서(SIS-33) `VITE_RSVP_ENDPOINT` 는 `.env.example`
// 에서 이미 뺐다 — 지금 이 코드는 값이 없어 동작하지 않는다. 호출부(Rsvp.tsx)가
// 스텁이고 App.tsx 가 그리지 않으므로 화면에는 영향이 없다.
export interface RsvpPayload {
  side: "신랑측" | "신부측" | "";
  attend: "참석" | "미참석" | "";
  name: string;
  count: string;
  message: string;
}

const ENDPOINT = import.meta.env.VITE_RSVP_ENDPOINT as string | undefined;
const STORAGE_KEY = "rsvp-submitted";

export function alreadySubmitted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

// Apps Script 웹앱은 CORS preflight를 처리하지 못하므로 no-cors + text/plain으로 전송한다.
// 응답 본문은 읽을 수 없다 — 실패해도 조용히 넘어가므로 시트 수신 확인은 배포 체크리스트에서 수행.
export async function submitRsvp(payload: RsvpPayload): Promise<void> {
  if (!ENDPOINT) throw new Error("VITE_RSVP_ENDPOINT가 설정되지 않았습니다 (.env 확인)");
  await fetch(ENDPOINT, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ ...payload, submittedAt: new Date().toISOString() }),
  });
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // 사생활 보호 모드 등에서 localStorage가 막혀도 제출 자체는 성공으로 처리
  }
}
