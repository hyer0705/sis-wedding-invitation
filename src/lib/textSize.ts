import { LARGE_SCALE, NORMAL_SCALE, SCALE_VAR } from "./typeScale";

const STORAGE_KEY = "sis-text-scale";

function storedLargeText(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "large";
  } catch {
    return false;
  }
}

let large = false;
const listeners = new Set<() => void>();

export function isLargeText(): boolean {
  return large;
}

export function subscribeTextSize(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function paint(next: boolean): void {
  document.documentElement.style.setProperty(SCALE_VAR, String(next ? LARGE_SCALE : NORMAL_SCALE));
  if (next) document.documentElement.dataset.textSize = "large";
  else delete document.documentElement.dataset.textSize;
}

export function setLargeText(next: boolean): void {
  large = next;
  paint(next);
  try {
    localStorage.setItem(STORAGE_KEY, next ? "large" : "normal");
  } catch {}
  for (const listener of listeners) listener();
}

export function restoreTextSize(): void {
  large = storedLargeText();
  paint(large);
}
