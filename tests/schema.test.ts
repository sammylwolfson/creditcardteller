import { seedCards } from "../src/data/cards";
import { seedMerchants, seedSettings } from "../src/data/merchants";
import {
  isCardArray,
  isDecisionArray,
  isMerchantArray,
  isNudgeState,
  isOverrideArray,
  isSettings,
  isStringArray
} from "../src/services/schema";
import { assertFalse, assertTrue, suite, test } from "./harness";

/** The card shape this app shipped before caps, networks and point values. */
const v1Cards = [
  {
    id: "costco-anywhere-visa",
    name: "Costco Anywhere Visa (Citi)",
    network: "Visa",
    rewardRules: [{ id: "costco-default", rate: 0.01, note: "All other purchases earn 1%" }]
  }
];

suite("stored data validation", () => {
  test("accepts the data this version writes", () => {
    assertTrue(isCardArray(seedCards), "seed cards round-trip");
    assertTrue(isMerchantArray(seedMerchants), "seed merchants round-trip");
    assertTrue(isSettings(seedSettings), "seed settings round-trip");
    assertTrue(isStringArray(["costco", "pavilions"]), "favorites are ids");
    assertTrue(isNudgeState({ lastNudgeAt: 0, lastNudgeByMerchant: {} }), "nudge state");
  });

  test("rejects v1 cards rather than scoring against missing fields", () => {
    assertFalse(isCardArray(v1Cards), "v1 cards must not pass as v2");
  });

  test("rejects corrupt or hostile records", () => {
    assertFalse(isCardArray(null), "null");
    assertFalse(isCardArray("[]"), "a string that looks like an array");
    assertFalse(isCardArray([{ id: 1 }]), "wrong field types");
    assertFalse(isMerchantArray([{ id: "x", name: "x" }]), "missing category");
    assertFalse(isOverrideArray([{ merchantId: "x" }]), "missing cardId");
    assertFalse(isDecisionArray([{ merchantId: "x", cardId: "y" }]), "missing timestamp");
    assertFalse(isSettings({ quietHoursStart: 22 }), "partial settings");
  });

  test("survives a JSON round trip of real data", () => {
    const roundTripped: unknown = JSON.parse(JSON.stringify(seedCards));
    assertTrue(isCardArray(roundTripped), "serialised cards still validate");
  });
});
