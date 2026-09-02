import { readFile } from "node:fs/promises";

function unquote(value) {
  const m = /^(["'])(.*)\1$/s.exec(value);
  return m ? m[2] : value;
}

export async function readEnvFile(file = ".env") {
  const values = {};
  try {
    const text = await readFile(file, "utf8");
    for (const line of text.split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m) values[m[1]] = unquote(m[2].trim());
    }
  } catch {}
  return values;
}

export function envValue(key, envFile) {
  return (process.env[key] || envFile[key] || "").trim();
}
