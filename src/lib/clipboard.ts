// MP-02·AC-02 — 주소와 계좌번호 복사. 하객 대부분이 카카오톡 인앱 브라우저로 여는데,
// 그 안에서는 navigator.clipboard 가 없거나 있어도 거부되는 경우가 있다. 청첩장에서
// 복사가 실패하면 하객이 주소를 손으로 옮겨 적어야 하므로, 옛 방식까지 갖춰 둔다.

/**
 * 화면 밖 textarea 를 만들어 선택 후 복사하는 옛 방식.
 *
 * `document.execCommand` 는 폐기 예정이지만 대체재가 곧 navigator.clipboard 라,
 * 그것이 없는 환경에서는 이 길밖에 없다.
 */
function copyByExecCommand(text: string): boolean {
  const area = document.createElement("textarea");
  area.value = text;
  // 화면에서 감추되 focus 는 받을 수 있어야 한다. display:none 이면 선택이 되지 않는다.
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "-9999px";
  area.style.opacity = "0";
  document.body.appendChild(area);

  try {
    area.select();
    // iOS Safari 는 select() 만으로 선택 범위가 잡히지 않아 범위를 직접 지정한다.
    area.setSelectionRange(0, text.length);
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
  }
}

/**
 * 클립보드에 문자열을 넣는다. 성공 여부를 돌려준다.
 *
 * 최신 API 를 먼저 쓰고, 없거나 거부되면 옛 방식으로 한 번 더 시도한다. 권한 거부는
 * 예외로 오지 브라우저가 미리 알려주지 않으므로 catch 로만 잡을 수 있다.
 */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // 폴백으로 내려간다
    }
  }
  return copyByExecCommand(text);
}
