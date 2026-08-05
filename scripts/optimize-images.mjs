// photos-original/의 원본 사진을 WebP 2벌로 변환해 public/images/에 출력한다.
//   {이름}-480.webp : 갤러리 썸네일용
//   {이름}-960.webp : 커버·라이트박스용 (430px 레이아웃의 레티나 2x)
import sharp from "sharp";
import { readdir, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const SRC = "photos-original";
const OUT = "public/images";
const WIDTHS = [480, 960];
const QUALITY = 78;
const EXTS = new Set([".jpg", ".jpeg", ".png"]);

// 커버만 4:5로 잘라 낸다. 갤러리 사진은 원본 비율을 그대로 둔다 — 세로 3컷
// 스트립처럼 잘리면 못 쓰게 되는 사진이 섞여 있고, 갤러리에서 어떻게 보여줄지는
// SIS-11에서 정한다.
//
// 커버를 미리 자르는 이유는 화질이다. 자르지 않으면 960w 중 53%만 화면에 쓰여
// 실효 해상도가 레티나 기준에 못 미친다. 중앙 크롭인 것은 고객이 고른 A안이고,
// 좌표 대신 비율로 두면 사진을 교체해도 그대로 동작한다.
const COVER = "1_main";
const COVER_ASPECT = 5 / 4;

// 카톡 공유 카드용 썸네일. 커버 사진에서 같이 뽑는다.
// WebP 가 아니라 JPEG 인 이유는 소비자가 브라우저가 아니라 외부 스크래퍼(카카오·
// 페이스북 등)이기 때문이다 — WebP 지원이 제각각이라 썸네일이 통째로 안 뜰 수 있다.
// 1200x630 은 OG 표준 비율(1.91:1)이다.
const OG = { name: "og-image.jpg", width: 1200, height: 630, quality: 82 };

await mkdir(OUT, { recursive: true });

let files;
try {
  files = (await readdir(SRC)).filter((f) => EXTS.has(path.extname(f).toLowerCase()));
} catch {
  console.error(`${SRC}/ 폴더가 없습니다. 원본 사진을 넣어주세요.`);
  process.exit(1);
}

if (files.length === 0) {
  console.log(`${SRC}/에 변환할 사진이 없습니다.`);
  process.exit(0);
}

let total = 0;
for (const file of files) {
  const base = path.parse(file).name;
  for (const width of WIDTHS) {
    const out = path.join(OUT, `${base}-${width}.webp`);
    const resize =
      base === COVER
        ? [width, Math.round(width * COVER_ASPECT), { fit: "cover", position: "centre" }]
        : [{ width, withoutEnlargement: true }];
    await sharp(path.join(SRC, file))
      .resize(...resize)
      .webp({ quality: QUALITY })
      .toFile(out);
    const { size } = await stat(out);
    total += size;
    console.log(`${out} (${(size / 1024).toFixed(0)}KB)`);
  }
}
const coverSource = files.find((f) => path.parse(f).name === COVER);
if (!coverSource) {
  console.error(`커버 원본(${COVER})이 ${SRC}/ 에 없어 ${OG.name} 을 만들지 못했습니다.`);
  process.exit(1);
}
const ogOut = path.join(OUT, OG.name);
await sharp(path.join(SRC, coverSource))
  .resize(OG.width, OG.height, { fit: "cover", position: "centre" })
  .jpeg({ quality: OG.quality, mozjpeg: true })
  .toFile(ogOut);
const { size: ogSize } = await stat(ogOut);
total += ogSize;
console.log(`${ogOut} (${(ogSize / 1024).toFixed(0)}KB)`);

console.log(`완료: ${files.length}장 → ${files.length * WIDTHS.length + 1}개 파일, 총 ${(total / 1024).toFixed(0)}KB`);
