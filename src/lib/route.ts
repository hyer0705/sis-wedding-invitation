export type Route = "invitation" | "admin" | "guestbook";

const ADMIN_PATH = "/admin";

export const GUESTBOOK_PATH = "/guestbook";

export function resolveRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, "").toLowerCase();

  if (path === ADMIN_PATH) return "admin";
  if (path === GUESTBOOK_PATH) return "guestbook";
  return "invitation";
}
