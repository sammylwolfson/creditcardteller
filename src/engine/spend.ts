import { RewardCap, SpendLedger } from "../types/domain";

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
