import { seedCards } from "../src/data/cards";
import { seedMerchants } from "../src/data/merchants";
import { recommend, scoreCard } from "../src/engine/rewards";
import {
  activateQuarter,
  activationKey,
  deactivateQuarter,
  isActivated,
  pruneActivations,
  quarterOf,
  recordSpend
} from "../src/engine/spend";
import { ActivationLedger, Card, Merchant } from "../src/types/domain";
import { assertClose, assertEqual, assertFalse, assertTrue, suite, test } from "./harness";

const merchant = (id: string): Merchant => {
  const found = seedMerchants.find((item) => item.id === id);
  if (!found) {
    throw new Error(`test fixture missing merchant ${id}`);
  }
  return found;
};

const card = (id: string): Card => {
  const found = seedCards.find((item) => item.id === id);
  if (!found) {
    throw new Error(`test fixture missing card ${id}`);
  }
  return found;
};

const Q1 = new Date("2026-02-10T12:00:00");
const Q3 = new Date("2026-08-21T12:00:00");
const Q4 = new Date("2026-11-05T12:00:00");

const DISCOVER = "discover-it";
const FLEX = "chase-freedom-flex";

/** Activation ledger with the given rule switched on for `at`'s quarter. */
const activated = (ruleId: string, at: Date): ActivationLedger =>
  activateQuarter({}, ruleId, at);

suite("quarter bookkeeping", () => {
  test("quarters are derived from the calendar month", () => {
    assertEqual(quarterOf(new Date("2026-01-01T00:00:00")), 1);
    assertEqual(quarterOf(new Date("2026-03-31T23:59:59")), 1);
    assertEqual(quarterOf(new Date("2026-04-01T00:00:00")), 2);
    assertEqual(quarterOf(Q3), 3);
    assertEqual(quarterOf(new Date("2026-12-31T12:00:00")), 4);
  });

  test("activation is recorded per quarter", () => {
    assertEqual(activationKey(Q3), "2026-Q3");

    const ledger = activated("discover-it-rotating-q3", Q3);
    assertTrue(isActivated(ledger, "discover-it-rotating-q3", Q3), "activated in Q3");
    assertFalse(
      isActivated(ledger, "discover-it-rotating-q3", Q4),
      "activating Q3 must not activate Q4"
    );
    assertFalse(isActivated({}, "discover-it-rotating-q3", Q3), "empty ledger activates nothing");
  });

  test("activating twice is idempotent and deactivating undoes it", () => {
    let ledger = activated("rule", Q3);
    const again = activateQuarter(ledger, "rule", Q3);
    assertEqual(again["rule"]?.length, 1, "no duplicate entry");

    ledger = deactivateQuarter(again, "rule", Q3);
    assertFalse(isActivated(ledger, "rule", Q3), "deactivated");
    assertEqual(Object.keys(ledger).length, 0, "empty rule entries are dropped");
  });

  test("pruning keeps only the current quarter", () => {
    let ledger = activated("rule", Q1);
    ledger = activateQuarter(ledger, "rule", Q3);

    const pruned = pruneActivations(ledger, Q3);
    assertTrue(isActivated(pruned, "rule", Q3), "current quarter survives");
    assertFalse(isActivated(pruned, "rule", Q1), "the stale quarter is dropped");
  });
});

