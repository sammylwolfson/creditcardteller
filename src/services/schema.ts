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

/**
 * Shape checks for anything read back off the device.
 *
 * Persisted records outlive the code that wrote them. The v1 card shape had no
 * `shortName`, no networks and no point values, so handing a v1 record to the
 * v2 engine would produce a confident answer built on missing fields. These
 * guards make that a cache miss instead: the seed data is used and the user
 * sees correct rates.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isArrayOf = <T>(value: unknown, check: (item: unknown) => boolean): value is T[] =>
  Array.isArray(value) && value.every(check);

export const isCardArray = (value: unknown): value is Card[] =>
  isArrayOf<Card>(
    value,
    (item) =>
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.shortName === "string" &&
      typeof item.rewardUnitValue === "number" &&
      Array.isArray(item.rewardRules)
  );

export const isMerchantArray = (value: unknown): value is Merchant[] =>
  isArrayOf<Merchant>(
    value,
    (item) =>
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.category === "string"
  );

export const isStringArray = (value: unknown): value is string[] =>
  isArrayOf<string>(value, (item) => typeof item === "string");

export const isOverrideArray = (value: unknown): value is UserOverride[] =>
  isArrayOf<UserOverride>(
    value,
    (item) =>
      isRecord(item) && typeof item.merchantId === "string" && typeof item.cardId === "string"
  );

export const isDecisionArray = (value: unknown): value is LoggedDecision[] =>
  isArrayOf<LoggedDecision>(
    value,
    (item) =>
      isRecord(item) &&
      typeof item.merchantId === "string" &&
      typeof item.cardId === "string" &&
      typeof item.timestamp === "number"
  );

export const isSettings = (value: unknown): value is AppSettings =>
  isRecord(value) &&
  typeof value.nudgeDeltaThreshold === "number" &&
  typeof value.quietHoursStart === "number" &&
  typeof value.quietHoursEnd === "number";

export const isNudgeState = (value: unknown): value is NudgeState =>
  isRecord(value) && typeof value.lastNudgeAt === "number";

export const isLedger = (value: unknown): value is SpendLedger => isRecord(value);

export const isAliasMap = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((item) => typeof item === "string");

export const isActivationLedger = (value: unknown): value is ActivationLedger =>
  isRecord(value) &&
  Object.values(value).every(
    (entry) => Array.isArray(entry) && entry.every((key) => typeof key === "string")
  );
