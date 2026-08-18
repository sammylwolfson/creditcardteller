export type MerchantCategory =
  | "grocery"
  | "restaurant"
  | "travel"
  | "warehouse"
  | "general"
  | "online";

export type PurchaseChannel = "in_store" | "online";

export type PaymentMethod = "apple_pay" | "physical_card" | "online_checkout";

export interface RuleCondition {
  channel?: PurchaseChannel[];
  paymentMethod?: PaymentMethod[];
}

export interface RewardRule {
  id: string;
  category?: MerchantCategory;
  merchantId?: string;
  rate: number;
  conditions?: RuleCondition;
  caps?: {
    amount?: number;
    period?: "month" | "year";
  };
  note?: string;
}

export interface Card {
  id: string;
  name: string;
  network: string;
  rewardRules: RewardRule[];
}

export interface Merchant {
  id: string;
  name: string;
  category: MerchantCategory;
  latitude?: number;
  longitude?: number;
  radiusMeters?: number;
  supportsApplePay?: boolean;
}

export interface DecisionInput {
  merchant: Merchant;
  channel: PurchaseChannel;
  paymentMethod: PaymentMethod;
  amount?: number;
}

export interface CardScore {
  cardId: string;
  cardName: string;
  rate: number;
  reason: string;
}

export interface Decision {
  merchantId: string;
  bestCardId: string;
  rate: number;
  reason: string;
  timestamp: number;
  accepted?: boolean;
}

export interface UserOverride {
  merchantId: string;
  cardId: string;
}

export interface AppSettings {
  nudgeDeltaThreshold: number;
  quietHoursStart: number;
  quietHoursEnd: number;
}
