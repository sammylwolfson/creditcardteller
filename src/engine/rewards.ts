import {
  ActivationLedger,
  Card,
  CardScore,
  DecisionInput,
  Recommendation,
  RewardRule,
  ScoreFactor,
  SpendLedger,
  UserOverride
} from "../types/domain";
import { isActivated, quarterOf, remainingCap } from "./spend";

/**
 * The recommendation engine.
 *
 * Two properties matter more than cleverness here:
 * 1. Every number the UI shows can be traced to a rule and a list of factors.
 * 2. Cards are compared on *cash-equivalent* rate, not headline rate, so point
 *    valuation, category caps and foreign transaction fees all land in the
 *    same unit before anything is ranked.
 */

/** Rates are fractions; treat sub-0.01pt differences as equal. */
const EPSILON = 1e-6;

const round = (value: number): number => Math.round(value * 1e6) / 1e6;

export const formatRate = (rate: number): string => {
  const pct = Math.round(rate * 10000) / 100;
  return `${pct}%`;
};

export const formatMoney = (value: number): string => {
  const abs = Math.abs(value);
  const rounded = Math.round(abs * 100) / 100;
  const whole = Math.floor(rounded);
  const cents = Math.round((rounded - whole) * 100);
  const grouped = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = cents === 0 ? grouped : `${grouped}.${String(cents).padStart(2, "0")}`;
  return `${value < 0 ? "-" : ""}$${body}`;
};

/** Renders a rate *difference*, which is measured in points, not percent. */
export const formatPoints = (delta: number): string => {
  const points = Math.round(delta * 10000) / 100;
  return `${points} ${Math.abs(points) === 1 ? "point" : "points"}`;
};

/** merchant-specific rules beat category rules beat the catch-all. */
const specificity = (rule: RewardRule): number => {
  if (rule.merchantIds?.length) {
    return 3;
  }
  if (rule.categories?.length) {
    return 2;
  }
  return 1;
};

const ruleApplies = (rule: RewardRule, input: DecisionInput, now: Date): boolean => {
  if (rule.merchantIds?.length && !rule.merchantIds.includes(input.merchant.id)) {
    return false;
  }

  if (rule.categories?.length && !rule.categories.includes(input.merchant.category)) {
    return false;
  }

  const conditions = rule.conditions;
  if (conditions) {
    if (conditions.channel && !conditions.channel.includes(input.channel)) {
      return false;
    }
    if (conditions.paymentMethod && !conditions.paymentMethod.includes(input.paymentMethod)) {
      return false;
    }
    if (conditions.requiresIssuerPortal && !input.viaIssuerPortal) {
      return false;
    }
    // Out-of-season rotating categories are not "this rule at a lower rate",
    // they simply are not in play; the card falls through to its other rules.
    if (conditions.activeQuarters && !conditions.activeQuarters.includes(quarterOf(now))) {
      return false;
    }
  }

  return true;
};

/** The card's catch-all rate, used when a capped rule runs out of headroom. */
const baseRateFor = (card: Card): number => {
  const catchAll = card.rewardRules.filter((rule) => specificity(rule) === 1);
  return catchAll.reduce((best, rule) => Math.max(best, rule.rate), 0);
};

interface AdjustedRule {
  rule: RewardRule;
  /** Rate after cap headroom is taken into account. */
  rate: number;
  factors: ScoreFactor[];
  caveats: string[];
}

/**
 * Applies cap logic to a single rule.
 *
 * When a purchase amount is known and only part of it fits under the cap, the
 * rate is blended across the two tiers so the estimate stays honest.
 */
