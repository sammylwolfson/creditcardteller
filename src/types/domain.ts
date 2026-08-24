/**
 * Domain model for Credit Card Teller.
 *
 * Design notes:
 * - Everything here is local-first and serialisable to JSON so it can round-trip
 *   through AsyncStorage without a backend.
 * - Reward rules are declarative so the engine can *explain* a decision by
 *   pointing at the rule it used rather than at an opaque score.
 */

export type MerchantCategory =
  | "grocery"
  | "wholesale_club"
  | "restaurant"
  | "gas"
  | "transit"
  | "travel"
  | "hotel"
  | "airline"
  | "drugstore"
  | "streaming"
  | "online_retail"
  | "department_store"
  | "entertainment"
  | "home_improvement"
  | "other";

export const merchantCategories: MerchantCategory[] = [
  "grocery",
  "wholesale_club",
  "restaurant",
  "gas",
  "transit",
  "travel",
  "hotel",
  "airline",
  "drugstore",
  "streaming",
  "online_retail",
  "department_store",
  "entertainment",
  "home_improvement",
  "other"
];

export const categoryLabels: Record<MerchantCategory, string> = {
  grocery: "Groceries",
  wholesale_club: "Wholesale club",
  restaurant: "Restaurants",
  gas: "Gas",
  transit: "Transit",
  travel: "Travel",
  hotel: "Hotels",
  airline: "Airlines",
  drugstore: "Drugstores",
  streaming: "Streaming",
  online_retail: "Online retail",
  department_store: "Department stores",
  entertainment: "Entertainment",
  home_improvement: "Home improvement",
  other: "Everything else"
};

export type PurchaseChannel = "in_store" | "online";

export type PaymentMethod = "apple_pay" | "physical_card" | "online_checkout";

export type CardNetwork = "Visa" | "Mastercard" | "American Express" | "Discover" | "Other";

/** What a card pays out in. Used to convert a headline rate into cash value. */
export type RewardCurrency = "cash" | "points" | "miles";

/** Calendar quarter, 1-indexed. Q1 = Jan-Mar. */
export type Quarter = 1 | 2 | 3 | 4;

export interface RuleCondition {
  channel?: PurchaseChannel[];
  paymentMethod?: PaymentMethod[];
  /** Rule only applies to purchases booked through the issuer's own portal. */
  requiresIssuerPortal?: boolean;
  /**
   * Quarters this rule is live in, for rotating bonus categories like Chase
   * Freedom Flex and Discover it. Outside these quarters the rule does not
   * apply at all; the card falls through to its other rules.
   */
  activeQuarters?: Quarter[];
  /**
   * The issuer requires the cardholder to activate the quarter before the
   * bonus rate applies. An unactivated quarter earns the card's base rate,
   * which the engine reports as a missed opportunity rather than hiding.
   */
  requiresActivation?: boolean;
}

export interface RewardCap {
  /** Spend ceiling the elevated rate applies to, in dollars. */
  amount: number;
  period: "month" | "quarter" | "year";
  /** Rate earned on spend past the cap. Defaults to the card's base rule rate. */
  rateAfterCap?: number;
}

export interface RewardRule {
  id: string;
  /** Human-readable headline, e.g. "6% at US supermarkets". */
  label: string;
  /** Applies when the merchant is in this category. */
  categories?: MerchantCategory[];
  /** Applies only at these specific merchants (wins over category rules of equal value). */
  merchantIds?: string[];
  /** Nominal earn rate as a fraction, e.g. 0.06 for 6%. */
  rate: number;
  conditions?: RuleCondition;
  caps?: RewardCap;
  /** Extra context shown to the user, e.g. exclusions the engine cannot model. */
  note?: string;
}

