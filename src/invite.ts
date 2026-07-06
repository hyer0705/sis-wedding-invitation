// 고객 정보 단일 소스 — 모든 화면 문구·D-Day·지도 링크·계좌 복사가 이 상수만 참조한다.
// 계좌 정보는 고객이 서면으로 확정한 값만 반영할 것 (현재 placeholder 상태 → npm run verify가 배포를 막음)
export const INVITE = {
  groom: {
    name: "박희빈",
    first: "희빈",
    father: "박○○",
    mother: "○○○",
    bank: "○○은행",
    account: "000-000-000000",
    holder: "박희빈",
  },
  bride: {
    name: "조혜정",
    first: "혜정",
    father: "유○○",
    mother: "○○○",
    bank: "○○은행",
    account: "000-000-000000",
    holder: "조혜정",
  },
  dateISO: "2026-12-06T11:00:00+09:00",
  dateDots: "2026 . 12 . 06",
  dateText: "2026년 12월 6일",
  dayText: "일요일 오전 11시",
  venue: "신도림 웨스턴베니스",
  hall: "7F 다이너스티홀",
  address: "서울 구로구 경인로 577",
  transport: {
    subway: "1·2호선 신도림역 3번 출구 도보 5분",
    car: "내비게이션 “웨스턴베니스” 검색",
    parking: "건물 내 주차장 2시간 무료",
  },
} as const;
