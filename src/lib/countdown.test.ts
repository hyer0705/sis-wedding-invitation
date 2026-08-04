import { describe, expect, it } from "vitest";
import { countdownAt } from "./countdown";

// 예식 시각을 고정값으로 두고 경계 전후를 직접 찍는다. INVITE.dateISO를 쓰지 않는 것은
// 고객이 일시를 바꿔도 경계 로직 자체의 검증이 흔들리지 않게 하기 위함이다.
// INVITE와의 연결은 DDay 컴포넌트 테스트가 확인한다.
const WEDDING = "2027-01-24T11:00:00+09:00";

const at = (iso: string) => countdownAt(WEDDING, new Date(iso).getTime());

describe("countdownAt", () => {
  describe("남은 시간", () => {
    it("KST 기준으로 남은 일수를 센다", () => {
      expect(at("2027-01-14T11:00:00+09:00").days).toBe(10);
    });

    it("일·시·분·초를 두 자리로 채워 나눈다", () => {
      const t = at("2027-01-22T09:58:57+09:00");
      expect(t).toMatchObject({ days: 2, hours: "01", mins: "01", secs: "03" });
    });
  });

  describe("예식 전", () => {
    it("하루 이상 남았으면 예식 전이다", () => {
      expect(at("2027-01-20T11:00:00+09:00")).toMatchObject({ phase: "before", days: 4 });
    });

    it("예식 전날 자정 직전에도 예식 전이다", () => {
      const t = at("2027-01-23T23:59:59+09:00");
      expect(t.phase).toBe("before");
      expect(t.days).toBe(0); // 남은 시간이 하루 미만이므로 일 단위는 0이다
      expect(t.hours).toBe("11");
    });
  });

  describe("예식 당일", () => {
    it("KST 자정을 넘기는 순간 예식 당일로 바뀐다", () => {
      expect(at("2027-01-24T00:00:00+09:00").phase).toBe("wedding-day");
    });

    it("예식 시각 이전에도 예식 당일이며 남은 시간을 센다", () => {
      const t = at("2027-01-24T09:30:00+09:00");
      expect(t.phase).toBe("wedding-day");
      expect(t).toMatchObject({ days: 0, hours: "01", mins: "30", secs: "00" });
    });

    it("예식 시각을 지나도 그날 안이면 예식 당일이고 남은 시간은 0이다", () => {
      const t = at("2027-01-24T23:59:59+09:00");
      expect(t.phase).toBe("wedding-day");
      expect(t).toMatchObject({ days: 0, hours: "00", mins: "00", secs: "00" });
    });
  });

  describe("예식 이후", () => {
    it("다음 날 KST 자정을 넘기면 예식 이후가 된다", () => {
      expect(at("2027-01-25T00:00:00+09:00").phase).toBe("after");
    });

    it("페이지가 유지되는 한 달 뒤에도 예식 이후다", () => {
      // CM-08 — 예식 후 1개월간 페이지가 열려 있다.
      expect(at("2027-02-24T11:00:00+09:00").phase).toBe("after");
    });
  });
});
