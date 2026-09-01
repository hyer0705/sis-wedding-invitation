// 큰 글씨로 보기 (2026-09-01 고객 요청).
//
// 50대 후반~60대 초반 하객에게 글씨가 흐리다는 평이 있었다. 대비는 이미 AAA 를 넘고
// (본문 9.31:1) 남은 원인은 크기와 명조체의 얇은 획이라, 하객이 스스로 키울 수 있게 한다.
//
// 페이지 전체를 zoom 으로 확대하는 길도 있었으나 쓰지 않는다 — 확대된 좌표계에서는
// 320px 미디어쿼리가 평가되지 않아 지도 앱 버튼이 화면 밖으로 잘렸다. 글자 크기만
// 배율을 타면 사진·여백·미디어쿼리가 모두 제자리에 남는다.
//
// 배율을 타지 않는 자리가 넷 있다 — Parisienne 장식 타이틀, 커버의 이름(고객이 크기·
// 굵기·자간을 지정했다, SIS-41), D-Day 숫자(네 박스가 이미 가로를 꽉 채운다), 달력
// 원의 지름(7열이 320px 에서 빠듯하다. 원 안의 숫자만 커진다).
//
// 켜는 자리는 **화면 아래 바 하나**다. 처음에는 우상단 원형 아이콘과 커버 아래 버튼
// 둘로 두었는데, 이 기능이 필요한 하객일수록 작은 아이콘을 눌러 볼 생각을 하지 않는다는
// 지적을 받아 글로 적힌 바로 바꿨다(2026-09-01). 자세한 근거는 components/TextSize.tsx.

const STORAGE_KEY = "sis-text-scale";
const SCALE_VAR = "--type-scale";

export const LARGE_SCALE = 1.2;
export const NORMAL_SCALE = 1;

/**
 * 글자 크기에 배율을 물린다.
 *
 * 인라인 style 과 CSS 파일이 같은 식을 써야 한쪽만 커지는 일이 없다 — CSS 쪽은
 * `calc(14px * var(--type-scale))` 을 직접 적는다.
 */
export function scaled(px: number): string {
  return `calc(${px}px * var(--type-scale))`;
}

/** 저장해 둔 설정. 읽지 못하면 기본 크기다 — 사파리 사생활 보호 창은 접근 자체가 던진다. */
function storedLargeText(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "large";
  } catch {
    return false;
  }
}

let large = false;
const listeners = new Set<() => void>();

export function isLargeText(): boolean {
  return large;
}

export function subscribeTextSize(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function paint(next: boolean): void {
  document.documentElement.style.setProperty(SCALE_VAR, String(next ? LARGE_SCALE : NORMAL_SCALE));
  // 배율만으로는 못 고치는 자리가 있다 — 좁은 화면의 지도 앱 버튼은 라벨이 커지면
  // 한 줄에 셋이 들어가지 않아 세로로 세워야 한다. CSS 변수는 미디어쿼리에서 읽을 수
  // 없으므로 상태를 속성으로도 남긴다.
  if (next) document.documentElement.dataset.textSize = "large";
  else delete document.documentElement.dataset.textSize;
}

export function setLargeText(next: boolean): void {
  large = next;
  paint(next);
  try {
    localStorage.setItem(STORAGE_KEY, next ? "large" : "normal");
  } catch {
    // 저장하지 못해도 이번 방문 동안은 켜진 채로 둔다.
  }
  for (const listener of listeners) listener();
}

/**
 * 저장해 둔 설정을 첫 그림 전에 화면에 올린다.
 *
 * 하객이 지난 방문에서 켜 두었다면 이번에도 큰 글씨로 열려야 한다. React 가 그린
 * 뒤에 켜면 기본 크기가 한 번 스쳤다가 커진다.
 */
export function restoreTextSize(): void {
  large = storedLargeText();
  paint(large);
}
