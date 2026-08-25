import { describe, expect, it } from "vitest";
import { resolveRoute } from "./route";

describe("resolveRoute", () => {
  it("/admin 이면 관리자 화면이다", () => {
    expect(resolveRoute("/admin")).toBe("admin");
  });

  it("/guestbook 이면 방명록 전체보기다", () => {
    expect(resolveRoute("/guestbook")).toBe("guestbook");
  });

  // 어느 쪽으로 들어와도 사람에게는 같은 주소다.
  it("끝 슬래시와 대소문자를 가리지 않는다", () => {
    expect(resolveRoute("/admin/")).toBe("admin");
    expect(resolveRoute("/Admin")).toBe("admin");
    expect(resolveRoute("/guestbook/")).toBe("guestbook");
    expect(resolveRoute("/GuestBook")).toBe("guestbook");
  });

  it("청첩장 주소는 청첩장이다", () => {
    expect(resolveRoute("/")).toBe("invitation");
    expect(resolveRoute("")).toBe("invitation");
  });

  // SPA fallback 때문에 오타 주소도 전부 앱에 도달한다. 그때 관리자 화면이
  // 열리면 안 되고, 하객에게는 청첩장이 보여야 한다.
  it("비슷하지만 다른 주소는 청첩장으로 본다", () => {
    expect(resolveRoute("/admin/rsvp")).toBe("invitation");
    expect(resolveRoute("/administrator")).toBe("invitation");
    expect(resolveRoute("/admin-page")).toBe("invitation");
    expect(resolveRoute("/guestbooks")).toBe("invitation");
    expect(resolveRoute("/guestbook/1")).toBe("invitation");
  });
});
