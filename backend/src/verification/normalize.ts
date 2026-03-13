export function normalizeString(v: unknown): string {
  if (v == null) return "";
  return String(v).trim().toLowerCase().replace(/\s+/g, " ");
}

export function softMatch(expected: unknown, actual: unknown): boolean {
  const e = normalizeString(expected);
  const a = normalizeString(actual);
  if (!e || !a) return false;
  if (e === a) return true;
  if (e.length >= 4 && a.includes(e)) return true;
  if (a.length >= 4 && e.includes(a)) return true;
  return false;
}

