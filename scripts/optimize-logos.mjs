// logos-original/의 지도 앱 로고를 정사각 WebP 아이콘으로 변환해 public/images/에
// 출력한다 (SIS-32). 이후 `npm run upload:images` 가 사진과 함께 R2 로 올린다.
//
// 사진(optimize-images.mjs)과 스크립트를 나눈 이유는 처리가 전혀 다르기 때문이다.
// 사진은 폭 2벌로 줄이면 끝이지만, 로고는 셋의 원본 형태가 제각각이라 파일마다
// 다른 손질이 필요하다 — 아래 LOGOS 의 note 참고.
//
// **로고를 변형하지 않는다.** 각 사 브랜드 가이드는 색·형태 변경을 금지한다.
// 여기서 하는 일은 크기 조정과 여백 정리, 그리고 사각 원본에 앱 아이콘과 같은
// 둥근 모서리를 주는 것까지다. 색을 만지거나 단색화하지 않는다.
import sharp from "sharp";
import { mkdir, access } from "node:fs/promises";
import path from "node:path";

const SRC = "logos-original";
const OUT = "public/images";

// 화면 표시 크기는 18px 다. 3배까지 받아도 깨지지 않도록 64px 로 둔다.
// 이보다 키워도 파일당 1KB 남짓이지만, 18px 로 줄여 그릴 때 얻는 것이 없다.
const SIZE = 64;
const QUALITY = 90;

// 사각 원본에 줄 모서리 반경. 카카오맵 원본의 알파 채널에서 실측한 7.3% 다.
// iOS 앱 아이콘 관례(22.5%)를 쓰면 티맵만 눈에 띄게 둥글어 나란히 놓았을 때
// 형태가 어긋난다. 이미 둥근 카카오맵 쪽을 깎는 것은 로고 변형이라 하지 않고,
// 각진 티맵을 카카오맵에 맞춘다.
const CORNER_RATIO = 0.073;

// 핀 모양 로고를 정사각 안에서 얼마나 채울지. 100% 로 두면 세로가 꽉 차서
// 옆의 사각 아이콘 둘보다 키가 커 보인다. 시각적 무게를 맞추는 값이다.
const PIN_SCALE = 0.92;

const LOGOS = [
  {
    src: "naver-map.png",
    out: "logo-naver-map.webp",
    // 핀 모양이라 원본에 투명 여백이 넓게 붙어 있다(1261x1247 중 실제 그림은 795x1014).
    // 여백째 줄이면 옆의 두 앱 아이콘보다 눈에 띄게 작아 보인다.
    trim: true,
    round: false,
    pin: true,
    note: "세로로 긴 핀 — 여백을 떼고 정사각 안에 맞춘다",
  },
  {
    src: "kakao-map.png",
    out: "logo-kakao-map.webp",
    // 이미 모서리가 둥근 앱 아이콘이고 바깥이 투명하다. 크기만 맞춘다.
    trim: false,
    round: false,
    note: "둥근 사각 앱 아이콘 — 손대지 않는다",
  },
  {
    src: "tmap.jpeg",
    out: "logo-tmap.webp",
    // JPEG 라 투명도가 없고 모서리가 각져 있다. 그대로 두면 셋 중 혼자
    // 네모나게 튄다. 형태만 맞추고 그라데이션은 원본 그대로 둔다.
    trim: false,
    round: true,
    note: "각진 사각 원본 — 카카오맵과 같은 모서리를 준다",
  },
];

/** 둥근 사각 마스크. dest-in 합성으로 모서리 바깥을 투명하게 깎는다. */
function cornerMask(size) {
  const r = Math.round(size * CORNER_RATIO);
  return Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}"/></svg>`);
}

await mkdir(OUT, { recursive: true });

const missing = [];
for (const logo of LOGOS) {
  try {
    await access(path.join(SRC, logo.src));
  } catch {
    missing.push(logo.src);
  }
}
if (missing.length > 0) {
  console.error(`${SRC}/ 에 다음 원본이 없습니다:`);
  for (const name of missing) console.error(`  - ${name}`);
  console.error("각 사 브랜드 페이지에서 받은 원본을 넣어주세요 (리포에 커밋하지 않습니다).");
  process.exit(1);
}

for (const { src, out, trim, round, pin, note } of LOGOS) {
  let img = sharp(path.join(SRC, src));

  // 여백을 뗀 뒤에 크기를 맞춰야 그림이 정사각을 꽉 채운다. 순서가 바뀌면
  // 여백까지 포함해 줄어들어 로고만 작아진다.
  if (trim) img = sharp(await img.trim({ threshold: 10 }).toBuffer());

  // contain — 원본 비율을 지킨다. cover 로 채우면 핀 끝이 잘린다.
  // 핀은 조금 줄여 넣고 남는 자리는 투명 여백으로 둔다(PIN_SCALE).
  const box = pin ? Math.round(SIZE * PIN_SCALE) : SIZE;
  img = img.resize(box, box, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
  if (box !== SIZE) {
    const pad = Math.round((SIZE - box) / 2);
    img = img.extend({
      top: pad,
      bottom: SIZE - box - pad,
      left: pad,
      right: SIZE - box - pad,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }

  // 마스크는 리사이즈 뒤에 씌운다. 먼저 씌우면 축소 과정에서 모서리가 다시 흐려진다.
  if (round) img = sharp(await img.png().toBuffer()).composite([{ input: cornerMask(SIZE), blend: "dest-in" }]);

  const info = await img.webp({ quality: QUALITY, alphaQuality: 100 }).toFile(path.join(OUT, out));
  console.log(`${out}  ${SIZE}x${SIZE}  ${(info.size / 1024).toFixed(1)}KB  — ${note}`);
}

console.log(`\n로고 ${LOGOS.length}개를 ${OUT}/ 에 만들었습니다. R2 반영은 npm run upload:images 입니다.`);
