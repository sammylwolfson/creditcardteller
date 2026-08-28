import { Card, MerchantCategory, RewardRule } from "../types/domain";

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

/**
 * Rotating quarterly bonus categories.
 *
 * IMPORTANT: issuers publish a new calendar every year and announce each
 * quarter shortly before it starts. The quarter-to-category mapping below is a
 * *placeholder shaped like the real thing*, not a transcription of any
 * published calendar — it uses the categories these programs perennially
 * rotate through so the engine and UI can be exercised. Before relying on a
 * recommendation, confirm the live categories with the issuer and edit the
 * `categories` array for the quarter in question.
 *
 * The structure is what matters and is correct: 5% on the quarter's categories,
 * capped at $1,500 of spend per quarter, dropping to 1% after, and paying only
 * the base rate until the cardholder activates that quarter.
 */
const CONFIRM_CALENDAR =
  "Placeholder category for this quarter. Issuers publish a new calendar each year, so confirm the live categories with the issuer before trusting this.";

const rotatingQuarters: {
  quarter: 1 | 2 | 3 | 4;
  categories: MerchantCategory[];
  label: string;
}[] = [
  { quarter: 1, categories: ["grocery", "drugstore"], label: "groceries and drugstores" },
  { quarter: 2, categories: ["gas", "home_improvement"], label: "gas and home improvement" },
  { quarter: 3, categories: ["restaurant", "entertainment"], label: "restaurants and entertainment" },
  { quarter: 4, categories: ["online_retail", "department_store"], label: "online and department stores" }
];

/** Builds the four quarterly 5% rules for a rotating-category card. */
const rotatingRules = (cardId: string, capAmount: number): RewardRule[] =>
  rotatingQuarters.map(({ quarter, categories, label }) => ({
    id: `${cardId}-rotating-q${quarter}`,
    label: `5% on ${label} (Q${quarter} rotating)`,
    categories,
    rate: 0.05,
    conditions: { activeQuarters: [quarter], requiresActivation: true },
    caps: { amount: capAmount, period: "quarter", rateAfterCap: 0.01 },
    note: CONFIRM_CALENDAR
  }));


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
        conditions: { excludesTraits: ["warehouse_club", "superstore"] },
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
        conditions: {
          excludesTraits: ["superstore", "warehouse_club", "specialty_store"]
        },
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
  },
  {
    id: "chase-freedom-flex",
    name: "Chase Freedom Flex",
    shortName: "Freedom Flex",
    network: "Mastercard",
    rewardCurrency: "points",
    rewardUnitValue: 1,
    annualFee: 0,
    foreignTransactionFee: 0.03,
    termsAsOf: TERMS_AS_OF,
    sourceNote:
      "Chase Freedom Flex pricing and terms. Earns Ultimate Rewards points, valued here at the 1 cent cash floor. The 5% rotating categories require activation each quarter and are capped at $1,500 of combined spend per quarter; the quarter-to-category mapping in this file is a placeholder and must be confirmed against Chase's published calendar.",
    rewardRules: [
      ...rotatingRules("chase-freedom-flex", 1500),
      {
        id: "flex-chase-travel",
        label: "5% on travel booked through Chase Travel",
        categories: ["travel", "hotel", "airline"],
        rate: 0.05,
        conditions: { requiresIssuerPortal: true },
        note: "Only applies when the booking goes through the Chase Travel portal."
      },
      {
        id: "flex-dining",
        label: "3% on dining",
        categories: ["restaurant"],
        rate: 0.03
      },
      {
        id: "flex-drugstore",
        label: "3% at drugstores",
        categories: ["drugstore"],
        rate: 0.03
      },
      {
        id: "flex-base",
        label: "1% on everything else",
        rate: 0.01
      }
    ]
  },
  {
    id: "discover-it",
    name: "Discover it Cash Back",
    shortName: "Discover it",
    network: "Discover",
    rewardCurrency: "cash",
    rewardUnitValue: 1,
    annualFee: 0,
    foreignTransactionFee: 0,
    termsAsOf: TERMS_AS_OF,
    sourceNote:
      "Discover it Cash Back terms. The 5% rotating categories require activation each quarter and are capped at $1,500 of spend per quarter, then 1%. Discover's first-year Cashback Match effectively doubles the first year and is deliberately not modelled, because baking it in would overstate the card from year two. The quarter-to-category mapping in this file is a placeholder and must be confirmed against Discover's published calendar.",
    rewardRules: [
      ...rotatingRules("discover-it", 1500),
      {
        id: "discover-base",
        label: "1% on everything else",
        rate: 0.01
      }
    ]
  }
];
