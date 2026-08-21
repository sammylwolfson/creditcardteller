import { getSpend, periodKey, pruneLedger, recordSpend, remainingCap } from "../src/engine/spend";
import { RewardCap } from "../src/types/domain";
import { assertClose, assertEqual, assertTrue, suite, test } from "./harness";

const yearly: RewardCap = { amount: 6000, period: "year", rateAfterCap: 0.01 };
const monthly: RewardCap = { amount: 500, period: "month" };

suite("spend ledger", () => {
  test("buckets by period", () => {
    const day = new Date("2026-08-21T12:00:00");
    assertEqual(periodKey("month", day), "2026-08");
    assertEqual(periodKey("quarter", day), "2026-Q3");
    assertEqual(periodKey("year", day), "2026");
  });

  test("accumulates spend and reports remaining headroom", () => {
    const day = new Date("2026-08-21T12:00:00");
    let ledger = recordSpend({}, "bcp-supermarkets", yearly, 1000, day);
    ledger = recordSpend(ledger, "bcp-supermarkets", yearly, 500, day);

    assertClose(getSpend(ledger, "bcp-supermarkets", yearly, day), 1500);
    assertClose(remainingCap(ledger, "bcp-supermarkets", yearly, day), 4500);
  });

  test("never reports negative headroom", () => {
    const day = new Date("2026-08-21T12:00:00");
    const ledger = recordSpend({}, "bcp-supermarkets", yearly, 9000, day);
    assertClose(remainingCap(ledger, "bcp-supermarkets", yearly, day), 0);
  });

  test("ignores junk amounts", () => {
    const day = new Date("2026-08-21T12:00:00");
    let ledger = recordSpend({}, "rule", monthly, -20, day);
    ledger = recordSpend(ledger, "rule", monthly, Number.NaN, day);
    assertClose(getSpend(ledger, "rule", monthly, day), 0);
  });

  test("a new period starts fresh", () => {
    const august = new Date("2026-08-21T12:00:00");
    const september = new Date("2026-09-01T12:00:00");
    const ledger = recordSpend({}, "rule", monthly, 400, august);

    assertClose(getSpend(ledger, "rule", monthly, august), 400);
    assertClose(getSpend(ledger, "rule", monthly, september), 0, "September has its own bucket");
  });

  test("pruning keeps only reachable buckets", () => {
    const august = new Date("2026-08-21T12:00:00");
    let ledger = recordSpend({}, "rule", monthly, 100, new Date("2025-01-05T12:00:00"));
    ledger = recordSpend(ledger, "rule", monthly, 100, august);

    const pruned = pruneLedger(ledger, august);
    assertClose(getSpend(pruned, "rule", monthly, august), 100, "current month survives");
    assertTrue(
      Object.keys(pruned["rule"] ?? {}).length === 1,
      "the stale 2025 bucket is dropped"
    );
  });
});
