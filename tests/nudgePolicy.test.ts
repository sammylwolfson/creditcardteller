import { seedSettings } from "../src/data/merchants";
import {
  emptyNudgeState,
  evaluateNudge,
  inQuietHours,
  NudgeContext,
  recordNudge
} from "../src/services/nudgePolicy";
import { AppSettings } from "../src/types/domain";
import { assertEqual, assertTrue, suite, test } from "./harness";

const settings: AppSettings = { ...seedSettings, geofenceEnabled: true };

const goodContext: NudgeContext = {
  merchantId: "costco",
  delta: 0.04,
  hasWinner: true,
  isTie: false
};

const at = (iso: string): Date => new Date(iso);

suite("quiet hours", () => {
  test("an overnight window wraps past midnight", () => {
    assertTrue(inQuietHours(settings, at("2026-08-21T23:30:00")), "23:30 is quiet");
    assertTrue(inQuietHours(settings, at("2026-08-21T03:00:00")), "03:00 is quiet");
    assertTrue(!inQuietHours(settings, at("2026-08-21T12:00:00")), "midday is not");
    assertTrue(!inQuietHours(settings, at("2026-08-21T07:00:00")), "the window ends at 07:00");
  });

  test("a daytime window does not wrap", () => {
    const daytime: AppSettings = { ...settings, quietHoursStart: 9, quietHoursEnd: 17 };
    assertTrue(inQuietHours(daytime, at("2026-08-21T10:00:00")), "10:00 is inside");
    assertTrue(!inQuietHours(daytime, at("2026-08-21T20:00:00")), "20:00 is outside");
  });

  test("an empty window is never quiet", () => {
    const none: AppSettings = { ...settings, quietHoursStart: 0, quietHoursEnd: 0 };
    assertTrue(!inQuietHours(none, at("2026-08-21T02:00:00")), "start === end disables quiet hours");
  });
});

suite("nudge gating", () => {
  const noon = at("2026-08-21T12:00:00");

  test("allows a meaningful win outside quiet hours", () => {
    const decision = evaluateNudge(settings, goodContext, emptyNudgeState, noon);
    assertEqual(decision.reason, "ok");
    assertTrue(decision.allow, "should fire");
  });

  test("stays silent when the feature is off", () => {
    const decision = evaluateNudge(
      { ...settings, geofenceEnabled: false },
      goodContext,
      emptyNudgeState,
      noon
    );
    assertEqual(decision.reason, "disabled");
  });

  test("stays silent for a small win", () => {
    const decision = evaluateNudge(settings, { ...goodContext, delta: 0.005 }, emptyNudgeState, noon);
    assertEqual(decision.reason, "below_threshold");
  });

  test("stays silent on a tie", () => {
    const decision = evaluateNudge(settings, { ...goodContext, isTie: true }, emptyNudgeState, noon);
    assertEqual(decision.reason, "tie");
  });

  test("stays silent when no card works at the store", () => {
    const decision = evaluateNudge(
      settings,
      { ...goodContext, hasWinner: false },
      emptyNudgeState,
      noon
    );
    assertEqual(decision.reason, "no_winner");
  });

  test("respects quiet hours", () => {
    const decision = evaluateNudge(settings, goodContext, emptyNudgeState, at("2026-08-21T23:00:00"));
    assertEqual(decision.reason, "quiet_hours");
  });

  test("respects the global cooldown", () => {
    const state = recordNudge(emptyNudgeState, "trader-joes", at("2026-08-21T11:30:00"));
    const decision = evaluateNudge(settings, goodContext, state, noon);
    assertEqual(decision.reason, "global_cooldown", "45 minute cooldown, 30 minutes elapsed");
  });

  test("respects a per-store cooldown after the global one clears", () => {
    let state = recordNudge(emptyNudgeState, "costco", at("2026-08-21T09:00:00"));
    // Global cooldown (45m) has passed but the per-merchant one (4h) has not.
    const decision = evaluateNudge(settings, goodContext, state, noon);
    assertEqual(decision.reason, "merchant_cooldown");

    // A different store is still fair game.
    const elsewhere = evaluateNudge(settings, { ...goodContext, merchantId: "pavilions" }, state, noon);
    assertEqual(elsewhere.reason, "ok");

    // And the same store clears once the window passes.
    state = recordNudge(emptyNudgeState, "costco", at("2026-08-21T06:00:00"));
    assertEqual(evaluateNudge(settings, goodContext, state, noon).reason, "ok");
  });

  test("throttle state survives being written and read back", () => {
    const state = recordNudge(emptyNudgeState, "costco", noon);
    const roundTripped = JSON.parse(JSON.stringify(state)) as typeof state;

    // This is the cold-start case: iOS relaunches the app, memory is gone, and
    // only the persisted copy stops a duplicate nudge.
    assertEqual(
      evaluateNudge(settings, goodContext, roundTripped, at("2026-08-21T12:05:00")).reason,
      "global_cooldown"
    );
  });
});
