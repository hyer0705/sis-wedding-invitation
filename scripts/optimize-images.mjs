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
    await sharp(path.join(SRC, file)).resize({ width, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(out);
    const { size } = await stat(out);
    total += size;
    console.log(`${out} (${(size / 1024).toFixed(0)}KB)`);
  }
}
console.log(`완료: ${files.length}장 → ${files.length * WIDTHS.length}개 파일, 총 ${(total / 1024).toFixed(0)}KB`);
