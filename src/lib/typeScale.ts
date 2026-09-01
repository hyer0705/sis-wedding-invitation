// 글자 크기 배율 — 값과 계산만 둔다.
//
// 켜고 끄는 상태·저장·DOM 반영은 lib/textSize.ts 가 맡는다. 화면 코드 대부분(11개
// 컴포넌트)은 크기를 적기만 할 뿐 토글을 건드리지 않는데, 한 모듈에 두면 그 코드가
// 모두 상태 저장소까지 함께 끌고 온다.
//
// 배율을 타지 않는 자리가 넷 있다 — Parisienne 장식 타이틀, 커버의 이름(고객이 크기·
// 굵기·자간을 지정했다, SIS-41), D-Day 숫자(네 박스가 이미 가로를 꽉 채운다), 달력
// 원의 지름(7열이 320px 에서 빠듯하다. 원 안의 숫자만 커진다).

export const SCALE_VAR = "--type-scale";

// 1.35 배다(2026-09-01 조정). 처음 잡은 1.2 로는 본문이 17.4px 에 그쳐, 노년 하객을
// 대상으로 할 때 권장되는 본문 하한 19px 에 못 미친다. 1.35 면 본문 19.6px·보조 17.6px 로
// 그 선을 넘는다. 더 키우면(1.5) 달력 한 줄과 D-Day 네 박스가 320px 에서 버티지 못한다.
export const LARGE_SCALE = 1.35;
export const NORMAL_SCALE = 1;

/**
 * 글자 크기에 배율을 물린다.
 *
 * 인라인 style 과 CSS 파일이 같은 식을 써야 한쪽만 커지는 일이 없다 — CSS 쪽은
 * `calc(14px * var(--type-scale))` 을 직접 적는다.
 */
export function scaled(px: number): string {
  return `calc(${px}px * var(${SCALE_VAR}))`;
}
