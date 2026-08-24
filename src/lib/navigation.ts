import { GUESTBOOK_PATH, resolveRoute, type Route } from "./route";

const INVITATION_PATH = "/";

let invitationScrollY = 0;
let openedByPush = false;

export function currentRoute(): Route {
  return resolveRoute(window.location.pathname);
}

function announce(): void {
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function subscribeRoute(listener: (route: Route) => void): () => void {
  const handle = () => {
    const route = currentRoute();
    if (route !== "guestbook") openedByPush = false;
    listener(route);
  };

  window.addEventListener("popstate", handle);
  return () => window.removeEventListener("popstate", handle);
}

export function openGuestbook(): void {
  invitationScrollY = window.scrollY;
  openedByPush = true;
  window.history.pushState(null, "", GUESTBOOK_PATH);
  announce();
}

export function closeGuestbook(): void {
  if (openedByPush) {
    window.history.back();
    return;
  }

  window.history.replaceState(null, "", INVITATION_PATH);
  announce();
}

export function invitationScroll(): number {
  return invitationScrollY;
}