const adjustRule = (
  card: Card,
  rule: RewardRule,
  input: DecisionInput,
  ledger: SpendLedger,
  activations: ActivationLedger,
  now: Date
): AdjustedRule => {
  const factors: ScoreFactor[] = [
    { label: rule.label, detail: `Base earn rate ${formatRate(rule.rate)}`, deltaRate: rule.rate }
  ];
  const caveats: string[] = rule.note ? [rule.note] : [];

  // A rotating category the cardholder has not activated pays the card's base
  // rate. Surfacing that as a factor turns a silent loss into an action.
  if (rule.conditions?.requiresActivation && !isActivated(activations, rule.id, now)) {
    const unactivatedRate = baseRateFor(card);
    factors.push({
      label: "Not activated this quarter",
      detail: `This quarter's bonus has to be activated with the issuer. Until you do, it earns the card's base ${formatRate(unactivatedRate)} instead of ${formatRate(rule.rate)}.`,
      deltaRate: round(unactivatedRate - rule.rate)
    });
    // The cap belongs to the bonus rate, so it is irrelevant at base rate.
    return { rule, rate: unactivatedRate, factors, caveats };
  }

  if (!rule.caps) {
    return { rule, rate: rule.rate, factors, caveats };
  }

  const fallbackRate = rule.caps.rateAfterCap ?? baseRateFor(card);
  const left = remainingCap(ledger, rule.id, rule.caps, now);
  const capLabel = `${formatMoney(rule.caps.amount)} per ${rule.caps.period}`;

  if (left <= 0) {
    factors.push({
      label: "Category cap reached",
      detail: `You have logged the full ${capLabel} at this rate, so it drops to ${formatRate(fallbackRate)}.`,
      deltaRate: round(fallbackRate - rule.rate)
    });
    return { rule, rate: fallbackRate, factors, caveats };
  }

  const amount = input.amount;
  if (amount && amount > left) {
    const blended = (left * rule.rate + (amount - left) * fallbackRate) / amount;
    factors.push({
      label: "Partially over the cap",
      detail: `${formatMoney(left)} of the ${capLabel} cap is left, so ${formatMoney(
        amount - left
      )} of this purchase earns ${formatRate(fallbackRate)}.`,
      deltaRate: round(blended - rule.rate)
    });
    return { rule, rate: round(blended), factors, caveats };
  }

  factors.push({
    label: "Cap headroom",
    detail: `${formatMoney(left)} of the ${capLabel} cap is still available.`
  });
  return { rule, rate: rule.rate, factors, caveats };
};

const pickBestRule = (
  card: Card,
  input: DecisionInput,
  ledger: SpendLedger,
  activations: ActivationLedger,
  now: Date
): AdjustedRule | null => {
  const applicable = card.rewardRules.filter((rule) => ruleApplies(rule, input, now));
  if (applicable.length === 0) {
    return null;
  }

  const adjusted = applicable.map((rule) =>
    adjustRule(card, rule, input, ledger, activations, now)
  );

  // Highest post-cap rate wins. Specificity is only a tiebreaker, so a 6%
  // category rule is never shadowed by a 1% merchant-specific rule.
  adjusted.sort((a, b) => {
    const byRate = b.rate - a.rate;
    if (Math.abs(byRate) > EPSILON) {
      return byRate;
    }
    return specificity(b.rule) - specificity(a.rule);
  });

  return adjusted[0] ?? null;
};

export interface ScoreContext {
  ledger?: SpendLedger;
  activations?: ActivationLedger;
  /** Amortise the annual fee across a year of spend, see AppSettings. */
  amortiseAnnualFees?: boolean;
  assumedAnnualSpend?: number;
  now?: Date;
}

