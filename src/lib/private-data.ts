// 계좌·혼주 성함은 리포에 두지 않는다. 로컬은 .env, 배포는 Vercel 프로젝트
// 환경변수로 주입하며, 값이 없으면 src/invite.ts 의 mock 으로 폴백한다.
//
// 폴백을 두는 이유는 새로 clone 한 사람이 .env 없이도 개발을 시작할 수 있게
// 하기 위함이다. 실값 누락은 빌드가 아니라 배포 게이트(`npm run verify`)가 잡는다.

export type Account = {
  role: string;
  bank: string;
  number: string;
  holder: string;
};

const FIELD_SEPARATOR = "|";
const ACCOUNT_SEPARATOR = ";";

/**
 * `역할|은행|계좌번호|예금주` 를 세미콜론으로 이어 붙인 문자열을 파싱한다.
 * 형식이 깨진 항목은 조용히 버린다 — 계좌 하나가 잘못됐다고 섹션 전체를
 * 날리는 것보다, 나머지를 보여주고 게이트에서 걸리는 편이 낫다.
 */
export function parseAccounts(raw: string | undefined): Account[] {
  if (!raw?.trim()) return [];

  return raw
    .split(ACCOUNT_SEPARATOR)
    .map((entry) => entry.split(FIELD_SEPARATOR).map((field) => field.trim()))
    .filter((fields) => fields.length === 4 && fields.every(Boolean))
    .map(([role, bank, number, holder]) => ({ role, bank, number, holder }));
}

/** 환경변수 값이 비어 있으면 mock 으로 대체한다. */
export function orMock(value: string | undefined, mock: string): string {
  return value?.trim() || mock;
}
