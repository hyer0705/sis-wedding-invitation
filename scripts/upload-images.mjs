import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const SOURCES = ["public/images", "public/audio"];

const CONTENT_TYPES = { ".webp": "image/webp", ".jpg": "image/jpeg", ".mp3": "audio/mpeg" };

const CACHE_CONTROL = "public, max-age=86400";

const dryRun = process.argv.includes("--dry-run");

const REQUIRED_ENV = ["R2_ACCOUNT_ID", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];

function requireEnv() {
  const missing = REQUIRED_ENV.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    console.error(`.env 에 다음 키가 비어 있습니다 (형식: .env.example)`);
    for (const name of missing) console.error(`  - ${name}`);
    process.exit(1);
  }
  return Object.fromEntries(REQUIRED_ENV.map((name) => [name, process.env[name].trim()]));
}

for (const file of [".env", ".env.local"]) {
  try {
    process.loadEnvFile(file);
  } catch {}
}

const files = [];
const seen = new Map();
for (const dir of SOURCES) {
  let names;
  try {
    names = await readdir(dir);
  } catch {
    continue;
  }
  for (const name of names.sort()) {
    if (!(path.extname(name).toLowerCase() in CONTENT_TYPES)) continue;
    const before = seen.get(name);
    if (before) {
      console.error(`${dir}/${name} 이 ${before}/${name} 과 같은 이름입니다 — R2 에서 한쪽이 덮입니다.`);
      process.exit(1);
    }
    seen.set(name, dir);
    files.push({ dir, name });
  }
}

if (files.length === 0) {
  console.error(`${SOURCES.join("/, ")}/ 에 올릴 파일이 없습니다 — npm run optimize 를 먼저 실행하세요.`);
  process.exit(1);
}

if (dryRun) {
  console.log(`[dry-run] 올릴 파일 ${files.length}개:`);
  for (const { dir, name } of files) console.log(`  ${dir}/${name}`);
  process.exit(0);
}

const env = requireEnv();
const bucket = env.R2_BUCKET;
const client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

let total = 0;
for (const { dir, name } of files) {
  const full = path.join(dir, name);
  const body = await readFile(full);
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: name,
      Body: body,
      ContentType: CONTENT_TYPES[path.extname(name).toLowerCase()],
      CacheControl: CACHE_CONTROL,
    }),
  );
  const { size } = await stat(full);
  total += size;
  console.log(`↑ ${name} (${(size / 1024).toFixed(0)}KB)`);
}

console.log(`완료: ${files.length}개, 총 ${(total / 1024).toFixed(0)}KB → ${bucket}`);
console.log("VITE_IMAGE_BASE_URL 이 이 버킷의 공개 URL 을 가리키는지 확인하세요.");
