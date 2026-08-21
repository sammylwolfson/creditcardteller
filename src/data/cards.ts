import { Card } from "../types/domain";

/**
 * Seed card catalogue.
 *
 * IMPORTANT: issuers change reward terms. Every card carries `termsAsOf` and a
 * `sourceNote` so the numbers can be re-verified against the issuer's own
 * benefits page. Treat these as a starting point the user edits, not as truth.
 *
 * Rate modelling conventions:
 * - `rate` is the nominal earn rate as a fraction of spend.
 * - Points cards use `rewardUnitValue: 1` (a cent per point, the redeem-for-cash
 *   floor) so the app never overstates a card. Users who transfer points can
 *   raise it in the card editor.
 * - Every card ends with a catch-all base rule so the engine always has an
 *   answer instead of falling through to 0%.
 */

const TERMS_AS_OF = "2026-08";

export const seedCards: Card[] = [
  {
    id: "costco-anywhere-visa",
    name: "Costco Anywhere Visa (Citi)",
    shortName: "Costco Visa",
    network: "Visa",
    rewardCurrency: "cash",
    rewardUnitValue: 1,
    annualFee: 0,
    foreignTransactionFee: 0,
    termsAsOf: TERMS_AS_OF,
    sourceNote:
      "Citi Costco Anywhere Visa benefits page. Rewards pay out as an annual certificate, not statement credit. Requires an active Costco membership.",
    rewardRules: [
      {
        id: "costco-gas",
        label: "4% on gas and EV charging",
        categories: ["gas"],
        rate: 0.04,
        caps: { amount: 7000, period: "year", rateAfterCap: 0.01 },
        note: "First $7,000 of combined gas/EV spend per year, then 1%. Excludes gas bought at Walmart and other warehouse clubs."
      },
      {
        id: "costco-restaurant-travel",
        label: "3% on restaurants and eligible travel",
        categories: ["restaurant", "travel", "hotel", "airline"],
        rate: 0.03,
        note: "Eligible travel is defined by Citi's merchant coding and excludes some third-party bookings."
      },
      {
        id: "costco-warehouse",
        label: "2% at Costco and Costco.com",
        merchantIds: ["costco", "costco-online"],
        rate: 0.02
      },
      {
        id: "costco-base",
        label: "1% on everything else",
        rate: 0.01
      }
    ]
  },
  {
    id: "apple-card",
    name: "Apple Card",
    shortName: "Apple Card",
    network: "Mastercard",
    rewardCurrency: "cash",
    rewardUnitValue: 1,
    annualFee: 0,
    foreignTransactionFee: 0,
    termsAsOf: TERMS_AS_OF,
    sourceNote:
      "Apple Card Daily Cash terms. The 3% partner list changes periodically; check the Wallet app for the current roster.",
    rewardRules: [
      {
        id: "apple-3pct-partners",
        label: "3% Daily Cash at Apple and select partners",
        merchantIds: ["apple-store", "uber", "walgreens", "nike", "exxon-mobil"],
        rate: 0.03,
        conditions: { paymentMethod: ["apple_pay"] },
        note: "Requires paying with Apple Pay. Partner list is maintained by Apple and changes."
      },
      {
        id: "apple-pay-2pct",
        label: "2% Daily Cash on Apple Pay",
        rate: 0.02,
        conditions: { paymentMethod: ["apple_pay"] }
      },
      {
        id: "apple-base",
        label: "1% Daily Cash on the titanium card",
        rate: 0.01,
        conditions: { paymentMethod: ["physical_card", "online_checkout"] }
      }
    ]
  },
  {
    id: "chase-freedom-unlimited",
    name: "Chase Freedom Unlimited",
    shortName: "Freedom Unlimited",
    network: "Visa",
    rewardCurrency: "points",
    rewardUnitValue: 1,
    annualFee: 0,
    foreignTransactionFee: 0.03,
    termsAsOf: TERMS_AS_OF,
    sourceNote:
      "Chase Freedom Unlimited pricing and terms. Earns Ultimate Rewards points; valued here at the 1 cent cash-redemption floor. Raise rewardUnitValue if you transfer to a premium Chase card.",
    rewardRules: [
      {
        id: "cfu-chase-travel",
        label: "5% on travel booked through Chase Travel",
        categories: ["travel", "hotel", "airline"],
        rate: 0.05,
        conditions: { requiresIssuerPortal: true },
        note: "Only applies when the booking goes through the Chase Travel portal."
      },
      {
        id: "cfu-dining",
        label: "3% on dining",
        categories: ["restaurant"],
        rate: 0.03
      },
      {
        id: "cfu-drugstore",
        label: "3% at drugstores",
        categories: ["drugstore"],
        rate: 0.03
      },
      {
        id: "cfu-base",
        label: "1.5% on everything else",
        rate: 0.015
      }
    ]
  },
  {
    id: "citi-double-cash",
    name: "Citi Double Cash",
    shortName: "Double Cash",
    network: "Mastercard",
    rewardCurrency: "cash",
    rewardUnitValue: 1,
    annualFee: 0,
    foreignTransactionFee: 0.03,
    termsAsOf: TERMS_AS_OF,
    sourceNote:
      "Citi Double Cash terms: 1% when you buy plus 1% as you pay it off. The second 1% only lands once the balance is paid.",
    rewardRules: [
      {
        id: "cdc-base",
        label: "2% on everything (1% buy + 1% pay)",
        rate: 0.02,
        note: "The second 1% posts when you pay the statement, so pay in full to actually earn 2%."
      }
    ]
  },
  {
    id: "amex-blue-cash-preferred",
    name: "American Express Blue Cash Preferred",
    shortName: "Blue Cash Pref",
    network: "American Express",
    rewardCurrency: "cash",
    rewardUnitValue: 1,
    annualFee: 95,
    foreignTransactionFee: 0.027,
    termsAsOf: TERMS_AS_OF,
    sourceNote:
      "Amex Blue Cash Preferred terms. Cash back arrives as Reward Dollars (statement credits). Carries a $95 annual fee, which the app does not amortise into per-purchase rates.",
    rewardRules: [
      {
        id: "bcp-supermarkets",
        label: "6% at U.S. supermarkets",
        categories: ["grocery"],
        rate: 0.06,
        caps: { amount: 6000, period: "year", rateAfterCap: 0.01 },
        note: "First $6,000 per year, then 1%. Superstores, warehouse clubs and specialty shops are excluded by Amex."
      },
      {
        id: "bcp-streaming",
        label: "6% on select U.S. streaming",
        categories: ["streaming"],
        rate: 0.06,
        note: "Only services on Amex's eligible list qualify."
      },
      {
        id: "bcp-gas-transit",
        label: "3% on U.S. gas and transit",
        categories: ["gas", "transit"],
        rate: 0.03
      },
      {
        id: "bcp-base",
        label: "1% on everything else",
        rate: 0.01
      }
    ]
  }
];
