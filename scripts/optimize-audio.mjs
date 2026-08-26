import { execFileSync } from "node:child_process";
import { access, mkdir, stat } from "node:fs/promises";
import path from "node:path";

const SOURCE = "audio-original/bgm-source.mp3";
const OUT_DIR = "public/audio";
const OUT_NAME = "bgm.mp3";

const START_SECONDS = 0;
const DURATION_SECONDS = 119;
const FADE_IN_SECONDS = 1.5;
const FADE_OUT_SECONDS = 2.5;
const BITRATE = "96k";
const SAMPLE_RATE = "44100";

const SPEC_MAX_BYTES = 3 * 1024 * 1024;

const LICENSE_NOTE = "Pixabay Content License - https://pixabay.com/music/modern-classical-wedding-485932/";

function requireFfmpeg() {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    console.error("ffmpeg 를 찾지 못했습니다 — 배경음악 재인코딩에 필요합니다 (SIS-27).");
    console.error("  brew install ffmpeg");
    process.exit(1);
  }
}

async function requireSource() {
  try {
    await access(SOURCE);
  } catch {
    console.error(`${SOURCE} 가 없습니다.`);
    console.error("고객이 확정한 음원 원본을 이 이름으로 넣어주세요 (리포에 커밋하지 않습니다).");
    process.exit(1);
  }
}

function measureSeconds(file) {
  const output = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file],
    { encoding: "utf8" },
  );
  return Number(output.trim());
}

requireFfmpeg();
await requireSource();
await mkdir(OUT_DIR, { recursive: true });

const outPath = path.join(OUT_DIR, OUT_NAME);
const fadeOutStart = DURATION_SECONDS - FADE_OUT_SECONDS;

execFileSync(
  "ffmpeg",
  [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    String(START_SECONDS),
    "-i",
    SOURCE,
    "-t",
    String(DURATION_SECONDS),
    "-af",
    `afade=t=in:st=0:d=${FADE_IN_SECONDS},afade=t=out:st=${fadeOutStart}:d=${FADE_OUT_SECONDS}`,
    "-c:a",
    "libmp3lame",
    "-b:a",
    BITRATE,
    "-ar",
    SAMPLE_RATE,
    "-ac",
    "2",
    "-map_metadata",
    "-1",
    "-metadata",
    `comment=${LICENSE_NOTE}`,
    outPath,
  ],
  { stdio: "inherit" },
);

const { size } = await stat(outPath);
const seconds = measureSeconds(outPath);

console.log(`${OUT_NAME}  ${seconds.toFixed(1)}초  ${(size / 1024 / 1024).toFixed(2)}MB  ${BITRATE}`);

if (size > SPEC_MAX_BYTES) {
  console.error(`규격(3MB 이하)을 넘었습니다 — DURATION_SECONDS 를 줄이거나 BITRATE 를 낮추세요.`);
  process.exit(1);
}

console.log(`R2 반영은 npm run upload:images 입니다.`);