export const scoreCard = (
  card: Card,
  input: DecisionInput,
  context: ScoreContext = {}
): CardScore => {
  const ledger = context.ledger ?? {};
  const activations = context.activations ?? {};
  const now = context.now ?? new Date();
  const base = {
    cardId: card.id,
    cardName: card.name,
    cardShortName: card.shortName
  };

  const accepted = input.merchant.acceptedNetworks;
  if (accepted && !accepted.includes(card.network)) {
    return {
      ...base,
      eligible: false,
      ineligibleReason: `${input.merchant.name} only accepts ${accepted.join(", ")}, not ${card.network}.`,
      nominalRate: 0,
      effectiveRate: 0,
      headline: "Not accepted here",
      factors: [],
      caveats: []
    };
  }

  const picked = pickBestRule(card, input, ledger, activations, now);
  if (!picked) {
    return {
      ...base,
      eligible: false,
      ineligibleReason: `No reward rule on ${card.name} covers a ${input.channel === "online" ? "online" : "in-store"} purchase paid by ${paymentMethodLabel(input.paymentMethod)}.`,
      nominalRate: 0,
      effectiveRate: 0,
      headline: "No matching rule",
      factors: [],
      caveats: []
    };
  }

  const factors = [...picked.factors];
  const caveats = [...picked.caveats];
  let effective = picked.rate;

  if (card.rewardUnitValue !== 1) {
    const adjusted = round(effective * card.rewardUnitValue);
    factors.push({
      label: "Point valuation",
      detail: `Valued at ${card.rewardUnitValue.toFixed(2)}x cash, giving ${formatRate(adjusted)} in cash-equivalent value.`,
      deltaRate: round(adjusted - effective)
    });
    effective = adjusted;
  } else if (card.rewardCurrency !== "cash") {
    caveats.push(
      `Earns ${card.rewardCurrency}, valued here at the 1 cent cash-redemption floor. Raise the point value on the card if you transfer them out.`
    );
  }

  if (input.isForeignTransaction && card.foreignTransactionFee > 0) {
    const adjusted = round(effective - card.foreignTransactionFee);
    factors.push({
      label: "Foreign transaction fee",
      detail: `${formatRate(card.foreignTransactionFee)} fee on foreign purchases wipes out most of the earn.`,
      deltaRate: round(-card.foreignTransactionFee)
    });
    effective = adjusted;
  }

  if (card.annualFee > 0) {
    const spend = context.assumedAnnualSpend ?? 0;
    if (context.amortiseAnnualFees && spend > 0) {
      const perDollar = round(card.annualFee / spend);
      const adjusted = round(effective - perDollar);
      factors.push({
        label: "Annual fee, amortised",
        detail: `${formatMoney(card.annualFee)} a year spread across ${formatMoney(spend)} of assumed spend costs ${formatRate(perDollar)} on every purchase.`,
        deltaRate: round(-perDollar)
      });
      effective = adjusted;
    } else {
      caveats.push(
        `${formatMoney(card.annualFee)} annual fee is not amortised into this rate.`
      );
    }
  }

  const estimatedValue =
    input.amount != null && Number.isFinite(input.amount)
      ? round(input.amount * effective)
      : undefined;

  return {
    ...base,
    eligible: true,
    nominalRate: picked.rule.rate,
    effectiveRate: round(effective),
    ...(estimatedValue != null ? { estimatedValue } : {}),
    appliedRuleId: picked.rule.id,
    headline: picked.rule.label,
    factors,
    caveats
  };
};

export const paymentMethodLabel = (method: DecisionInput["paymentMethod"]): string => {
  switch (method) {
    case "apple_pay":
      return "Apple Pay";
    case "physical_card":
      return "physical card";
    case "online_checkout":
      return "online checkout";
  }
};

export interface NormalizedInput {
  input: DecisionInput;
  /** Notes about adjustments made to the requested input. */
  adjustments: string[];
}

/**
 * Fixes impossible inputs before scoring.
 *
 * Asking for Apple Pay at a merchant that does not take it used to silently
 * knock out every Apple Pay rule, which made the Apple Card look worse than it
 * is. Instead the input falls back to the payment method the user would
 * actually use, and the UI says so.
 */
export const normalizeInput = (input: DecisionInput): NormalizedInput => {
  const adjustments: string[] = [];
  let next = input;

  if (input.paymentMethod === "apple_pay" && input.merchant.supportsApplePay === false) {
    const fallback = input.channel === "online" ? "online_checkout" : "physical_card";
    adjustments.push(
      `${input.merchant.name} does not take Apple Pay, so this assumes you tap or type the card instead.`
    );
    next = { ...next, paymentMethod: fallback };
  }

  if (input.channel === "online" && next.paymentMethod === "physical_card") {
    adjustments.push("Treating a physical card online as a manual checkout entry.");
    next = { ...next, paymentMethod: "online_checkout" };
  }

  if (input.channel === "in_store" && next.paymentMethod === "online_checkout") {
    adjustments.push("Treating an online checkout in store as a physical card swipe.");
    next = { ...next, paymentMethod: "physical_card" };
  }

  return { input: next, adjustments };
};

export interface RecommendOptions {
  overrides?: UserOverride[];
  ledger?: SpendLedger;
  /** Quarters the user has activated for rotating bonus categories. */
  activations?: ActivationLedger;
  amortiseAnnualFees?: boolean;
  assumedAnnualSpend?: number;
  now?: Date;
}

