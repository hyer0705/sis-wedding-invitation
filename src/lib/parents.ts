export type Parent = {
  name: string;
  deceased: boolean;
};

export type ParentNameLine = {
  marker: string;
  name: string;
};

const DECEASED_MARKER = "故";

export function parentNameLines(parents: readonly Parent[]): ParentNameLine[] {
  return parents
    .filter((parent) => parent.name.trim() !== "")
    .map((parent) => ({ marker: parent.deceased ? DECEASED_MARKER : "", name: parent.name }));
}
