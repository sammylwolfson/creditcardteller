import { seedCards } from "../src/data/cards";
import { seedMerchants } from "../src/data/merchants";
import { recommend } from "../src/engine/rewards";
import { Merchant } from "../src/types/domain";
import { assertEqual, assertTrue, suite, test } from "./harness";

const merchant = (id: string): Merchant => {
  const found = seedMerchants.find((item) => item.id === id);
  if (!found) {
    throw new Error(`test fixture missing merchant ${id}`);
  }
  return found;
};

const NOW = new Date("2026-08-21T12:00:00");

/**
 * The wallet is the set of cards the user actually holds. Scoring the whole
 * catalogue would recommend cards they cannot pay with, which is worse than
 * giving no answer.
 */
suite("wallet scoping", () => {
  test("only wallet cards are recommended", () => {
    const wallet = seedCards.filter((card) =>
      ["apple-card", "citi-double-cash"].includes(card.id)
    );

    const result = recommend(
      wallet,
      { merchant: merchant("pavilions"), channel: "in_store", paymentMethod: "apple_pay" },
      { now: NOW }
    );

    // Blue Cash Preferred pays 6% here but is not in this wallet.
    assertTrue(
      result.ranked.every((score) => score.cardId !== "amex-blue-cash-preferred"),
      "a card outside the wallet must never appear"
    );
    assertEqual(result.ranked.length, 2, "only the two held cards are scored");
  });

  test("an empty wallet yields no recommendation rather than a wrong one", () => {
    const result = recommend(
      [],
      { merchant: merchant("costco"), channel: "in_store", paymentMethod: "physical_card" },
      { now: NOW }
    );

    assertEqual(result.winner, null);
    assertEqual(result.ranked.length, 0);
    assertTrue(result.summary.length > 0, "there is still something to show the user");
  });

  test("a single-card wallet still explains itself", () => {
    const wallet = seedCards.filter((card) => card.id === "citi-double-cash");
    const result = recommend(
      wallet,
      { merchant: merchant("target"), channel: "in_store", paymentMethod: "physical_card" },
      { now: NOW }
    );

    assertEqual(result.winner?.cardId, "citi-double-cash");
    assertEqual(result.runnerUp, null);
    assertTrue(
      result.summary.includes("only card"),
      "a one-card wallet should say so rather than implying a comparison"
    );
  });
});

suite("expanded merchant catalogue", () => {
  test("merchant ids are unique", () => {
    const ids = new Set<string>();
    for (const item of seedMerchants) {
      assertTrue(!ids.has(item.id), `duplicate merchant id ${item.id}`);
      ids.add(item.id);
    }
  });

  test("superstores and clubs are not miscategorised as supermarkets", () => {
    // Amex excludes superstores and warehouse clubs from its 6% supermarket
    // rate, so these must not carry the grocery category.
    for (const id of ["target", "walmart", "costco", "sams-club", "bjs"]) {
      const item = merchant(id);
      assertTrue(
        item.category !== "grocery",
        `${item.name} must not be categorised as grocery`
      );
    }
  });

  test("Costco keeps its Visa-only restriction across all its entries", () => {
    for (const id of ["costco", "costco-online", "costco-gas"]) {
      assertEqual(merchant(id).acceptedNetworks?.join(","), "Visa", `${id} network restriction`);
    }
  });

  test("every merchant with a domain has a plausible one", () => {
    for (const item of seedMerchants) {
      for (const domain of item.domains ?? []) {
        assertTrue(/^[a-z0-9-]+\.[a-z.]{2,}$/.test(domain), `bad domain "${domain}" on ${item.id}`);
      }
    }
  });
});
