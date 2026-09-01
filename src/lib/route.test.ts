import { describe, expect, it } from "vitest";
import { resolveRoute } from "./route";

describe("resolveRoute", () => {
  it("/admin 이면 관리자 화면이다", () => {
    expect(resolveRoute("/admin")).toBe("admin");
  });

  it("/guestbook 이면 방명록 전체보기다", () => {
    expect(resolveRoute("/guestbook")).toBe("guestbook");
  });

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

  it("비슷하지만 다른 주소는 청첩장으로 본다", () => {
    expect(resolveRoute("/admin/rsvp")).toBe("invitation");
    expect(resolveRoute("/administrator")).toBe("invitation");
    expect(resolveRoute("/admin-page")).toBe("invitation");
    expect(resolveRoute("/guestbooks")).toBe("invitation");
    expect(resolveRoute("/guestbook/1")).toBe("invitation");
  });
});
