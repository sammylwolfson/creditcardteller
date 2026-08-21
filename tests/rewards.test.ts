import { seedCards } from "../src/data/cards";
import { seedMerchants } from "../src/data/merchants";
import { recommend, scoreCard } from "../src/engine/rewards";
import { recordSpend } from "../src/engine/spend";
import { Card, Merchant, SpendLedger } from "../src/types/domain";
import { assertClose, assertEqual, assertIncludes, assertTrue, suite, test } from "./harness";

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

const NOW = new Date("2026-08-21T12:00:00");

suite("rewards engine", () => {
  test("picks the highest cash-equivalent rate, not the most specific rule", () => {
    // Regression: the old engine sorted by rule specificity first, so a 1%
    // merchant-specific rule shadowed a 5% category rule on the same card.
    const trap: Card = {
      id: "trap",
      name: "Trap Card",
      shortName: "Trap",
      network: "Visa",
      rewardCurrency: "cash",
      rewardUnitValue: 1,
      annualFee: 0,
      foreignTransactionFee: 0,
      rewardRules: [
        { id: "trap-merchant", label: "1% at Trader Joe's", merchantIds: ["trader-joes"], rate: 0.01 },
        { id: "trap-category", label: "5% on groceries", categories: ["grocery"], rate: 0.05 },
        { id: "trap-base", label: "0.5% base", rate: 0.005 }
      ]
    };

    const score = scoreCard(
      trap,
      { merchant: merchant("trader-joes"), channel: "in_store", paymentMethod: "physical_card" },
      {},
      NOW
    );

    assertEqual(score.appliedRuleId, "trap-category", "5% category rule should win");
    assertClose(score.effectiveRate, 0.05, "effective rate");
  });

  test("excludes cards the merchant does not accept", () => {
    const result = recommend(
      seedCards,
      { merchant: merchant("costco"), channel: "in_store", paymentMethod: "apple_pay" },
      { now: NOW }
    );

    const amex = result.ranked.find((score) => score.cardId === "amex-blue-cash-preferred");
    assertTrue(amex?.eligible === false, "Amex should be ineligible at Costco");
    assertIncludes(amex?.ineligibleReason ?? "", "only accepts Visa");

    const applePay = result.ranked.find((score) => score.cardId === "apple-card");
    assertTrue(applePay?.eligible === false, "Mastercard should be ineligible at Costco");

    assertEqual(result.winner?.cardId, "costco-anywhere-visa", "Costco Visa should win at Costco");
    assertClose(result.winner?.effectiveRate ?? 0, 0.02, "2% at the warehouse");
  });

  test("6% groceries beats 2% flat while cap headroom remains", () => {
    const result = recommend(
      seedCards,
      { merchant: merchant("pavilions"), channel: "in_store", paymentMethod: "apple_pay", amount: 100 },
      { now: NOW }
    );

    assertEqual(result.winner?.cardId, "amex-blue-cash-preferred");
    assertClose(result.winner?.effectiveRate ?? 0, 0.06, "6% supermarkets");
    assertClose(result.winner?.estimatedValue ?? 0, 6, "$6 on a $100 basket");
    // Apple Card on Apple Pay and Double Cash both sit at 2%, so only the
    // runner-up *rate* is meaningful here.
    assertClose(result.runnerUp?.effectiveRate ?? 0, 0.02, "next best is a 2% card");
    assertClose(result.deltaVsRunnerUp, 0.04, "4 point win");
    assertClose(result.dollarDeltaVsRunnerUp ?? 0, 4, "$4 better");
  });

  test("an exhausted category cap changes the winner", () => {
    const ledger: SpendLedger = recordSpend(
      {},
      "bcp-supermarkets",
      { amount: 6000, period: "year", rateAfterCap: 0.01 },
      6000,
      NOW
    );

    const result = recommend(
      seedCards,
      { merchant: merchant("pavilions"), channel: "in_store", paymentMethod: "apple_pay" },
      { ledger, now: NOW }
    );

    assertClose(result.winner?.effectiveRate ?? 0, 0.02, "a 2% card wins once 6% is used up");
    assertTrue(
      result.winner?.cardId !== "amex-blue-cash-preferred",
      "the capped-out card should no longer win"
    );

    const amex = result.ranked.find((score) => score.cardId === "amex-blue-cash-preferred");
    assertClose(amex?.effectiveRate ?? 0, 0.01, "Amex drops to the post-cap rate");
    assertTrue(
      (amex?.factors ?? []).some((factor) => factor.label === "Category cap reached"),
      "the cap should be named in the explanation"
    );
  });

  test("blends the rate when a purchase straddles the cap", () => {
    const ledger = recordSpend(
      {},
      "bcp-supermarkets",
      { amount: 6000, period: "year", rateAfterCap: 0.01 },
      5800,
      NOW
    );

    const score = scoreCard(
      card("amex-blue-cash-preferred"),
      { merchant: merchant("pavilions"), channel: "in_store", paymentMethod: "apple_pay", amount: 1000 },
      ledger,
      NOW
    );

    // $200 left at 6%, the other $800 at 1% => 2.0% blended.
    assertClose(score.effectiveRate, 0.02, "blended rate", 1e-6);
    assertClose(score.estimatedValue ?? 0, 20, "$20 of cash back", 1e-6);
  });

  test("foreign transaction fees flip the ranking abroad", () => {
    const restaurant = merchant("chipotle");
    const domestic = recommend(
      seedCards,
      { merchant: restaurant, channel: "in_store", paymentMethod: "physical_card" },
      { now: NOW }
    );
    assertClose(domestic.winner?.effectiveRate ?? 0, 0.03, "3% dining at home");

    const abroad = recommend(
      seedCards,
      {
        merchant: restaurant,
        channel: "in_store",
        paymentMethod: "physical_card",
        isForeignTransaction: true
      },
      { now: NOW }
    );

    assertEqual(abroad.winner?.cardId, "costco-anywhere-visa", "the no-fee card wins abroad");
    assertClose(abroad.winner?.effectiveRate ?? 0, 0.03, "no fee, still 3%");

    const freedom = abroad.ranked.find((score) => score.cardId === "chase-freedom-unlimited");
    assertClose(freedom?.effectiveRate ?? 0, 0, "3% earn minus a 3% fee is a wash");
  });

  test("point valuation is applied before ranking", () => {
    const transferrable: Card = { ...card("chase-freedom-unlimited"), rewardUnitValue: 1.5 };
    const score = scoreCard(
      transferrable,
      { merchant: merchant("home-depot"), channel: "in_store", paymentMethod: "physical_card" },
      {},
      NOW
    );

    assertClose(score.effectiveRate, 0.0225, "1.5% at 1.5x is 2.25%");
    assertTrue(
      score.factors.some((factor) => factor.label === "Point valuation"),
      "the multiplier should show up in the explanation"
    );
  });

  test("issuer-portal rules only fire when the booking goes through the portal", () => {
    const hotel = merchant("marriott");

    const direct = recommend(
      seedCards,
      { merchant: hotel, channel: "online", paymentMethod: "online_checkout" },
      { now: NOW }
    );
    assertEqual(direct.winner?.cardId, "costco-anywhere-visa", "3% travel beats 1.5% base");

    const portal = recommend(
      seedCards,
      {
        merchant: hotel,
        channel: "online",
        paymentMethod: "online_checkout",
        viaIssuerPortal: true
      },
      { now: NOW }
    );
    assertEqual(portal.winner?.cardId, "chase-freedom-unlimited", "5% through Chase Travel");
    assertClose(portal.winner?.effectiveRate ?? 0, 0.05);
  });

  test("falls back gracefully when the merchant does not take Apple Pay", () => {
    const result = recommend(
      seedCards,
      { merchant: merchant("costco-online"), channel: "online", paymentMethod: "apple_pay" },
      { now: NOW }
    );

    assertTrue(
      result.adjustments.some((note) => note.includes("does not take Apple Pay")),
      "the adjustment should be surfaced, not silent"
    );
    assertEqual(result.winner?.cardId, "costco-anywhere-visa", "2% at Costco.com");
    assertClose(result.winner?.effectiveRate ?? 0, 0.02);
  });

  test("reports ties instead of inventing a winner", () => {
    const result = recommend(
      seedCards,
      { merchant: merchant("mcdonalds"), channel: "in_store", paymentMethod: "physical_card" },
      { now: NOW }
    );

    assertTrue(result.isTie, "Costco Visa and Freedom Unlimited both pay 3% on dining");
    assertClose(result.deltaVsRunnerUp, 0, "no gap");
    assertIncludes(result.summary, "Either is fine");
  });

  test("honours an override and explains what it displaced", () => {
    const result = recommend(
      seedCards,
      { merchant: merchant("pavilions"), channel: "in_store", paymentMethod: "apple_pay" },
      {
        overrides: [{ merchantId: "pavilions", cardId: "apple-card", createdAt: 0 }],
        now: NOW
      }
    );

    assertEqual(result.winner?.cardId, "apple-card");
    assertEqual(result.overrideApplied?.defaultBestCardId, "amex-blue-cash-preferred");
    assertIncludes(result.summary, "your saved choice");
  });

  test("ignores an override for a card the merchant rejects", () => {
    const result = recommend(
      seedCards,
      { merchant: merchant("costco"), channel: "in_store", paymentMethod: "physical_card" },
      {
        overrides: [{ merchantId: "costco", cardId: "apple-card", createdAt: 0 }],
        now: NOW
      }
    );

    assertEqual(result.winner?.cardId, "costco-anywhere-visa");
    assertTrue(
      result.adjustments.some((note) => note.includes("cannot be used here")),
      "the user should be told their override was skipped"
    );
  });

  test("says so when no card can be used at all", () => {
    const visaOnly = seedCards.filter((item) => item.network !== "Visa");
    const result = recommend(
      visaOnly,
      { merchant: merchant("costco"), channel: "in_store", paymentMethod: "physical_card" },
      { now: NOW }
    );

    assertEqual(result.winner, null);
    assertIncludes(result.summary, "No card in your wallet");
  });

  test("every seeded card answers every seeded merchant", () => {
    for (const item of seedMerchants) {
      for (const channel of ["in_store", "online"] as const) {
        const result = recommend(
          seedCards,
          { merchant: item, channel, paymentMethod: channel === "online" ? "online_checkout" : "physical_card" },
          { now: NOW }
        );
        assertTrue(
          result.winner != null,
          `no recommendation for ${item.name} (${channel})`
        );
        assertTrue(
          (result.winner?.effectiveRate ?? 0) > 0,
          `zero rate recommended for ${item.name} (${channel})`
        );
      }
    }
  });
});