const buildSummary = (
  winner: CardScore | null,
  runnerUp: CardScore | null,
  merchantName: string,
  isTie: boolean,
  overrideCardId: string | undefined,
  amount: number | undefined
): string => {
  if (!winner) {
    return `No card in your wallet can be used at ${merchantName}.`;
  }

  // Lead with the effective rate, because it is the number being compared and
  // it can differ from the rule's headline once caps and fees are applied.
  const rate = formatRate(winner.effectiveRate);
  const value =
    amount != null && winner.estimatedValue != null
      ? ` (${formatMoney(winner.estimatedValue)} back on ${formatMoney(amount)})`
      : "";
  const under = `under "${winner.headline}"`;

  if (overrideCardId) {
    return `Using your saved choice of ${winner.cardShortName} at ${merchantName}: ${rate}${value} ${under}.`;
  }

  if (isTie && runnerUp) {
    return `${winner.cardShortName} and ${runnerUp.cardShortName} both earn ${rate} at ${merchantName}${value}. Either is fine.`;
  }

  if (!runnerUp) {
    return `${winner.cardShortName} earns ${rate} at ${merchantName}${value} ${under}. It is the only card you can use here.`;
  }

  const delta = round(winner.effectiveRate - runnerUp.effectiveRate);
  const deltaValue =
    amount != null ? `, worth ${formatMoney(amount * delta)} more here` : "";

  return `${winner.cardShortName} earns ${rate} at ${merchantName}${value} ${under}. That beats ${runnerUp.cardShortName} at ${formatRate(runnerUp.effectiveRate)} by ${formatPoints(delta)}${deltaValue}.`;
};

export const recommend = (
  cards: Card[],
  rawInput: DecisionInput,
  options: RecommendOptions = {}
): Recommendation & { adjustments: string[] } => {
  const now = options.now ?? new Date();
  const { input, adjustments } = normalizeInput(rawInput);
  const context: ScoreContext = {
    ledger: options.ledger ?? {},
    activations: options.activations ?? {},
    ...(options.amortiseAnnualFees != null
      ? { amortiseAnnualFees: options.amortiseAnnualFees }
      : {}),
    ...(options.assumedAnnualSpend != null
      ? { assumedAnnualSpend: options.assumedAnnualSpend }
      : {}),
    now
  };

  const scored = cards.map((card) => scoreCard(card, input, context));

  const eligible = scored
    .filter((score) => score.eligible)
    .sort((a, b) => {
      const byRate = b.effectiveRate - a.effectiveRate;
      if (Math.abs(byRate) > EPSILON) {
        return byRate;
      }
      // On a genuine tie prefer the card that costs less to hold.
      const feeA = cards.find((card) => card.id === a.cardId)?.annualFee ?? 0;
      const feeB = cards.find((card) => card.id === b.cardId)?.annualFee ?? 0;
      return feeA - feeB;
    });

  const ranked = [...eligible, ...scored.filter((score) => !score.eligible)];
  const top = eligible[0] ?? null;
  const second = eligible[1] ?? null;

  const override = options.overrides?.find((item) => item.merchantId === input.merchant.id);
  const overrideScore = override
    ? eligible.find((score) => score.cardId === override.cardId)
    : undefined;

  const winner = overrideScore ?? top;
  const runnerUp = winner && second && winner.cardId === second.cardId ? top : second;

  const delta =
    winner && runnerUp ? round(winner.effectiveRate - runnerUp.effectiveRate) : winner ? winner.effectiveRate : 0;
  const isTie = Boolean(winner && runnerUp) && Math.abs(delta) <= EPSILON;

  if (override && !overrideScore) {
    adjustments.push(
      "Your saved card for this merchant cannot be used here, so the engine picked the next best option."
    );
  }

  const { merchant, ...inputWithoutMerchant } = input;

  return {
    merchantId: merchant.id,
    input: inputWithoutMerchant,
    winner,
    runnerUp,
    ranked,
    deltaVsRunnerUp: delta,
    ...(input.amount != null ? { dollarDeltaVsRunnerUp: round(input.amount * delta) } : {}),
    isTie,
    ...(overrideScore && top
      ? { overrideApplied: { cardId: overrideScore.cardId, defaultBestCardId: top.cardId } }
      : {}),
    summary: buildSummary(
      winner,
      runnerUp,
      merchant.name,
      isTie,
      overrideScore?.cardId,
      input.amount
    ),
    timestamp: now.getTime(),
    adjustments
  };
};
