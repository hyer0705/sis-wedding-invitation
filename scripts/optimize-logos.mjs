import sharp from "sharp";
import { mkdir, access } from "node:fs/promises";
import path from "node:path";

const SRC = "logos-original";
const OUT = "public/images";

const SIZE = 64;
const QUALITY = 90;

const CORNER_RATIO = 0.073;

const PIN_SCALE = 0.92;

const LOGOS = [
  {
    src: "naver-map.png",
    out: "logo-naver-map.webp",
    trim: true,
    round: false,
    pin: true,
    note: "세로로 긴 핀 — 여백을 떼고 정사각 안에 맞춘다",
  },
  {
    src: "kakao-map.png",
    out: "logo-kakao-map.webp",
    trim: false,
    round: false,
    note: "둥근 사각 앱 아이콘 — 손대지 않는다",
  },
  {
    src: "tmap.jpeg",
    out: "logo-tmap.webp",
    trim: false,
    round: true,
    note: "각진 사각 원본 — 카카오맵과 같은 모서리를 준다",
  },
];

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

  if (trim) img = sharp(await img.trim({ threshold: 10 }).toBuffer());

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

  if (round) img = sharp(await img.png().toBuffer()).composite([{ input: cornerMask(SIZE), blend: "dest-in" }]);

  const info = await img.webp({ quality: QUALITY, alphaQuality: 100 }).toFile(path.join(OUT, out));
  console.log(`${out}  ${SIZE}x${SIZE}  ${(info.size / 1024).toFixed(1)}KB  — ${note}`);
}

console.log(`\n로고 ${LOGOS.length}개를 ${OUT}/ 에 만들었습니다. R2 반영은 npm run upload:images 입니다.`);