suite("rotating quarterly categories", () => {
  test("a rotating rule is inert outside its quarter", () => {
    // Discover's Q1 rule covers groceries; in Q3 it must not apply at all,
    // even with the quarter activated.
    const score = scoreCard(
      card(DISCOVER),
      { merchant: merchant("pavilions"), channel: "in_store", paymentMethod: "physical_card" },
      { activations: activated(`${DISCOVER}-rotating-q1`, Q1), now: Q3 }
    );

    assertEqual(score.appliedRuleId, "discover-base", "falls through to the base rule");
    assertClose(score.effectiveRate, 0.01, "1% base");
  });

  test("an unactivated quarter earns the base rate and says so", () => {
    const score = scoreCard(
      card(DISCOVER),
      { merchant: merchant("pavilions"), channel: "in_store", paymentMethod: "physical_card" },
      { now: Q1 }
    );

    assertClose(score.effectiveRate, 0.01, "base rate until activated");
    assertTrue(
      score.factors.some((factor) => factor.label === "Not activated this quarter"),
      "the missed activation must be surfaced, not silently swallowed"
    );
  });

  test("activating the quarter unlocks the bonus rate", () => {
    const score = scoreCard(
      card(DISCOVER),
      { merchant: merchant("pavilions"), channel: "in_store", paymentMethod: "physical_card" },
      { activations: activated(`${DISCOVER}-rotating-q1`, Q1), now: Q1 }
    );

    assertEqual(score.appliedRuleId, `${DISCOVER}-rotating-q1`);
    assertClose(score.effectiveRate, 0.05, "5% rotating category");
    assertFalse(
      score.factors.some((factor) => factor.label === "Not activated this quarter"),
      "no activation warning once activated"
    );
  });

  test("the quarterly cap still applies once activated", () => {
    const ruleId = `${DISCOVER}-rotating-q1`;
    const cap = { amount: 1500, period: "quarter" as const, rateAfterCap: 0.01 };
    const ledger = recordSpend({}, ruleId, cap, 1500, Q1);

    const score = scoreCard(
      card(DISCOVER),
      { merchant: merchant("pavilions"), channel: "in_store", paymentMethod: "physical_card" },
      { ledger, activations: activated(ruleId, Q1), now: Q1 }
    );

    assertClose(score.effectiveRate, 0.01, "drops to 1% once $1,500 is spent");
    assertTrue(
      score.factors.some((factor) => factor.label === "Category cap reached"),
      "the cap should be named"
    );
  });

  test("a purchase straddling the quarterly cap blends", () => {
    const ruleId = `${DISCOVER}-rotating-q1`;
    const cap = { amount: 1500, period: "quarter" as const, rateAfterCap: 0.01 };
    const ledger = recordSpend({}, ruleId, cap, 1400, Q1);

    const score = scoreCard(
      card(DISCOVER),
      {
        merchant: merchant("pavilions"),
        channel: "in_store",
        paymentMethod: "physical_card",
        amount: 500
      },
      { ledger, activations: activated(ruleId, Q1), now: Q1 }
    );

    // $100 left at 5%, the remaining $400 at 1% => 1.8% blended.
    assertClose(score.effectiveRate, 0.018, "blended across the cap", 1e-6);
  });

  test("an activated rotation can win the whole recommendation", () => {
    const input = {
      merchant: merchant("pavilions"),
      channel: "in_store" as const,
      paymentMethod: "physical_card" as const
    };

    const dormant = recommend(seedCards, input, { now: Q1 });
    assertEqual(
      dormant.winner?.cardId,
      "amex-blue-cash-preferred",
      "without activation the 6% supermarket card wins"
    );

    // Activating both rotating cards puts them at 5%, still under Amex's 6%.
    let activations = activated(`${DISCOVER}-rotating-q1`, Q1);
    activations = activateQuarter(activations, `${FLEX}-rotating-q1`, Q1);
    const live = recommend(seedCards, input, { activations, now: Q1 });
    assertEqual(live.winner?.cardId, "amex-blue-cash-preferred", "6% still beats 5%");

    // Once the Amex supermarket cap is exhausted, the activated 5% takes over.
    const ledger = recordSpend(
      {},
      "bcp-supermarkets",
      { amount: 6000, period: "year", rateAfterCap: 0.01 },
      6000,
      Q1
    );
    const capped = recommend(seedCards, input, { activations, ledger, now: Q1 });
    assertClose(capped.winner?.effectiveRate ?? 0, 0.05, "an activated rotation now wins");
    assertTrue(
      [DISCOVER, FLEX].includes(capped.winner?.cardId ?? ""),
      `expected a rotating card to win, got ${capped.winner?.cardId}`
    );
  });

  test("both rotating cards seed four quarters with a cap and activation", () => {
    for (const cardId of [DISCOVER, FLEX]) {
      const rules = card(cardId).rewardRules.filter((rule) => rule.conditions?.activeQuarters);
      assertEqual(rules.length, 4, `${cardId} should cover all four quarters`);

      const quarters = new Set<number>();
      for (const rule of rules) {
        assertEqual(rule.rate, 0.05, `${rule.id} should be a 5% rule`);
        assertTrue(rule.conditions?.requiresActivation === true, `${rule.id} needs activation`);
        assertEqual(rule.caps?.amount, 1500, `${rule.id} cap amount`);
        assertEqual(rule.caps?.period, "quarter", `${rule.id} cap period`);
        for (const quarter of rule.conditions?.activeQuarters ?? []) {
          assertFalse(quarters.has(quarter), `${cardId} has two rules for Q${quarter}`);
          quarters.add(quarter);
        }
      }
      assertEqual(quarters.size, 4, `${cardId} quarters are distinct`);
    }
  });

  test("every quarter of the year still yields a recommendation", () => {
    for (const at of [Q1, new Date("2026-05-05T12:00:00"), Q3, Q4]) {
      const result = recommend(
        seedCards,
        {
          merchant: merchant("pavilions"),
          channel: "in_store",
          paymentMethod: "physical_card"
        },
        { now: at }
      );
      assertTrue(result.winner != null, `no winner in Q${quarterOf(at)}`);
      assertTrue((result.winner?.effectiveRate ?? 0) > 0, `zero rate in Q${quarterOf(at)}`);
    }
  });
});

