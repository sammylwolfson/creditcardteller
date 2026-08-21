import AsyncStorage from "@react-native-async-storage/async-storage";

import { seedCards } from "../data/cards";
import { seedMerchants, seedSettings } from "../data/merchants";
import {
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
  merchants: key("merchants"),
  favorites: key("favorites"),
  decisions: key("decisions"),
  overrides: key("overrides"),
  settings: key("settings"),
  ledger: key("ledger"),
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
  cards: Card[];
  merchants: Merchant[];
  favorites: string[];
  overrides: UserOverride[];
  settings: AppSettings;
  ledger: SpendLedger;
  learnedAliases: Record<string, string>;
  decisions: LoggedDecision[];
  nudgeState: NudgeState;
}

export const loadSnapshot = async (): Promise<Snapshot> => {
  const [
    cards,
    merchants,
    favorites,
    overrides,
    settings,
    ledger,
    learnedAliases,
    decisions,
    nudgeState
  ] = await Promise.all([
    loadJson<Card[]>(storageKeys.cards, isCardArray),
    loadJson<Merchant[]>(storageKeys.merchants, isMerchantArray),
    loadJson<string[]>(storageKeys.favorites, isStringArray),
    loadJson<UserOverride[]>(storageKeys.overrides, isOverrideArray),
    loadJson<AppSettings>(storageKeys.settings, isSettings),
    loadJson<SpendLedger>(storageKeys.ledger, isLedger),
    loadJson<Record<string, string>>(storageKeys.learnedAliases, isAliasMap),
    loadJson<LoggedDecision[]>(storageKeys.decisions, isDecisionArray),
    loadJson<NudgeState>(storageKeys.nudgeState, isNudgeState)
  ]);

  return {
    cards: cards?.length ? cards : seedCards,
    merchants: merchants?.length ? merchants : seedMerchants,
    favorites: favorites ?? [],
    overrides: overrides ?? [],
    settings: { ...seedSettings, ...(settings ?? {}) },
    ledger: ledger ?? {},
    learnedAliases: learnedAliases ?? {},
    decisions: decisions ?? [],
    nudgeState: nudgeState ?? emptyNudgeState
  };
};
