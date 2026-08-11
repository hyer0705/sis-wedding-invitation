// 로딩 화면(CM-04)이 언제 걷힐지를 정하기 위해 커버 사진 한 장을 미리 받아 온다.

/**
 * 이미지 한 장을 미리 받아 오고, 끝나면 resolve 한다.
 *
 * 화면에 실제로 걸리는 `<img>` 와 **같은** `srcSet`·`sizes` 를 넘겨야 한다. 브라우저는
 * 이 둘을 보고 후보를 고르므로, 값이 어긋나면 화면에 쓰이지 않을 다른 너비를 받아
 * 사진을 두 장 내려받게 된다. 같은 값이면 응답이 캐시에서 재사용되어 요청은 한 번이다.
 * 호출부가 Cover 가 export 하는 상수를 그대로 쓰는 이유다.
 *
 * **실패해도 reject 하지 않는다.** 사진을 못 받는 것과 로딩 화면이 안 걷히는 것은 별개의
 * 문제인데, 뒤엣것은 청첩장 전체를 못 보게 만든다. 사진이 없으면 커버에 빈 자리가
 * 보이는 편이 낫다.
 */
export function preloadImage(src: string, srcSet?: string, sizes?: string): Promise<void> {
  return new Promise((resolve) => {
    // Playwright 가 이 파일을 Vite 없이 읽거나 DOM 이 없는 환경에서 도는 경우다.
    if (typeof Image === "undefined") {
      resolve();
      return;
    }

    const img = new Image();
    const done = () => resolve();
    img.onload = done;
    img.onerror = done;

    // sizes → srcSet → src 순서를 지킨다. src 를 먼저 넣으면 브라우저가 그 시점의
    // (아직 비어 있는) 후보 목록으로 결정을 끝내 버린다.
    if (sizes) img.sizes = sizes;
    if (srcSet) img.srcset = srcSet;
    img.src = src;

    // 캐시에 있으면 src 대입 시점에 이미 끝나 있고 onload 가 오지 않을 수 있다.
    if (img.complete) done();
  });
}