suite("annual fee amortisation", () => {
  const input = {
    merchant: merchant("pavilions"),
    channel: "in_store" as const,
    paymentMethod: "physical_card" as const
  };

  test("off by default: the fee stays a caveat", () => {
    const score = scoreCard(card("amex-blue-cash-preferred"), input, { now: Q3 });

    assertClose(score.effectiveRate, 0.06, "headline rate untouched");
    assertTrue(
      score.caveats.some((note) => note.includes("annual fee is not amortised")),
      "the fee should still be disclosed"
    );
  });

  test("on: the fee is spread across assumed spend and subtracted", () => {
    const score = scoreCard(card("amex-blue-cash-preferred"), input, {
      amortiseAnnualFees: true,
      assumedAnnualSpend: 24000,
      now: Q3
    });

    // $95 / $24,000 = 0.3958 points off every purchase.
    assertClose(score.effectiveRate, 0.06 - 95 / 24000, "fee amortised into the rate", 1e-6);
    assertTrue(
      score.factors.some((factor) => factor.label === "Annual fee, amortised"),
      "the deduction must be explained"
    );
    assertFalse(
      score.caveats.some((note) => note.includes("not amortised")),
      "the caveat is redundant once the fee is in the rate"
    );
  });

  test("no-fee cards are unaffected", () => {
    const score = scoreCard(card("citi-double-cash"), input, {
      amortiseAnnualFees: true,
      assumedAnnualSpend: 24000,
      now: Q3
    });

    assertClose(score.effectiveRate, 0.02, "no fee, no deduction");
    assertFalse(
      score.factors.some((factor) => factor.label === "Annual fee, amortised"),
      "nothing to amortise"
    );
  });

  test("the fee card is charged for its fee while free cards are not", () => {
    // Spreading $95 across a modest year of spend visibly costs the Amex,
    // while the no-fee leader is untouched.
    const lean = { ...input, merchant: merchant("shell") };

    const raw = recommend(seedCards, lean, { now: Q3 });
    assertEqual(raw.winner?.cardId, "costco-anywhere-visa", "4% gas leads on headline rate");

    const amortised = recommend(seedCards, lean, {
      amortiseAnnualFees: true,
      assumedAnnualSpend: 6000,
      now: Q3
    });
    assertEqual(
      amortised.winner?.cardId,
      "costco-anywhere-visa",
      "the no-fee card keeps the win once fees are charged"
    );
    const amex = amortised.ranked.find((score) => score.cardId === "amex-blue-cash-preferred");
    assertClose(amex?.effectiveRate ?? 0, 0.03 - 95 / 6000, "Amex pays for its fee", 1e-6);
  });

  test("a zero or missing spend estimate falls back to the caveat", () => {
    const score = scoreCard(card("amex-blue-cash-preferred"), input, {
      amortiseAnnualFees: true,
      assumedAnnualSpend: 0,
      now: Q3
    });

    assertClose(score.effectiveRate, 0.06, "no divide-by-zero, no bogus deduction");
    assertTrue(
      score.caveats.some((note) => note.includes("not amortised")),
      "falls back to disclosing the fee"
    );
  });
});
