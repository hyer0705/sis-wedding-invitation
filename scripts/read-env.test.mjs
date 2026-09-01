import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readEnvFile } from "./read-env.mjs";

async function envFileWith(contents) {
  const dir = await mkdtemp(path.join(tmpdir(), "read-env-"));
  const file = path.join(dir, ".env");
  await writeFile(file, contents, "utf8");
  return readEnvFile(file);
}

describe("readEnvFile", () => {
  it("키와 값을 읽는다", async () => {
    const values = await envFileWith("VITE_SUPABASE_URL=https://ref.supabase.co\n");
    expect(values.VITE_SUPABASE_URL).toBe("https://ref.supabase.co");
  });

  it("감싼 큰따옴표를 벗긴다 — Vite 와 같게", async () => {
    const values = await envFileWith('VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_abc"\n');
    expect(values.VITE_SUPABASE_PUBLISHABLE_KEY).toBe("sb_publishable_abc");
  });

  it("감싼 작은따옴표도 벗긴다", async () => {
    const values = await envFileWith("VITE_SUPABASE_PUBLISHABLE_KEY='sb_publishable_abc'\n");
    expect(values.VITE_SUPABASE_PUBLISHABLE_KEY).toBe("sb_publishable_abc");
  });

  it("값 안쪽의 따옴표는 건드리지 않는다", async () => {
    const values = await envFileWith('VITE_GROOM_FATHER=아무개"아무개\n');
    expect(values.VITE_GROOM_FATHER).toBe('아무개"아무개');
  });

  it("주석과 빈 줄을 건너뛴다", async () => {
    const values = await envFileWith("# 주석\n\nVITE_IMAGE_BASE_URL=https://img.example.com\n");
    expect(values).toEqual({ VITE_IMAGE_BASE_URL: "https://img.example.com" });
  });

  it("파일이 없으면 빈 객체를 돌려준다", async () => {
    expect(await readEnvFile(path.join(tmpdir(), "없는파일-read-env"))).toEqual({});
  });
});
