export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  if (index <= 0) return 0;
  if (index > count - 1) return count - 1;
  return index;
}

export function slideIndexAt(scrollLeft: number, step: number, count: number): number {
  if (step <= 0) return 0;
  return clampIndex(Math.round(scrollLeft / step), count);
}

export function scrollLeftAt(index: number, step: number, count: number): number {
  if (step <= 0) return 0;
  return clampIndex(index, count) * step;
}
