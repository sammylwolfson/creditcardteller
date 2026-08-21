import { seedMerchants } from "../src/data/merchants";
import {
  adHocMerchant,
  extractDomain,
  learnAlias,
  matchByRegionId,
  matchMerchant,
  normalizeText,
  tokenize
} from "../src/engine/merchantMatch";
import { Merchant } from "../src/types/domain";
import { assertEqual, assertIncludes, assertTrue, suite, test } from "./harness";

const bestId = (query: string, merchants: Merchant[] = seedMerchants): string | undefined =>
  matchMerchant(query, merchants).best?.merchant.id;

suite("text normalisation", () => {
  test("strips punctuation, case and accents", () => {
    assertEqual(normalizeText("McDonald's"), "mcdonalds");
    assertEqual(normalizeText("Café  Rouge"), "cafe rouge");
    assertEqual(normalizeText("Barnes & Noble"), "barnes and noble");
  });

  test("drops store numbers and processor noise from tokens", () => {
    assertEqual(tokenize("SQ *TRADER JOES #204").join(" "), "trader joes");
    assertEqual(tokenize("THE HOME DEPOT #1234 INC").join(" "), "home depot");
  });

  test("pulls a bare domain out of a checkout URL", () => {
    assertEqual(extractDomain("https://www.amazon.com/gp/checkout?id=3"), "amazon.com");
    assertEqual(extractDomain("shop.nike.com"), "nike.com");
    assertEqual(extractDomain("Trader Joe's"), null);
  });
});

suite("merchant matching", () => {
  test("matches a card statement descriptor", () => {
    const result = matchMerchant("SQ *TRADER JOES #204", seedMerchants);
    assertEqual(result.best?.merchant.id, "trader-joes");
    assertEqual(result.confidence, "high");
    assertTrue(!result.needsConfirmation, "a clean descriptor match needs no confirmation");
  });

  test("matches a checkout URL by domain", () => {
    const result = matchMerchant("https://www.costco.com/cart", seedMerchants);
    assertEqual(result.best?.merchant.id, "costco-online");
    assertEqual(result.best?.via, "domain");
    assertEqual(result.confidence, "high");
  });

  test("handles common misspellings", () => {
    assertEqual(bestId("pavillions"), "pavilions");
    assertEqual(bestId("mc donalds"), "mcdonalds");
    assertEqual(bestId("wholefoods"), "whole-foods");
  });

  test("distinguishes the warehouse, the website and the gas station", () => {
    assertEqual(bestId("costco"), "costco");
    assertEqual(bestId("costco gas"), "costco-gas");
    assertEqual(bestId("costco.com"), "costco-online");
  });

  test("flags genuinely ambiguous queries instead of guessing", () => {
    const merchants: Merchant[] = [
      { id: "blue-bottle", name: "Blue Bottle", category: "restaurant" },
      { id: "blue-bottle-coffee", name: "Blue Bottle Coffee", category: "restaurant" }
    ];

    const result = matchMerchant("blue bottl", merchants);
    assertEqual(result.confidence, "ambiguous");
    assertTrue(result.needsConfirmation, "ambiguity must ask the user");
    assertTrue(result.candidates.length >= 2, "both options should be offered");
    assertIncludes(result.explanation, "Confirm");
  });

  test("returns nothing rather than a bad guess for an unknown store", () => {
    const result = matchMerchant("zzzqqx bodega", seedMerchants);
    assertEqual(result.best, null);
    assertTrue(result.needsConfirmation, "unknown merchants must be confirmed");
    assertIncludes(result.explanation, "Pick a category");
  });

  test("a confirmed spelling is remembered", () => {
    const learned = learnAlias({}, "SQ *TJS MKT #12", "trader-joes");
    const result = matchMerchant("sq *tjs mkt #12", seedMerchants, { learnedAliases: learned });

    assertEqual(result.best?.merchant.id, "trader-joes");
    assertEqual(result.best?.via, "learned");
    assertEqual(result.confidence, "high");
  });

  test("geofence regions resolve by id", () => {
    const hit = matchByRegionId("costco", seedMerchants);
    assertEqual(hit.best?.merchant.id, "costco");
    assertEqual(hit.confidence, "high");

    const miss = matchByRegionId("not-a-store", seedMerchants);
    assertEqual(miss.best, null);
    assertIncludes(miss.explanation, "unknown region");
  });

  test("builds a usable stand-in for an unknown merchant", () => {
    const adhoc = adHocMerchant("Joe's Corner Market", "grocery");
    assertEqual(adhoc.category, "grocery");
    assertEqual(adhoc.id, "adhoc:joes-corner-market");
    assertTrue(adhoc.isCustom === true, "ad hoc merchants are user data");
  });

  test("every seeded merchant matches its own name and aliases", () => {
    for (const merchant of seedMerchants) {
      const byName = matchMerchant(merchant.name, seedMerchants);
      assertEqual(byName.best?.merchant.id, merchant.id, `name lookup for ${merchant.name}`);

      for (const alias of merchant.aliases ?? []) {
        const byAlias = matchMerchant(alias, seedMerchants);
        assertEqual(byAlias.best?.merchant.id, merchant.id, `alias "${alias}"`);
      }
    }
  });
});
