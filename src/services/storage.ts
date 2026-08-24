import AsyncStorage from "@react-native-async-storage/async-storage";

import { seedCards } from "../data/cards";
import { seedMerchants, seedSettings } from "../data/merchants";
import {
  ActivationLedger,
  AppSettings,
  Card,
  LoggedDecision,
  Merchant,
  NudgeState,
  SpendLedger,
  UserOverride
} from "../types/domain";
import { emptyNudgeState } from "./nudgePolicy";
import {
  isActivationLedger,
  isAliasMap,
  isCardArray,
  isDecisionArray,
  isLedger,
  isMerchantArray,
  isNudgeState,
  isOverrideArray,
  isSettings,
  isStringArray
} from "./schema";

export * from "./schema";

/**
 * Local-first persistence.
 *
 * Keys are version-prefixed. The card and merchant shapes changed when the
 * engine learned about caps, networks and point values, and silently feeding
 * v1 records to the v2 engine would produce confidently wrong recommendations.
 * A new prefix means old data is ignored rather than misread.
 */
export const STORAGE_VERSION = 2;

const key = (name: string): string => `cct.v${STORAGE_VERSION}.${name}`;

export const storageKeys = {
  cards: key("cards"),
  wallet: key("wallet"),
  merchants: key("merchants"),
  favorites: key("favorites"),
  decisions: key("decisions"),
  overrides: key("overrides"),
  settings: key("settings"),
  ledger: key("ledger"),
  activations: key("activations"),
  learnedAliases: key("learnedAliases"),
  nudgeState: key("nudgeState")
};

export type Validator<T> = (value: unknown) => value is T;

/**
 * Reads JSON, returning null when the record is missing, corrupt, or fails the
 * caller's shape check. Callers always have a seed to fall back to.
 */
export const loadJson = async <T>(
  storageKey: string,
  validate?: Validator<T>
): Promise<T | null> => {
  try {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (validate && !validate(parsed)) {
      return null;
    }
    return parsed as T;
  } catch {
    return null;
  }
};

export const saveJson = async <T>(storageKey: string, value: T): Promise<void> => {
  try {
    await AsyncStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    // Storage failures must never break a recommendation; state stays in memory.
  }
};

export const clearAll = async (): Promise<void> => {
  await AsyncStorage.multiRemove(Object.values(storageKeys));
};

/**
 * Everything the recommendation engine needs, with seeds filled in.
 *
 * The background geofence task uses this: when iOS relaunches the app for a
 * region event there is no React state to read from, so it rebuilds the world
 * from storage.
 */
export interface Snapshot {
  /** Every card definition the app knows about, seeded plus user-created. */
  cards: Card[];
  /**
   * Ids of the cards the user actually holds, or null if they have not chosen
   * yet. Only these are scored — recommending a card someone does not own is
   * worse than no recommendation at all.
   */
  walletCardIds: string[] | null;
  merchants: Merchant[];
  favorites: string[];
  overrides: UserOverride[];
  settings: AppSettings;
  ledger: SpendLedger;
  /** Rotating bonus quarters the user has activated with the issuer. */
  activations: ActivationLedger;
  learnedAliases: Record<string, string>;
  decisions: LoggedDecision[];
  nudgeState: NudgeState;
}

export const loadSnapshot = async (): Promise<Snapshot> => {
  const [
    cards,
    walletCardIds,
    merchants,
    favorites,
    overrides,
    settings,
    ledger,
    activations,
    learnedAliases,
    decisions,
    nudgeState
  ] = await Promise.all([
    loadJson<Card[]>(storageKeys.cards, isCardArray),
    loadJson<string[]>(storageKeys.wallet, isStringArray),
    loadJson<Merchant[]>(storageKeys.merchants, isMerchantArray),
    loadJson<string[]>(storageKeys.favorites, isStringArray),
    loadJson<UserOverride[]>(storageKeys.overrides, isOverrideArray),
    loadJson<AppSettings>(storageKeys.settings, isSettings),
    loadJson<SpendLedger>(storageKeys.ledger, isLedger),
    loadJson<ActivationLedger>(storageKeys.activations, isActivationLedger),
    loadJson<Record<string, string>>(storageKeys.learnedAliases, isAliasMap),
    loadJson<LoggedDecision[]>(storageKeys.decisions, isDecisionArray),
    loadJson<NudgeState>(storageKeys.nudgeState, isNudgeState)
  ]);

  return {
    cards: cards?.length ? cards : seedCards,
    walletCardIds,
    merchants: merchants?.length ? merchants : seedMerchants,
    favorites: favorites ?? [],
    overrides: overrides ?? [],
    settings: { ...seedSettings, ...(settings ?? {}) },
    ledger: ledger ?? {},
    activations: activations ?? {},
    learnedAliases: learnedAliases ?? {},
    decisions: decisions ?? [],
    nudgeState: nudgeState ?? emptyNudgeState
  };
};

/**
 * The cards a recommendation should actually consider.
 *
 * Falls back to the whole catalogue only when the user has not picked a wallet
 * yet, which the UI treats as "not onboarded".
 */
export const walletCards = (snapshot: Snapshot): Card[] => {
  if (!snapshot.walletCardIds) {
    return snapshot.cards;
  }
  const chosen = new Set(snapshot.walletCardIds);
  return snapshot.cards.filter((card) => chosen.has(card.id));
};
