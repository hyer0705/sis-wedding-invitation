// 갤러리 슬라이드(GL-01)의 위치 계산. 스와이프는 CSS scroll-snap 이 처리하고,
// 여기서는 "스크롤 위치 ↔ 슬라이드 번호" 변환만 맡는다. 컴포넌트에서 떼어 둔 이유는
// 이 계산이 경계(첫 장·끝 장)에서 틀리기 쉬운데 DOM 없이 검증할 수 있어서다.
//
// step 은 슬라이드 하나가 차지하는 가로 폭(사진 폭 + 사이 간격)이다. 런타임에
// 실제 DOM 에서 재므로 여백·간격 값이 바뀌어도 이 파일은 그대로다.

/** 인덱스를 0 ~ count-1 안으로 가둔다. 장수가 0이면 0. */
export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  // `<` 가 아니라 `<=` 인 것은 -0 때문이다. 음수 스크롤을 반올림하면 -0 이 나오는데,
  // `-0 < 0` 은 거짓이라 그대로 새어 나간다. 값으로는 0과 같지만 남겨 둘 이유가 없다.
  if (index <= 0) return 0;
  if (index > count - 1) return count - 1;
  return index;
}

/**
 * 현재 스크롤 위치에서 화면에 놓인 슬라이드 번호를 구한다.
 *
 * 반올림하는 이유는 스와이프 도중에도 "가장 가까운 슬라이드"를 현재로 보기 위함이다.
 * 관성 스크롤이 스냅 지점에 정확히 멈추지 않는 기기가 있어 내림으로는 한 장씩 밀린다.
 */
export function slideIndexAt(scrollLeft: number, step: number, count: number): number {
  // step 이 0이면(아직 레이아웃 전) 나눗셈이 Infinity·NaN 이 된다. 첫 장으로 둔다.
  if (step <= 0) return 0;
  return clampIndex(Math.round(scrollLeft / step), count);
}

/** 목표 슬라이드로 옮기기 위한 스크롤 위치. */
export function scrollLeftAt(index: number, step: number, count: number): number {
  if (step <= 0) return 0;
  return clampIndex(index, count) * step;
}
