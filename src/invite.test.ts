import { afterEach, describe, expect, it, vi } from "vitest";
import { INVITE } from "./invite";

// 예식 일시는 화면 문구·D-Day·.ics·OG 태그·지도 링크가 모두 물려 있는 값이다.
// 표기(dateDots·dateText·dayText)와 기계값(dateISO)이 어긋나면 어디서도 에러가
// 나지 않고 잘못된 날짜가 그대로 배포되므로, 여기서 서로를 대조한다.
const KST = "Asia/Seoul";

function inKST(options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: KST, ...options }).format(new Date(INVITE.dateISO));
}

describe("INVITE", () => {
  it("mock 데이터인 동안 isMock 플래그가 켜져 있다", () => {
    // 이 값이 false가 되는 순간 배포 게이트가 열린다. 고객 확정값을 전부
    // 반영한 뒤에만 바꾼다 (docs/WORKFLOW.md §10).
    expect(INVITE.isMock).toBe(true);
  });

  it("미채택 기능의 필드를 만들지 않는다", () => {
    // 연락처(CT-01·02·03)는 시트에 번호가 채워져 있어도 쓰지 않는다.
    expect(INVITE).not.toHaveProperty("contact");
    expect(INVITE.groom).not.toHaveProperty("phone");
    expect(INVITE.bride).not.toHaveProperty("phone");
    // 셔틀버스(MP-06)·피로연(NT-02)도 미채택이다.
    expect(INVITE.transport).not.toHaveProperty("shuttle");
    expect(INVITE).not.toHaveProperty("reception");
  });

  describe("예식 일시", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("dateISO에 KST 오프셋이 명시돼 있다", () => {
      // 오프셋이 없으면 실행 환경의 시간대로 해석돼 D-Day가 하루씩 틀어진다.
      expect(INVITE.dateISO).toMatch(/T\d{2}:\d{2}:\d{2}\+09:00$/);
    });

    it("dateText가 dateISO와 같은 날을 가리킨다", () => {
      expect(inKST({ year: "numeric", month: "long", day: "numeric" })).toBe("2027년 1월 24일");
      expect(INVITE.dateText).toBe("2027년 1월 24일");
    });

    it("dayText의 요일과 시각이 dateISO와 일치한다", () => {
      expect(inKST({ weekday: "long" })).toBe("일요일");
      expect(inKST({ hour: "numeric", minute: "2-digit", hour12: true })).toBe("오전 11:00");
      expect(INVITE.dayText).toBe("일요일 오전 11시");
    });

    it("dateDots가 dateISO와 같은 날짜다", () => {
      const [y, m, d] = INVITE.dateISO.slice(0, 10).split("-");
      expect(INVITE.dateDots).toBe(`${y} . ${m} . ${d}`);
    });

    it("실행 환경 시간대와 무관하게 같은 순간을 가리킨다", () => {
      // CI는 TZ=Asia/Seoul로 돌지만 개발자 로컬은 다를 수 있다.
      // 오프셋이 박혀 있으므로 epoch 값은 어디서 읽어도 같아야 한다.
      expect(new Date(INVITE.dateISO).getTime()).toBe(Date.UTC(2027, 0, 24, 2, 0, 0));
    });

    it("KST 기준으로 남은 일수를 센다", () => {
      // D-Day 계산 자체는 SIS-26에서 src/lib으로 분리하며 경계 문구까지 검증한다.
      // 여기서는 dateISO를 기준으로 잰 잔여 일수가 KST에서 맞는지만 고정한다.
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2027-01-14T11:00:00+09:00"));
      const days = Math.floor((new Date(INVITE.dateISO).getTime() - Date.now()) / 86_400_000);
      expect(days).toBe(10);
    });
  });

  describe("계좌", () => {
    it("양가 모두 하나 이상의 계좌를 가진다", () => {
      expect(INVITE.accounts.groom.length).toBeGreaterThan(0);
      expect(INVITE.accounts.bride.length).toBeGreaterThan(0);
    });

    it("모든 계좌에 은행·번호·예금주가 채워져 있다", () => {
      for (const account of [...INVITE.accounts.groom, ...INVITE.accounts.bride]) {
        expect(account.bank).not.toBe("");
        expect(account.number).not.toBe("");
        expect(account.holder).not.toBe("");
      }
    });
  });
});
