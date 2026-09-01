export const SCALE_VAR = "--type-scale";

export const LARGE_SCALE = 1.35;
export const NORMAL_SCALE = 1;

export function scaled(px: number): string {
  return `calc(${px}px * var(${SCALE_VAR}))`;
}
