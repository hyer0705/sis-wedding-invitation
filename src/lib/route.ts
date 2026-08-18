// SIS-22 — 주소로 화면을 가른다. 청첩장(/)과 관리자(/admin) 둘뿐이다.
//
// 라우팅 라이브러리를 쓰지 않는 이유는 main.tsx 머리말에 적었다. 요약하면 화면이
// 둘뿐인데 react-router 가 하객 번들을 41KB 불렸다.
//
// **알 수 없는 주소는 전부 청첩장이다.** vercel.json 의 SPA fallback 때문에 오타
// 주소도 이 앱에 도달하는데, 하객이 링크를 잘못 눌렀을 때 빈 화면이나 404 를
// 보여 줄 이유가 없다.
const ADMIN_PATH = "/admin";

/**
 * 관리자 화면을 그려야 하는 주소인지.
 *
 * 끝 슬래시는 무시한다 — `/admin` 과 `/admin/` 은 사람에게 같은 주소이고, 어느
 * 쪽으로 들어와도 화면이 떠야 한다. 대소문자도 가리지 않는다.
 */
export function isAdminPath(pathname: string): boolean {
  return pathname.replace(/\/+$/, "").toLowerCase() === ADMIN_PATH;
}
