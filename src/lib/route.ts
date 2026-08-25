// SIS-22·SIS-21 — 주소로 화면을 가른다. 청첩장(/)·관리자(/admin)·방명록
// 전체보기(/guestbook) 셋이다.
//
// 라우팅 라이브러리를 쓰지 않는 이유는 main.tsx 머리말에 적었다. 요약하면
// react-router 가 하객 번들을 41KB 불렸고, 경로가 셋으로 늘어도 그 값은 그대로다 —
// 여기서 필요한 것은 문자열 비교뿐이다.
//
// **알 수 없는 주소는 전부 청첩장이다.** vercel.json 의 SPA fallback 때문에 오타
// 주소도 이 앱에 도달하는데, 하객이 링크를 잘못 눌렀을 때 빈 화면이나 404 를
// 보여 줄 이유가 없다.
export type Route = "invitation" | "admin" | "guestbook";

const ADMIN_PATH = "/admin";

/** 방명록 전체보기 주소. 화면 이동이 이 값을 그대로 쓴다(lib/navigation.ts). */
export const GUESTBOOK_PATH = "/guestbook";

/**
 * 주소를 화면으로 옮긴다.
 *
 * 끝 슬래시는 무시한다 — `/admin` 과 `/admin/` 은 사람에게 같은 주소이고, 어느
 * 쪽으로 들어와도 화면이 떠야 한다. 대소문자도 가리지 않는다.
 */
export function resolveRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, "").toLowerCase();

  if (path === ADMIN_PATH) return "admin";
  if (path === GUESTBOOK_PATH) return "guestbook";
  return "invitation";
}
