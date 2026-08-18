import {
  Card,
  CardScore,
  Decision,
  DecisionInput,
  RewardRule,
  UserOverride
} from "../types/domain";

const pct = (rate: number): string => `${Math.round(rate * 1000) / 10}%`;

const ruleMatches = (rule: RewardRule, input: DecisionInput): boolean => {
  if (rule.merchantId && rule.merchantId !== input.merchant.id) {
    return false;
  }

  if (rule.category && rule.category !== input.merchant.category) {
    return false;
  }

  if (rule.conditions?.channel && !rule.conditions.channel.includes(input.channel)) {
    return false;
  }

  if (
    rule.conditions?.paymentMethod &&
    !rule.conditions.paymentMethod.includes(input.paymentMethod)
  ) {
    return false;
  }

  if (
    input.paymentMethod === "apple_pay" &&
    input.channel === "in_store" &&
    input.merchant.supportsApplePay === false
  ) {
    return false;
  }

  return true;
};

const rankRule = (rule: RewardRule): number => {
  if (rule.merchantId) {
    return 3;
  }
  if (rule.category) {
    return 2;
  }
  return 1;
};

const bestRuleForCard = (card: Card, input: DecisionInput): RewardRule | undefined => {
  const matches = card.rewardRules.filter((rule) => ruleMatches(rule, input));
  if (matches.length === 0) {
    return undefined;
  }

  return matches.sort((a, b) => {
    const specificity = rankRule(b) - rankRule(a);
    if (specificity !== 0) {
      return specificity;
    }
    return b.rate - a.rate;
  })[0];
};

export const scoreCards = (cards: Card[], input: DecisionInput): CardScore[] => {
  return cards
    .map((card) => {
      const rule = bestRuleForCard(card, input);
      const rate = rule?.rate ?? 0;
      return {
        cardId: card.id,
        cardName: card.name,
        rate,
        reason:
          rule?.note ??
          `No matching reward rule for ${input.merchant.name}; fallback assumed at ${pct(rate)}`
      };
    })
    .sort((a, b) => b.rate - a.rate);
};

export const decideBestCard = (
  cards: Card[],
  input: DecisionInput,
  overrides: UserOverride[]
): { decision: Decision; scores: CardScore[]; deltaVsSecond: number } => {
  const scores = scoreCards(cards, input);
  const top = scores[0];
  const runnerUp = scores[1];

  const override = overrides.find((item) => item.merchantId === input.merchant.id);
  const winner =
    override && scores.find((score) => score.cardId === override.cardId)
      ? scores.find((score) => score.cardId === override.cardId)!
      : top;

  const reason = override
    ? `Using your override for ${input.merchant.name}. Default best was ${top.cardName} at ${pct(top.rate)}.`
    : `${winner.cardName} wins: ${winner.reason}${
        runnerUp ? ` (beats ${runnerUp.cardName} at ${pct(runnerUp.rate)})` : ""
      }`;

  return {
    decision: {
      merchantId: input.merchant.id,
      bestCardId: winner.cardId,
      rate: winner.rate,
      reason,
      timestamp: Date.now()
    },
    scores,
    deltaVsSecond: winner.rate - (runnerUp?.rate ?? 0)
  };
};
