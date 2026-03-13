import { normalizeString, softMatch } from "./normalize.js";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function buildVerificationPrompts(privateDetails: unknown) {
  const details = asRecord(privateDetails);
  const keys = Object.keys(details).filter((k) => details[k] != null && normalizeString(details[k]) !== "");
  return keys.slice(0, 6).map((k) => ({ key: k, label: k.replace(/([A-Z])/g, " $1").trim() }));
}

export function evaluateClaim({
  lostItem,
  answers,
  kRequiredOverride
}: {
  lostItem: { privateDetails?: unknown };
  answers: unknown;
  kRequiredOverride?: number;
}) {
  const privateTarget = asRecord(lostItem.privateDetails);
  const a = asRecord(answers);

  const prompts = buildVerificationPrompts(privateTarget);
  const nTotal = prompts.length;
  const kRequired = kRequiredOverride ?? Math.max(1, Math.ceil(nTotal * 0.7));

  let verifiedCount = 0;
  const perField: Record<string, { ok: boolean; expectedPresent: boolean }> = {};

  for (const p of prompts) {
    const expected = privateTarget[p.key];
    const actual = a[p.key];
    const expectedPresent = normalizeString(expected) !== "";

    let ok = false;
    if (typeof expected === "boolean") ok = Boolean(actual) === expected;
    else if (typeof expected === "number") ok = Number(actual) === expected;
    else ok = softMatch(expected, actual);

    if (expectedPresent && ok) verifiedCount += 1;
    perField[p.key] = { ok, expectedPresent };
  }

  const passes = verifiedCount >= kRequired;

  return {
    passes,
    kRequired,
    nTotal,
    verifiedCount,
    breakdown: { perField, policy: "k_of_n", note: "Uses lost item's privateDetails as ground truth" }
  };
}
