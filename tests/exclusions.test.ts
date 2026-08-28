import { seedCards } from "../src/data/cards";
import { seedMerchants } from "../src/data/merchants";
import { recommend, scoreCard } from "../src/engine/rewards";
import { Card, Merchant } from "../src/types/domain";
import { assertClose, assertEqual, assertTrue, suite, test } from "./harness";

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
const swipe = { channel: "in_store" as const, paymentMethod: "physical_card" as const };

/**
 * Issuers exclude by *kind of store*, not by category. These used to be prose
 * notes the user had to read; they are now conditions the engine enforces.
 */
suite("issuer exclusions", () => {
  test("4% gas does not pay at a warehouse club fuel station", () => {
    const atShell = scoreCard(card("costco-anywhere-visa"), { merchant: merchant("shell"), ...swipe }, { now: NOW });
    assertEqual(atShell.appliedRuleId, "costco-gas", "an ordinary gas station still earns 4%");
    assertClose(atShell.effectiveRate, 0.04);

    const atClub = scoreCard(
      card("costco-anywhere-visa"),
      { merchant: merchant("sams-club-gas"), ...swipe },
      { now: NOW }
    );
    assertEqual(atClub.appliedRuleId, "costco-base", "the club fuel station falls through to base");
    assertClose(atClub.effectiveRate, 0.01, "1%, not the 4% the category alone would imply");
  });

  test("6% supermarkets does not pay at a superstore that sells groceries", () => {
    // Exactly what a user creates when they save their local Walmart grocery.
    const superstoreGrocer: Merchant = {
      id: "user-neighborhood-superstore",
      name: "Neighborhood Superstore",
      category: "grocery",
      traits: ["superstore"],
      isCustom: true
    };

    const excluded = scoreCard(
      card("amex-blue-cash-preferred"),
      { merchant: superstoreGrocer, ...swipe },
      { now: NOW }
    );
    assertEqual(excluded.appliedRuleId, "bcp-base", "6% is excluded here");
    assertClose(excluded.effectiveRate, 0.01);

    // A real supermarket is unaffected.
    const supermarket = scoreCard(
      card("amex-blue-cash-preferred"),
      { merchant: merchant("pavilions"), ...swipe },
      { now: NOW }
    );
    assertClose(supermarket.effectiveRate, 0.06, "an actual supermarket still earns 6%");
  });

  test("the exclusion survives a merchant being re-categorised", () => {
    // The whole point of traits: category can be wrong or edited, the kind of
    // store cannot. Target relabelled as grocery must still be excluded.
    const relabelled: Merchant = { ...merchant("target"), category: "grocery" };

    const score = scoreCard(
      card("amex-blue-cash-preferred"),
      { merchant: relabelled, ...swipe },
      { now: NOW }
    );
    assertClose(score.effectiveRate, 0.01, "still excluded despite the grocery label");
  });

  test("a merchant with no traits is never excluded", () => {
    const plain: Merchant = { id: "user-corner-shop", name: "Corner Shop", category: "grocery" };
    const score = scoreCard(card("amex-blue-cash-preferred"), { merchant: plain, ...swipe }, { now: NOW });
    assertClose(score.effectiveRate, 0.06, "no traits means nothing to exclude on");
  });

  test("excludesMerchantIds blocks a single named merchant", () => {
    const fussy: Card = {
      ...card("citi-double-cash"),
      id: "fussy",
      rewardRules: [
        {
          id: "fussy-bonus",
          label: "5% on groceries except one chain",
          categories: ["grocery"],
          rate: 0.05,
          conditions: { excludesMerchantIds: ["pavilions"] }
        },
        { id: "fussy-base", label: "1% base", rate: 0.01 }
      ]
    };

    const blocked = scoreCard(fussy, { merchant: merchant("pavilions"), ...swipe }, { now: NOW });
    assertClose(blocked.effectiveRate, 0.01, "named merchant is excluded");

    const allowed = scoreCard(fussy, { merchant: merchant("trader-joes"), ...swipe }, { now: NOW });
    assertClose(allowed.effectiveRate, 0.05, "other grocers are unaffected");
  });

  test("an exclusion changes which card wins, not just its rate", () => {
    const result = recommend(seedCards, { merchant: merchant("sams-club-gas"), ...swipe }, { now: NOW });

    // Costco Visa's 4% is out, so the 3% gas card should lead.
    assertEqual(result.winner?.cardId, "amex-blue-cash-preferred", "3% gas now leads");
    assertClose(result.winner?.effectiveRate ?? 0, 0.03);
  });
});

suite("merchant trait integrity", () => {
  test("every warehouse club and superstore is tagged", () => {
    const clubs = ["costco", "costco-online", "costco-gas", "sams-club", "bjs", "sams-club-gas"];
    for (const id of clubs) {
      assertTrue(
        merchant(id).traits?.includes("warehouse_club") === true,
        `${id} must be tagged warehouse_club`
      );
    }

    for (const id of ["target", "walmart"]) {
      assertTrue(
        merchant(id).traits?.includes("superstore") === true,
        `${id} must be tagged superstore`
      );
    }
  });

  test("no merchant in the grocery category is tagged as a superstore or club", () => {
    // If this ever fails, either the tag or the category is wrong — and the
    // engine would be promising a supermarket rate at a store that is not one.
    for (const item of seedMerchants) {
      if (item.category !== "grocery") {
        continue;
      }
      assertTrue(
        !item.traits?.includes("superstore") && !item.traits?.includes("warehouse_club"),
        `${item.id} is categorised grocery but tagged as a superstore or club`
      );
    }
  });

  test("traits use only the known vocabulary", () => {
    const known = new Set(["superstore", "warehouse_club", "specialty_store"]);
    for (const item of seedMerchants) {
      for (const trait of item.traits ?? []) {
        assertTrue(known.has(trait), `${item.id} has unknown trait "${trait}"`);
      }
    }
  });
});
