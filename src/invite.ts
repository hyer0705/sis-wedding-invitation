import { orMock, parseAccounts, type Account } from "./lib/private-data";
import type { Parent } from "./lib/parents";

const env = (import.meta.env ?? {}) as Record<string, string | undefined>;

function accountsOf(side: "groom" | "bride"): Account[] {
  return parseAccounts(side === "groom" ? env.VITE_ACCOUNTS_GROOM : env.VITE_ACCOUNTS_BRIDE);
}

export const INVITE = {
  isMock: false,

  groom: {
    name: "박희빈",
    first: "희빈",
    relation: "장남",
    parents: [{ name: orMock(env.VITE_GROOM_FATHER, "박정후"), deceased: false }] as readonly Parent[],
  },
  bride: {
    name: "조혜정",
    first: "혜정",
    relation: "차녀",
    parents: [
      { name: orMock(env.VITE_BRIDE_FATHER, "조민준"), deceased: true },
      { name: orMock(env.VITE_BRIDE_MOTHER, "이수아"), deceased: false },
    ] as readonly Parent[],
  },

  siteUrl: "https://hb-hj-wedding.com",

  dateISO: "2027-01-24T11:00:00+09:00",
  dateDots: "2027 . 01 . 24",
  dateText: "2027년 1월 24일",
  dayText: "일요일 오전 11시",

  venue: "신도림 웨스턴베니비스",
  hall: "다이너스티홀 7F",
  address: "서울시 구로구 새말로 97, 7F",

  coords: { lat: 37.507009, lng: 126.890296 },

  transport: {
    subway: "1,2호선 신도림역 2,3번 출구\n(테크노마트 판매동 지하 1층과 직접 연결)",
    bus: {
      trunk: ["160", "600", "662", "10"],
      branch: ["5619", "6411", "6511", "6512"],
    },
    car: "내비게이션에 「신도림 웨스턴베니비스」 또는 위 주소를 입력해 주세요",
    parking: {
      capacity: "2,500대",
      freeHours: "3시간 무료",
      howTo: "7F 안내데스크에서 무료 인증",
      overCharge: "초과 시 30분당 1,500원",
    },
  },

  gallery: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],

  greeting: {
    body: [
      "서로의 하루를 가장 먼저 떠올리고,\n평범한 일상이 특별해지는 사람을 만났습니다.",
      "이제 두 사람이 하나의 가정을 이루어\n같은 계절을 함께 걸어가려 합니다.",
      "소중한 분들과\n이 행복한 순간을 함께 나누고 싶습니다.",
      "귀한 걸음으로 축복해 주시면\n평생 감사한 마음으로 간직하겠습니다.",
    ],
  },

  accounts: {
    groom: accountsOf("groom"),
    bride: accountsOf("bride"),
  },

  rsvp: {
    deadline: "2027-01-23",
    deadlineText: "2027년 1월 23일까지",
    collectMeal: true,

    privacy: {
      title: "개인정보 수집·이용 안내",

      summary: [
        {
          label: "수집 항목",
          value: "이름, 연락처, 참석 여부, 참석 인원 수, 식사 여부, 하객 구분(신랑측/신부측)",
        },
        { label: "수집 목적", value: "결혼식 참석 여부 확인 및 식사 인원 파악" },
        { label: "보유 기간", value: "2027년 2월 23일까지" },
        { label: "파기", value: "보유기간 종료 후 지체 없이 파기" },
      ],

      consentLabel: "개인정보 수집·이용에 동의합니다. (필수)",
      detailLabel: "개인정보 처리방침 자세히 보기",

      policy: {
        title: "개인정보 처리방침",
        intro: "본 모바일 청첩장은 결혼식 참석 여부 확인 및 원활한 예식 준비를 위해 필요한 최소한의 개인정보를 수집·이용합니다.",
        sections: [
          {
            heading: "1. 개인정보의 수집·이용",
            blocks: [
              {
                kind: "list",
                label: "수집 항목",
                items: ["이름", "연락처", "참석 여부", "참석 인원 수", "식사 여부", "하객 구분(신랑측/신부측)"],
              },
              {
                kind: "list",
                label: "수집·이용 목적",
                items: ["결혼식 참석 여부 확인", "식사 인원 파악", "원활한 예식 준비"],
              },
              { kind: "p", text: "수집한 개인정보는 위 목적 이외의 용도로 이용하지 않습니다." },
            ],
          },
          {
            heading: "2. 개인정보의 보유 및 이용 기간",
            blocks: [
              { kind: "p", text: "수집된 개인정보는 2027년 2월 23일까지 보유·이용합니다." },
              { kind: "p", text: "보유기간이 종료되면 해당 개인정보를 지체 없이 파기합니다." },
            ],
          },
          {
            heading: "3. 개인정보의 파기",
            blocks: [
              {
                kind: "p",
                text: "보유기간이 종료되거나 개인정보의 처리 목적이 달성된 경우 개인정보를 지체 없이 파기합니다.",
              },
              { kind: "p", text: "전자적 파일 형태로 저장된 개인정보는 복구 또는 재생할 수 없도록 삭제합니다." },
            ],
          },
          {
            heading: "4. 개인정보의 보관 및 접근",
            blocks: [
              {
                kind: "p",
                text: "RSVP를 통해 수집된 개인정보는 Supabase 데이터베이스에 저장되며, 결혼식 준비를 위해 신랑·신부만 조회할 수 있도록 접근 권한을 제한합니다.",
              },
            ],
          },
          {
            heading: "5. 개인정보의 제3자 제공",
            blocks: [{ kind: "p", text: "수집된 개인정보를 제3자에게 제공하지 않습니다." }],
          },
          {
            heading: "6. 개인정보 처리 서비스",
            blocks: [
              { kind: "p", text: "RSVP 개인정보의 저장 및 관리를 위해 Supabase를 이용합니다." },
              {
                kind: "list",
                items: ["서비스: Supabase", "이용 목적: 개인정보 데이터베이스 저장 및 관리", "데이터 저장 리전: 대한민국(서울)"],
              },
            ],
          },
          {
            heading: "7. 정보주체의 권리",
            blocks: [
              { kind: "p", text: "정보주체는 본인의 개인정보에 대해 열람, 정정, 삭제 및 처리정지 등을 요청할 수 있습니다." },
              {
                kind: "p",
                text: "모바일 청첩장에서는 RSVP 제출 후 직접 개인정보를 수정하거나 삭제하는 기능을 제공하지 않습니다. 개인정보와 관련한 요청은 아래의 담당자에게 문의해 주세요.",
              },
            ],
          },
          {
            heading: "8. 동의 거부",
            blocks: [
              { kind: "p", text: "개인정보 수집·이용에 대한 동의를 거부할 수 있습니다." },
              { kind: "p", text: "다만, 동의하지 않을 경우 RSVP 기능을 이용할 수 없습니다." },
            ],
          },
          {
            heading: "9. 시행일",
            blocks: [{ kind: "p", text: "본 개인정보 처리방침은 2026년 8월 18일부터 시행합니다." }],
          },
        ],
      },

      officer: {
        heading: "개인정보 보호 담당자",
        name: env.VITE_PRIVACY_OFFICER_NAME?.trim() ?? "",
        email: env.VITE_PRIVACY_OFFICER_EMAIL?.trim() ?? "",
      },
    },
  },

  share: {
    title: "박희빈 ♥ 조혜정 결혼식에 초대합니다.",
    description: "2027년 1월 24일 일요일 오전 11시 · 신도림 웨스턴베니비스 다이너스티홀 7F",
    buttonText: "청첩장 보기",
  },
} as const;
