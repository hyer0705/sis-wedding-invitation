export type Parent = {
  name: string;
  deceased: boolean;
};

export function formatParentName(parent: Parent): string {
  return parent.deceased ? `故 ${parent.name}` : parent.name;
}

export function parentNameLines(parents: readonly Parent[]): string[] {
  return parents.filter((parent) => parent.name.trim() !== "").map(formatParentName);
}
