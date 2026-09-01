import { afterEach, describe, expect, it, vi } from "vitest";
import { INVITE } from "./invite";
import type { Parent } from "./lib/parents";

const KST = "Asia/Seoul";

function inKST(options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: KST, ...options }).format(new Date(INVITE.dateISO));
}

describe("INVITE", () => {
  it("화면에 나가는 값에 mock 이 남아 있지 않다", () => {
    expect(INVITE.isMock).toBe(false);
    expect(INVITE.rsvp).not.toHaveProperty("popup");
  });

  describe("개인정보 수집 항목(RS-03)", () => {
    const COLLECTED = ["이름", "연락처", "참석 여부", "참석 인원 수", "식사 여부", "하객 구분"];

    it("화면 요약이 여섯 항목을 모두 밝힌다", () => {
      const summaryItems = INVITE.rsvp.privacy.summary.find((item) => item.label === "수집 항목")?.value ?? "";

      expect(summaryItems).not.toBe("");
      for (const item of COLLECTED) expect(summaryItems).toContain(item);
    });

    it("전문 1번 항목의 목록이 여섯 항목을 그대로 담는다", () => {
      const [firstSection] = INVITE.rsvp.privacy.policy.sections;
      expect(firstSection.heading).toContain("수집·이용");

      const items = firstSection.blocks.flatMap((block) =>
        block.kind === "list" && "label" in block && block.label === "수집 항목" ? [...block.items] : [],
      );

      expect(items).toHaveLength(COLLECTED.length);
      for (const item of COLLECTED) {
        expect(items.some((line) => line.includes(item))).toBe(true);
      }
    });
  });

  it("미채택 기능의 필드를 만들지 않는다", () => {
    expect(INVITE).not.toHaveProperty("contact");
    expect(INVITE.groom).not.toHaveProperty("phone");
    expect(INVITE.bride).not.toHaveProperty("phone");
    expect(INVITE.transport).not.toHaveProperty("shuttle");
    expect(INVITE).not.toHaveProperty("reception");
  });

  describe("배포 주소", () => {
    it("카카오톡 스크래퍼가 읽을 수 있는 https 절대 URL 이다", () => {
      expect(INVITE.siteUrl).toMatch(/^https:\/\/[^/]+$/);
    });

    it("끝에 슬래시를 붙이지 않는다", () => {
      expect(INVITE.siteUrl).not.toMatch(/\/$/);
    });
  });

  describe("예식 일시", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("dateISO에 KST 오프셋이 명시돼 있다", () => {
      expect(INVITE.dateISO).toMatch(/T\d{2}:\d{2}:\d{2}\+09:00$/);
    });

    it("dateText가 dateISO와 같은 날을 가리킨다", () => {
      expect(inKST({ year: "numeric", month: "long", day: "numeric" })).toBe("2027년 1월 24일");
      expect(INVITE.dateText).toBe("2027년 1월 24일");
    });

    it("dayText의 요일과 시각이 dateISO와 일치한다", () => {
      expect(inKST({ weekday: "long" })).toBe("일요일");

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
      expect(new Date(INVITE.dateISO).getTime()).toBe(Date.UTC(2027, 0, 24, 2, 0, 0));
    });

    it("KST 기준으로 남은 일수를 센다", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2027-01-14T11:00:00+09:00"));
      const days = Math.floor((new Date(INVITE.dateISO).getTime() - Date.now()) / 86_400_000);
      expect(days).toBe(10);
    });
  });

  describe("혼주 표기", () => {
    it("신랑측 혼주는 아버지 한 분이다", () => {
      expect(INVITE.groom.parents).toHaveLength(1);
    });

    it("신부측 아버지가 고인으로 표시돼 있다", () => {
      expect(INVITE.bride.parents[0].deceased).toBe(true);
    });

    it("혼주 목록을 readonly 로 잠가 둔다", () => {
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
      expect(new Date(`${INVITE.rsvp.deadline}T23:59:59+09:00`).getTime()).toBeLessThan(new Date(INVITE.dateISO).getTime());
    });
  });

  describe("공유 카드 문구", () => {
    it("제목에 신랑·신부 이름이 들어 있다", () => {
      expect(INVITE.share.title).toContain(INVITE.groom.name);
      expect(INVITE.share.title).toContain(INVITE.bride.name);
    });

    it("설명이 예식 일시·장소 표기와 어긋나지 않는다", () => {
      expect(INVITE.share.description).toContain(INVITE.dateText);
      expect(INVITE.share.description).toContain(INVITE.dayText);
      expect(INVITE.share.description).toContain(INVITE.venue);
      expect(INVITE.share.description).toContain(INVITE.hall);
    });

    it("한 줄이다", () => {
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
    it("환경변수가 없으면 비어 있다 — mock 으로 메우지 않는다", () => {
      expect(INVITE.accounts.groom).toEqual([]);
      expect(INVITE.accounts.bride).toEqual([]);
    });

    it("읽어 낸 계좌에는 은행·번호·예금주가 채워져 있다", () => {
      for (const account of [...INVITE.accounts.groom, ...INVITE.accounts.bride]) {
        expect(account.bank).not.toBe("");
        expect(account.number).not.toBe("");
        expect(account.holder).not.toBe("");
      }
    });
  });
});
