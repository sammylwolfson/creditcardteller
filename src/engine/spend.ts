import { ActivationLedger, Quarter, RewardCap, SpendLedger } from "../types/domain";

/**
 * Spend tracking for capped bonus categories.
 *
 * Caps are the difference between "6% at supermarkets" and what you actually
 * earn in December. The ledger is a local tally the user maintains by logging
 * purchases; it is intentionally not a bank feed.
 */

/** Bucket key for a cap period, e.g. "2026-08", "2026-Q3", "2026". */
export const periodKey = (period: RewardCap["period"], at: Date): string => {
  const year = at.getFullYear();
  switch (period) {
    case "month":
      return `${year}-${String(at.getMonth() + 1).padStart(2, "0")}`;
    case "quarter":
      return `${year}-Q${Math.floor(at.getMonth() / 3) + 1}`;
    case "year":
      return `${year}`;
  }
};

export const getSpend = (
  ledger: SpendLedger,
  ruleId: string,
  cap: RewardCap,
  at: Date = new Date()
): number => ledger[ruleId]?.[periodKey(cap.period, at)] ?? 0;

export const remainingCap = (
  ledger: SpendLedger,
  ruleId: string,
  cap: RewardCap,
  at: Date = new Date()
): number => Math.max(0, cap.amount - getSpend(ledger, ruleId, cap, at));

/** Returns a new ledger with `amount` added to the rule's current period. */
export const recordSpend = (
  ledger: SpendLedger,
  ruleId: string,
  cap: RewardCap,
  amount: number,
  at: Date = new Date()
): SpendLedger => {
  if (!Number.isFinite(amount) || amount <= 0) {
    return ledger;
  }

  const key = periodKey(cap.period, at);
  const forRule = ledger[ruleId] ?? {};
  return {
    ...ledger,
    [ruleId]: { ...forRule, [key]: (forRule[key] ?? 0) + amount }
  };
};

/** Drops period buckets that can no longer be reached, keeping storage small. */
export const pruneLedger = (ledger: SpendLedger, at: Date = new Date()): SpendLedger => {
  const keep = new Set([
    periodKey("month", at),
    periodKey("quarter", at),
    periodKey("year", at)
  ]);

  const pruned: SpendLedger = {};
  for (const [ruleId, buckets] of Object.entries(ledger)) {
    const kept = Object.entries(buckets).filter(([key]) => keep.has(key));
    if (kept.length > 0) {
      pruned[ruleId] = Object.fromEntries(kept);
    }
  }
  return pruned;
};

/* --------------------------------------------------------------------------
 * Rotating quarterly categories
 * ----------------------------------------------------------------------- */

/** Calendar quarter for a date, 1-indexed. */
export const quarterOf = (at: Date): Quarter =>
  (Math.floor(at.getMonth() / 3) + 1) as Quarter;

/** Key a rotating rule's activation is recorded under, e.g. "2026-Q3". */
export const activationKey = (at: Date): string => periodKey("quarter", at);

export const isActivated = (
  ledger: ActivationLedger,
  ruleId: string,
  at: Date = new Date()
): boolean => (ledger[ruleId] ?? []).includes(activationKey(at));

/** Returns a new ledger with this quarter marked activated for the rule. */
export const activateQuarter = (
  ledger: ActivationLedger,
  ruleId: string,
  at: Date = new Date()
): ActivationLedger => {
  const key = activationKey(at);
  const current = ledger[ruleId] ?? [];
  if (current.includes(key)) {
    return ledger;
  }
  return { ...ledger, [ruleId]: [...current, key] };
};

/** Undo an activation, for when the user taps the toggle back off. */
export const deactivateQuarter = (
  ledger: ActivationLedger,
  ruleId: string,
  at: Date = new Date()
): ActivationLedger => {
  const key = activationKey(at);
  const remaining = (ledger[ruleId] ?? []).filter((entry) => entry !== key);
  if (remaining.length === 0) {
    const { [ruleId]: _dropped, ...rest } = ledger;
    return rest;
  }
  return { ...ledger, [ruleId]: remaining };
};

/** Drops activation records for quarters that have already passed. */
export const pruneActivations = (
  ledger: ActivationLedger,
  at: Date = new Date()
): ActivationLedger => {
  const key = activationKey(at);
  const pruned: ActivationLedger = {};
  for (const [ruleId, keys] of Object.entries(ledger)) {
    const kept = keys.filter((entry) => entry === key);
    if (kept.length > 0) {
      pruned[ruleId] = kept;
    }
  }
  return pruned;
};
