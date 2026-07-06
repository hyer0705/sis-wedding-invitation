// 배포 게이트 — placeholder가 남아 있거나 이미지 총용량이 초과하면 실패(exit 1)한다.
// 배포 전 반드시 `npm run verify`가 통과해야 한다.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const PLACEHOLDERS = ["○○", "000-000-000000", "MAP PREVIEW"];
const IMAGE_BUDGET = 3 * 1024 * 1024; // 3MB
const errors = [];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const targets = ["index.html"];
for await (const f of walk("src")) {
  if (/\.(tsx?|css|html)$/.test(f)) targets.push(f);
}
for (const file of targets) {
  const text = await readFile(file, "utf8");
  for (const p of PLACEHOLDERS) {
    if (text.includes(p)) errors.push(`${file}: placeholder "${p}" 잔존`);
  }
}

let imageTotal = 0;
try {
  for await (const f of walk("public/images")) imageTotal += (await stat(f)).size;
} catch {
  errors.push("public/images/ 가 없습니다 — npm run optimize를 먼저 실행하세요");
}
if (imageTotal > IMAGE_BUDGET) {
  errors.push(`public/images 총용량 ${(imageTotal / 1024 / 1024).toFixed(2)}MB — 예산 3MB 초과`);
}

try {
  await stat("public/og-image.jpg");
} catch {
  errors.push("public/og-image.jpg 없음 — 카톡 공유 썸네일 필요");
}

if (errors.length > 0) {
  console.error("배포 게이트 실패:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`배포 게이트 통과 (이미지 ${(imageTotal / 1024).toFixed(0)}KB / 3MB)`);
