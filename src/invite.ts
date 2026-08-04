import { orMock, parseAccounts, type Account } from "./lib/private-data";

// 고객 정보 단일 소스 — 모든 화면 문구·D-Day·지도 링크·계좌 복사가 이 상수만 참조한다.
// 다른 파일에 값을 하드코딩하지 않는다.
//
// isMock 이 true 인 동안 `npm run verify`(배포 게이트)가 실패한다. 고객 확정값을 전부
// 반영한 뒤에만 false 로 바꾼다 — 절차는 docs/WORKFLOW.md §10.
//
// 미채택 기능의 필드는 만들지 않는다. 시트에 값이 채워져 있어도 마찬가지다:
//   연락처(CT-01·02·03) · 셔틀버스(MP-06) · 피로연·폐백(NT-02) · 카카오페이(AC-03)
// 채택 여부의 기준은 docs/FEATURE-MAP.md.
//
// ── 리포에 두지 않는 값 ────────────────────────────────────────────────────
// 계좌와 혼주 성함은 환경변수로만 주입한다. 이 파일에 있는 것은 전부 mock 이며,
// 실값은 로컬 .env 와 Vercel 프로젝트 환경변수에 둔다. 형식은 .env.example 참고.
//
// ── mock 표기 ──────────────────────────────────────────────────────────────
// `// mock` 주석이 붙은 값은 고객 확정값이 아니다. 형식만 진짜와 같게 채워
// 레이아웃 깨짐을 미리 드러내는 용도이며, 실값을 받는 대로 교체한다.

const env = import.meta.env as Record<string, string | undefined>;

// 형식만 진짜와 같은 가짜다. 실값은 .env 에 있다.
const MOCK_ACCOUNTS: Record<"groom" | "bride", Account[]> = {
  groom: [
    { role: "신랑", bank: "국민은행", number: "123456-01-234567", holder: "박희빈" },
    { role: "신랑 아버지", bank: "신한은행", number: "110-234-567890", holder: "박정후" },
    { role: "신랑 어머니", bank: "농협은행", number: "302-1234-5678-91", holder: "김서윤" },
  ],
  bride: [
    { role: "신부", bank: "카카오뱅크", number: "3333-01-2345678", holder: "조혜정" },
    { role: "신부 어머니", bank: "하나은행", number: "123-456789-01234", holder: "이수아" },
  ],
};

function accountsOf(side: "groom" | "bride"): Account[] {
  const raw = side === "groom" ? env.VITE_ACCOUNTS_GROOM : env.VITE_ACCOUNTS_BRIDE;
  const parsed = parseAccounts(raw);
  return parsed.length > 0 ? parsed : MOCK_ACCOUNTS[side];
}