export interface Card {
  id: string;
  name: string;
  /** Short name for tight UI spots. */
  shortName: string;
  network: CardNetwork;
  rewardCurrency: RewardCurrency;
  /**
   * Cash value of one reward unit relative to $1 of cash back.
   * 1 = plain cash back. Points cards default to 1 (cash redemption) so the
   * app never overstates a card; the user can raise it if they transfer out.
   */
  rewardUnitValue: number;
  annualFee: number;
  /** Fraction charged on foreign purchases, e.g. 0.03. */
  foreignTransactionFee: number;
  rewardRules: RewardRule[];
  /** Month the rates were last checked, e.g. "2026-08". */
  termsAsOf?: string;
  /** Where the numbers came from, so the user can re-verify. */
  sourceNote?: string;
  /** True for cards the user typed in themselves. */
  isCustom?: boolean;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface Merchant {
  id: string;
  name: string;
  category: MerchantCategory;
  /** Alternate names, POS descriptors and abbreviations used for matching. */
  aliases?: string[];
  /** Checkout domains used to match online purchases. */
  domains?: string[];
  /**
   * Networks the merchant accepts. Omit when it takes everything.
   * Costco famously only takes Visa, which changes the answer entirely.
   */
  acceptedNetworks?: CardNetwork[];
  supportsApplePay?: boolean;
  /** Set by the user by pinning a store; required for geofencing. */
  location?: GeoPoint;
  radiusMeters?: number;
  /** True for merchants the user created rather than seeded ones. */
  isCustom?: boolean;
}

export interface DecisionInput {
  merchant: Merchant;
  channel: PurchaseChannel;
  paymentMethod: PaymentMethod;
  /** Optional purchase amount; enables dollar estimates and cap blending. */
  amount?: number;
  isForeignTransaction?: boolean;
  /** Purchase booked through the card issuer's travel portal. */
  viaIssuerPortal?: boolean;
}

/** One step of the arithmetic that produced a card's effective rate. */
export interface ScoreFactor {
  label: string;
  detail: string;
  /** Change to the effective rate contributed by this step, if any. */
  deltaRate?: number;
}

export interface CardScore {
  cardId: string;
  cardName: string;
  cardShortName: string;
  eligible: boolean;
  /** Populated when eligible is false, e.g. "Costco only accepts Visa". */
  ineligibleReason?: string;
  /** Headline rate of the winning rule before adjustments. */
  nominalRate: number;
  /** Cash-equivalent rate after caps, point value and foreign fees. */
  effectiveRate: number;
  /** Dollar value when an amount was supplied. */
  estimatedValue?: number;
  appliedRuleId?: string;
  /** One-line summary, e.g. "6% at US supermarkets". */
  headline: string;
  factors: ScoreFactor[];
  /** Things the engine cannot fully model but the user should know. */
  caveats: string[];
}

export type MatchConfidence = "high" | "medium" | "low" | "ambiguous";

export interface MerchantMatch {
  merchant: Merchant;
  /** 0-1 similarity of the query to this merchant. */
  score: number;
  /** Which signal produced the match, e.g. "domain" or "alias". */
  via: "id" | "domain" | "name" | "alias" | "learned" | "token" | "fuzzy";
}

export interface MerchantMatchResult {
  query: string;
  confidence: MatchConfidence;
  best: MerchantMatch | null;
  /** Ranked alternatives to offer when confidence is not high. */
  candidates: MerchantMatch[];
  /** Plain-English explanation of the confidence level. */
  explanation: string;
  /** True when the UI should ask the user to confirm before acting. */
  needsConfirmation: boolean;
}

export interface Recommendation {
  merchantId: string;
  input: Omit<DecisionInput, "merchant">;
  winner: CardScore | null;
  runnerUp: CardScore | null;
  ranked: CardScore[];
  /** Effective-rate gap between winner and runner-up. */
  deltaVsRunnerUp: number;
  /** Dollar gap when an amount was supplied. */
  dollarDeltaVsRunnerUp?: number;
  isTie: boolean;
  overrideApplied?: {
    cardId: string;
    /** What the engine would have picked without the override. */
    defaultBestCardId: string;
  };
  summary: string;
  timestamp: number;
}

export interface LoggedDecision {
  id: string;
  merchantId: string;
  cardId: string;
  effectiveRate: number;
  amount?: number;
  summary: string;
  timestamp: number;
  accepted: boolean;
  source: "manual" | "geofence";
}

export interface UserOverride {
  merchantId: string;
  cardId: string;
  createdAt: number;
}

/** Spend recorded against capped rules: ruleId -> periodKey -> dollars. */
export type SpendLedger = Record<string, Record<string, number>>;

/**
 * Quarters the user has activated with the issuer: ruleId -> period keys.
 *
 * Rotating 5% categories pay the base rate until the cardholder activates,
 * and activation is per quarter, so this has to be tracked per period rather
 * than as a single boolean.
 */
export type ActivationLedger = Record<string, string[]>;

export interface AppSettings {
  /**
   * Spread each card's annual fee across an assumed year of spend and subtract
   * it from every rate. Off by default: at the single-purchase level a fee card
   * otherwise looks better than it is, but the amortised view is only as good
   * as the spend estimate below.
   */
  amortiseAnnualFees: boolean;
  /** Annual spend assumed when amortising fees, in dollars. */
  assumedAnnualSpend: number;
  /** Minimum effective-rate win required to fire a nudge, e.g. 0.01 = 1pt. */
  nudgeDeltaThreshold: number;
  /** Hour of day (0-23) quiet hours begin. */
  quietHoursStart: number;
  /** Hour of day (0-23) quiet hours end. */
  quietHoursEnd: number;
  /** Minimum minutes between any two nudges. */
  globalCooldownMinutes: number;
  /** Minimum minutes between nudges for the same store. */
  perMerchantCooldownMinutes: number;
  /** Payment method assumed when a geofence fires and nobody is watching. */
  defaultPaymentMethod: PaymentMethod;
  geofenceEnabled: boolean;
}

/** Persisted anti-spam state; survives background wake-ups. */
export interface NudgeState {
  lastNudgeAt: number;
  lastNudgeByMerchant: Record<string, number>;
}

export interface NudgeDecision {
  allow: boolean;
  /** Machine-readable reason, useful in tests and the debug panel. */
  reason:
    | "ok"
    | "disabled"
    | "below_threshold"
    | "tie"
    | "quiet_hours"
    | "global_cooldown"
    | "merchant_cooldown"
    | "no_winner";
  /** Same thing in plain English for the UI. */
  explanation: string;
}
