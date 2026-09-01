export type Account = {
  role: string;
  bank: string;
  number: string;
  holder: string;
};

const FIELD_SEPARATOR = "|";
const ACCOUNT_SEPARATOR = ";";

export function parseAccounts(raw: string | undefined): Account[] {
  if (!raw?.trim()) return [];

  return raw
    .split(ACCOUNT_SEPARATOR)
    .map((entry) => entry.split(FIELD_SEPARATOR).map((field) => field.trim()))
    .filter((fields) => fields.length === 4 && fields.every(Boolean))
    .map(([role, bank, number, holder]) => ({ role, bank, number, holder }));
}

export function orMock(value: string | undefined, mock: string): string {
  return value?.trim() || mock;
}
