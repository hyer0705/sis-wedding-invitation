import { describe, expect, it } from "vitest";
import { isAdminPath } from "./route";

describe("isAdminPath", () => {
  it("/admin 이면 관리자 화면이다", () => {
    expect(isAdminPath("/admin")).toBe(true);
  });

  // 어느 쪽으로 들어와도 사람에게는 같은 주소다.
  it("끝 슬래시와 대소문자를 가리지 않는다", () => {
    expect(isAdminPath("/admin/")).toBe(true);
    expect(isAdminPath("/Admin")).toBe(true);
  });

  it("청첩장 주소는 관리자가 아니다", () => {
    expect(isAdminPath("/")).toBe(false);
    expect(isAdminPath("")).toBe(false);
  });

  // SPA fallback 때문에 오타 주소도 전부 앱에 도달한다. 그때 관리자 화면이
  // 열리면 안 되고, 하객에게는 청첩장이 보여야 한다.
  it("비슷하지만 다른 주소는 청첩장으로 본다", () => {
    expect(isAdminPath("/admin/rsvp")).toBe(false);
    expect(isAdminPath("/administrator")).toBe(false);
    expect(isAdminPath("/admin-page")).toBe(false);
  });
});
