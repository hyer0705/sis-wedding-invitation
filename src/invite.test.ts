import { afterEach, describe, expect, it, vi } from "vitest";
import { INVITE } from "./invite";
import type { Parent } from "./lib/parents";

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

  describe("배포 주소", () => {
    it("카카오톡 스크래퍼가 읽을 수 있는 https 절대 URL 이다", () => {
      // 상대 경로나 http 면 카톡 공유 카드에 썸네일이 뜨지 않는다 (CM-06).
      expect(INVITE.siteUrl).toMatch(/^https:\/\/[^/]+$/);
    });

    it("끝에 슬래시를 붙이지 않는다", () => {
      // og:image 를 `${siteUrl}/og-image.jpg` 로 만들기 때문에 슬래시가 겹치면
      // 경로가 깨진다.
      expect(INVITE.siteUrl).not.toMatch(/\/$/);
    });
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

      // 오전/오후 표기는 실행 환경의 ICU 빌드에 따라 "오전"과 "AM"으로 갈린다
      // (CI 러너가 그렇다). 로케일에 기대지 않도록 24시간제 숫자로 비교한다.
      const hour = new Intl.DateTimeFormat("en-US", { timeZone: KST, hour: "numeric", hour12: false }).format(
        new Date(INVITE.dateISO),
      );
      expect(hour).toBe("11");
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
      // D-Day 계산과 경계 문구는 src/lib/countdown.ts가 담당하고 그쪽 테스트가 검증한다.
      // 여기서는 dateISO를 기준으로 잰 잔여 일수가 KST에서 맞는지만 고정한다.
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2027-01-14T11:00:00+09:00"));
      const days = Math.floor((new Date(INVITE.dateISO).getTime() - Date.now()) / 86_400_000);
      expect(days).toBe(10);
    });
  });

  describe("혼주 표기", () => {
    it("신랑측 혼주는 아버지 한 분이다", () => {
      // 어머니를 표기하지 않기로 고객이 확정했다(2026-08-11). 항목을 되살리면
      // 환경변수가 비었을 때 폴백 mock 이 하객 화면에 그대로 나간다 —
      // scripts/verify-release.mjs 의 필수 환경변수 목록도 함께 봐야 한다.
      expect(INVITE.groom.parents).toHaveLength(1);
    });

    it("신부측 아버지가 고인으로 표시돼 있다", () => {
      // IN-04. 계좌 목록에 신부 아버지가 없는 것과 같은 이유다.
      expect(INVITE.bride.parents[0].deceased).toBe(true);
    });

    it("혼주 목록을 readonly 로 잠가 둔다", () => {
      // INVITE 는 모듈 싱글턴이라 한 번 변형되면 페이지가 살아 있는 동안 유지된다.
      // as const 가 나머지 필드를 지켜 주므로 이 배열만 mutable 로 새 나가면 안 된다.
      // 캐스트가 `as Parent[]` 로 되돌아가면 아래 억제가 쓸모없어져 tsc 가 실패한다.
      // @ts-expect-error readonly Parent[] 는 Parent[] 에 할당할 수 없다
      const mutable: Parent[] = INVITE.groom.parents;
      expect(mutable).toBe(INVITE.groom.parents);
    });

    it("모든 혼주에 성함이 채워져 있다", () => {
      for (const parent of [...INVITE.groom.parents, ...INVITE.bride.parents]) {
        expect(parent.name.trim()).not.toBe("");
      }
    });
  });

  describe("인사말", () => {
    it("본문이 비어 있지 않다", () => {
      // IN-01. 빈 배열이면 카드에 제목과 구분선만 남는다.
      expect(INVITE.greeting.body.length).toBeGreaterThan(0);
      for (const paragraph of INVITE.greeting.body) {
        expect(paragraph.trim()).not.toBe("");
      }
    });
  });

  describe("RSVP 마감일", () => {
    it("deadlineText 가 deadline 과 같은 날을 가리킨다", () => {
      const [y, m, d] = INVITE.rsvp.deadline.split("-").map(Number);
      expect(INVITE.rsvp.deadlineText).toBe(`${y}년 ${m}월 ${d}일까지`);
    });

    it("예식일보다 앞선다", () => {
      // 마감이 예식 뒤면 회신을 받을 이유가 없다. 예식 일시를 옮길 때 함께 보라는 뜻이다.
      expect(new Date(`${INVITE.rsvp.deadline}T23:59:59+09:00`).getTime()).toBeLessThan(new Date(INVITE.dateISO).getTime());
    });
  });

  describe("공유 카드 문구", () => {
    // SH-01·SH-03. 이 값이 카톡 공유 카드(src/lib/share.ts)와 OG 태그(vite.config.ts 의
    // inviteMeta)에 동시에 나간다. 둘이 각자 문구를 조합하던 시절에는 한쪽만 고치면
    // 카드와 메타 태그가 서로 다른 말을 했다(SIS-16).
    it("제목에 신랑·신부 이름이 들어 있다", () => {
      expect(INVITE.share.title).toContain(INVITE.groom.name);
      expect(INVITE.share.title).toContain(INVITE.bride.name);
    });

    it("설명이 예식 일시·장소 표기와 어긋나지 않는다", () => {
      // 예식 일시나 예식장이 바뀌면 여기서 먼저 깨진다. 공유 카드만 옛 값을 실은 채
      // 배포되는 것을 막는 자리다.
      expect(INVITE.share.description).toContain(INVITE.dateText);
      expect(INVITE.share.description).toContain(INVITE.dayText);
      expect(INVITE.share.description).toContain(INVITE.venue);
      expect(INVITE.share.description).toContain(INVITE.hall);
    });

    it("한 줄이다", () => {
      // meta 태그 속성에 개행이 들어가면 스크래퍼마다 다르게 읽는다. 카카오 카드는
      // 폭에 맞춰 알아서 접으므로 줄 나눔을 여기서 정하지 않는다.
      expect(INVITE.share.description).not.toContain("\n");
      expect(INVITE.share.title).not.toContain("\n");
    });

    it("제목·설명·버튼 문구가 비어 있지 않다", () => {
      for (const text of Object.values(INVITE.share)) {
        expect(text.trim()).not.toBe("");
      }
    });
  });

  describe("계좌", () => {
    // 건수는 여기서 세지 않는다. 계좌는 환경변수로만 들어오므로 건수를 단언하면 .env 가
    // 있는 로컬에서만 통과하는 테스트가 된다. 측당 2건인지는 배포 게이트가 확인한다
    // (scripts/verify-release.mjs 의 EXPECTED_ACCOUNTS).
    it("환경변수가 없으면 비어 있다 — mock 으로 메우지 않는다", () => {
      // 폴백이 되살아나면 이 단언이 깨진다. 형식이 조금 어긋난 환경변수를 가짜 계좌로
      // 메우면 하객이 엉뚱한 곳으로 축의금을 보내게 된다(SIS-13 검토).
      expect(INVITE.accounts.groom).toEqual([]);
      expect(INVITE.accounts.bride).toEqual([]);
    });

    it("읽어 낸 계좌에는 은행·번호·예금주가 채워져 있다", () => {
      // 위 테스트대로 지금은 비어 있어 이 반복문은 돌지 않는다. 형식 검증의 본체는
      // parseAccounts 쪽에 있다(src/lib/private-data.test.ts).
      for (const account of [...INVITE.accounts.groom, ...INVITE.accounts.bride]) {
        expect(account.bank).not.toBe("");
        expect(account.number).not.toBe("");
        expect(account.holder).not.toBe("");
      }
    });
  });
});
