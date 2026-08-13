// IN-03 혼주·자녀 관계 표기 · IN-04 고인(故) 표기.
//
// 혼주 인원은 집집마다 다르다 — 신랑측은 어머니를 표기하지 않기로 했고(2026-08-11),
// 신부측은 아버지가 고인이다. 그래서 "아버지 · 어머니" 를 고정 문장으로 짜지 않고
// 있는 분만 이어 붙인다. 한 분뿐이면 가운뎃점도 따라 사라진다.

export type Parent = {
  name: string;
  /** 고인이면 성함 앞에 "故 " 가 붙는다 (IN-04). */
  deceased: boolean;
};

const SEPARATOR = " · ";

/** 고인 표기를 붙인 성함 한 분. */
export function formatParentName(parent: Parent): string {
  return parent.deceased ? `故 ${parent.name}` : parent.name;
}

/**
 * 혼주 성함을 가운뎃점으로 잇는다.
 *
 * 성함이 비어 있는 항목은 버린다. 환경변수가 빈 채로 들어오면 "故 " 나 가운뎃점만
 * 남은 줄이 하객에게 보이기 때문이다.
 */
export function formatParents(parents: readonly Parent[]): string {
  return parents
    .filter((parent) => parent.name.trim() !== "")
    .map(formatParentName)
    .join(SEPARATOR);
}
