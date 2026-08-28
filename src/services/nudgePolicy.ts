import { AppSettings, NudgeDecision, NudgeState } from "../types/domain";

/**
 * Anti-spam policy for geofence nudges.
 *
 * Kept free of React Native and expo imports so it can be unit tested and so
 * the background task can call it without pulling in the UI. The state it
 * reads is persisted, which matters: the previous in-memory throttle reset
 * every time iOS relaunched the app for a region event, which is exactly when
 * the throttle needed to hold.
 */

export const emptyNudgeState: NudgeState = {
  lastNudgeAt: 0,
  lastNudgeByMerchant: {}
};

export const inQuietHours = (settings: AppSettings, now: Date): boolean => {
  const hour = now.getHours();
  const { quietHoursStart: start, quietHoursEnd: end } = settings;

  if (start === end) {
    return false;
  }
  // Overnight windows wrap past midnight.
  if (start > end) {
    return hour >= start || hour < end;
  }
  return hour >= start && hour < end;
};

export interface NudgeContext {
  merchantId: string;
  /** Effective-rate advantage of the winner over the runner-up. */
  delta: number;
  hasWinner: boolean;
  isTie: boolean;
}

export const evaluateNudge = (
  settings: AppSettings,
  context: NudgeContext,
  state: NudgeState,
  now: Date = new Date()
): NudgeDecision => {
  if (!settings.geofenceEnabled) {
    return {
      allow: false,
      reason: "disabled",
      explanation: "Geofence nudges are turned off."
    };
  }

  if (!context.hasWinner) {
    return {
      allow: false,
      reason: "no_winner",
      explanation: "No usable card for this store, so there is nothing to suggest."
    };
  }

  if (context.isTie) {
    return {
      allow: false,
      reason: "tie",
      explanation: "Your top two cards earn the same here, so a reminder would not help."
    };
  }

  if (context.delta < settings.nudgeDeltaThreshold) {
    return {
      allow: false,
      reason: "below_threshold",
      explanation: `The best card only wins by ${(context.delta * 100).toFixed(2)} points, under your ${(settings.nudgeDeltaThreshold * 100).toFixed(2)} point threshold.`
    };
  }

  if (inQuietHours(settings, now)) {
    return {
      allow: false,
      reason: "quiet_hours",
      explanation: `Quiet hours run ${settings.quietHoursStart}:00 to ${settings.quietHoursEnd}:00.`
    };
  }

  const sinceGlobal = now.getTime() - state.lastNudgeAt;
  if (sinceGlobal < settings.globalCooldownMinutes * 60_000) {
    return {
      allow: false,
      reason: "global_cooldown",
      explanation: `Another nudge went out ${Math.round(sinceGlobal / 60_000)} minutes ago; the cooldown is ${settings.globalCooldownMinutes} minutes.`
    };
  }

  const lastHere = state.lastNudgeByMerchant[context.merchantId] ?? 0;
  const sinceHere = now.getTime() - lastHere;
  if (lastHere > 0 && sinceHere < settings.perMerchantCooldownMinutes * 60_000) {
    return {
      allow: false,
      reason: "merchant_cooldown",
      explanation: `You were already nudged at this store ${Math.round(sinceHere / 60_000)} minutes ago.`
    };
  }

  return {
    allow: true,
    reason: "ok",
    explanation: "Worth interrupting for."
  };
};

/** Returns the state to persist after a nudge is actually delivered. */
export const recordNudge = (
  state: NudgeState,
  merchantId: string,
  now: Date = new Date()
): NudgeState => ({
  lastNudgeAt: now.getTime(),
  lastNudgeByMerchant: { ...state.lastNudgeByMerchant, [merchantId]: now.getTime() }
});
