import sharp from "sharp";
import { readdir, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const SRC = "photos-original";
const OUT = "public/images";
const WIDTHS = [480, 960];
const QUALITY = 78;
const EXTS = new Set([".jpg", ".jpeg", ".png"]);

const COVER = "1_main";
const COVER_ASPECT = 5 / 4;

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