export const INVITE = {
  isMock: true,

  // IN-04 고인(故) 표기: deceased 가 true 면 성함 앞에 "故 "를 붙인다.
  // 혼주 성함은 .env 로만 주입한다 — 아래 문자열은 폴백용 mock 이다.
  groom: {
    name: "박희빈",
    first: "희빈",
    relation: "장남",
    father: orMock(env.VITE_GROOM_FATHER, "박정후"),
    mother: orMock(env.VITE_GROOM_MOTHER, "김서윤"),
    fatherDeceased: false,
    motherDeceased: false,
  },
  bride: {
    name: "조혜정",
    first: "혜정",
    relation: "차녀",
    father: orMock(env.VITE_BRIDE_FATHER, "조민준"),
    mother: orMock(env.VITE_BRIDE_MOTHER, "이수아"),
    fatherDeceased: true,
    motherDeceased: false,
  },

  // 확정값. dateISO 를 바꾸면 D-Day·.ics·OG 태그·지도 링크가 모두 따라 움직인다.
  // 아래 넷은 같은 시각을 가리켜야 한다 — src/invite.test.ts 가 이를 검증한다.
  dateISO: "2027-01-24T11:00:00+09:00",
  dateDots: "2027 . 01 . 24",
  dateText: "2027년 1월 24일",
  dayText: "일요일 오전 11시",

  // 명세서 안에서 "웨스턴베니스"/"웨스턴베니비스"로 흔들렸으나 "웨스턴베니비스"로 확정됐다.
  venue: "신도림 웨스턴베니비스",
  hall: "다이너스티홀 7F",
  address: "서울시 구로구 새말로 97, 7F",
  addressOld: "서울시 구로구 구로동 3-25 신도림테크노마트 7F", // 지번 — 길찾기 앱 폴백용

  transport: {
    subway: "1,2호선 신도림역 2,3번 출구\n(테크노마트 판매동 지하 1층과 직접 연결)",
    // MP-04 — c안에는 지하철만 있었다. 버스는 명세서에서 신설된 항목이다.
    bus: {
      trunk: ["160", "600", "662", "10"], // 간선·직행·일반
      branch: ["5619", "6411", "6511", "6512"], // 지선
      // 고객 원문의 "약도 다운로드"는 아직 기능도 파일도 없다. SIS-12에서
      // 다운로드를 붙일지 결정한 뒤 이 문구를 최종 확정한다.
      note: "그 외 노선은 약도 다운로드에서 자세히 보기",
    },
    car: "내비게이션에 「신도림 웨스턴베니비스」 또는 위 주소를 입력해 주세요",
    // MP-05
    parking: {
      capacity: "2,500대",
      freeHours: "3시간 무료",
      howTo: "7F 안내데스크에서 무료 인증",
      overCharge: "초과 시 30분당 1,500원",
    },
  },

  // NT-01 — 문구 미수령. 섹션 구조 확인용 mock 이며 SIS-14에서 실문구로 교체한다.
  notices: [
    "화환은 정중히 사양합니다. 마음만 감사히 받겠습니다.", // mock
    "식사는 예식 시작 30분 전부터 가능합니다.", // mock
    "주차 등록은 안내데스크에서 도와드립니다.", // mock
  ],

  // IN-01·IN-02 — 본문·인용구 모두 미수령. 줄바꿈 위치까지 고객 확인이 필요하다.
  greeting: {
    quote: "사랑은 서로를 바라보는 것이 아니라\n함께 같은 방향을 바라보는 것이다", // mock (IN-02)
    quoteAuthor: "생텍쥐페리", // mock (IN-02)
    body: "서로가 마주 보며 다져온 사랑을\n이제 함께 한 곳을 바라보며\n걸어갈 수 있도록 하려 합니다.\n\n저희 두 사람이 새로운 시작을 하는 날\n귀한 걸음 하시어 축복해 주시면\n더없는 기쁨으로 간직하겠습니다.", // mock (IN-01)
  },

  // AC-01 — 실값은 .env 의 VITE_ACCOUNTS_GROOM·VITE_ACCOUNTS_BRIDE 에서 온다.
  // 신부측에 아버지 계좌를 두지 않는 것은 고인이기 때문이다.
  accounts: {
    groom: accountsOf("groom"),
    bride: accountsOf("bride"),
  },

  // RS-01~03 — 폼 구성과 전송은 SIS-15·SIS-20이 다룬다. 여기서는 문구·설정만 둔다.
  // 연락처는 수집하지 않는다(CT 미채택). 식사 여부는 명세서에서 추가된 항목이다.
  rsvp: {
    deadline: "2027-01-10", // mock
    deadlineText: "2027년 1월 10일까지", // mock
    collectMeal: true,
    popup: {
      title: "참석 여부 회신", // mock
      body: "축하의 마음으로 참석해 주시는\n모든 분들을 위해 정성껏 준비하고자 합니다.\n\n참석 여부를 알려주시면\n감사하겠습니다.", // mock
    },
    // RS-03 — 법적 요구사항. 문구는 SIS-15에서 확정한다.
    privacy: {
      purpose: "예식 준비를 위한 참석 인원 확인", // mock
      items: "성함, 참석 여부, 동반 인원, 식사 여부", // mock
      retention: "예식 후 1개월 이내 파기", // mock
    },
  },

  // SH-01~03 — 카카오톡 공유 카드·OG 태그 문구. 썸네일은 메인 커버 사진을 쓴다.
  share: {
    title: "박희빈 ♥ 조혜정 결혼합니다",
    description: "2027년 1월 24일 일요일 오전 11시\n신도림 웨스턴베니비스 다이너스티홀",
    buttonText: "청첩장 보기",
  },
} as const;
