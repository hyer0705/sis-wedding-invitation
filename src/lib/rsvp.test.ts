import { beforeEach, describe, expect, it } from "vitest";
import { alreadySubmitted, submitRsvp } from "./rsvp";

describe("alreadySubmitted", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("제출 기록이 없으면 false를 반환한다", () => {
    expect(alreadySubmitted()).toBe(false);
  });

  it("제출 기록이 있으면 true를 반환한다", () => {
    localStorage.setItem("rsvp-submitted", "1");
    expect(alreadySubmitted()).toBe(true);
  });
});

describe("submitRsvp", () => {
  // 엔드포인트는 Apps Script 배포 후 .env로 주입된다. 미설정 상태에서 조용히 실패하면
  // 하객 응답이 유실되므로 반드시 에러를 던져야 한다.
  it("VITE_RSVP_ENDPOINT가 없으면 에러를 던진다", async () => {
    await expect(submitRsvp({ side: "신랑측", attend: "참석", name: "홍길동", count: "2", message: "" })).rejects.toThrow(
      "VITE_RSVP_ENDPOINT",
    );
  });
});
