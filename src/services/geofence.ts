import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { matchByRegionId } from "../engine/merchantMatch";
import { formatRate, recommend } from "../engine/rewards";
import { Merchant } from "../types/domain";
import { evaluateNudge, recordNudge } from "./nudgePolicy";
import { loadSnapshot, saveJson, storageKeys, walletCards } from "./storage";

/**
 * Geofence nudges.
 *
 * The hard part is not registering regions, it is what happens when iOS wakes
 * the app hours later with no UI and no React state. The task below rebuilds
 * everything it needs from storage, runs the same engine the screen runs, and
 * gates the notification on persisted anti-spam state so a cold start cannot
 * reset the throttle.
 */

export const GEOFENCE_TASK = "cct.favorite-store-geofence";
const ANDROID_CHANNEL_ID = "card-tips";

/** iOS monitors at most 20 regions per app; going over silently drops them. */
export const MAX_REGIONS = 20;
const DEFAULT_RADIUS_METERS = 100;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

const ensureAndroidChannel = async (): Promise<void> => {
  if (Platform.OS !== "android") {
    return;
  }
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Card tips",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE
  });
};

export interface PermissionReport {
  granted: boolean;
  foregroundLocation: boolean;
  backgroundLocation: boolean;
  notifications: boolean;
  /** What the user must fix, in the order they should fix it. */
  missing: string[];
}

/**
 * Requests permissions in the order iOS requires: when-in-use first, then
 * always, then notifications. Returns which pieces are missing so the UI can
 * say something better than "permission denied".
 */
export const requestNudgePermissions = async (): Promise<PermissionReport> => {
  const missing: string[] = [];

  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) {
    missing.push("Location access while using the app");
    return {
      granted: false,
      foregroundLocation: false,
      backgroundLocation: false,
      notifications: false,
      missing
    };
  }

  const background = await Location.requestBackgroundPermissionsAsync();
  if (!background.granted) {
    missing.push('Always-on location (choose "Always" in Settings)');
  }

  const notifications = await Notifications.requestPermissionsAsync();
  const notificationsGranted =
    notifications.granted ||
    notifications.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!notificationsGranted) {
    missing.push("Notifications");
  }

  if (notificationsGranted) {
    await ensureAndroidChannel();
  }

  return {
    granted: background.granted && notificationsGranted,
    foregroundLocation: true,
    backgroundLocation: background.granted,
    notifications: notificationsGranted,
    missing
  };
};

export interface SyncResult {
  started: boolean;
  registered: string[];
  /** Merchants that could not be monitored, with the reason why. */
  skipped: { merchantId: string; name: string; reason: string }[];
  error?: string;
}

const toRegion = (merchant: Merchant): Location.LocationRegion | null => {
  if (!merchant.location) {
    return null;
  }
  return {
    identifier: merchant.id,
    latitude: merchant.location.latitude,
    longitude: merchant.location.longitude,
    radius: merchant.radiusMeters ?? DEFAULT_RADIUS_METERS,
    notifyOnEnter: true,
    notifyOnExit: false
  };
};

export const stopGeofences = async (): Promise<void> => {
  try {
    const running = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
    if (running) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
    }
  } catch {
    // Nothing registered, or the task was never started. Either way we are done.
  }
};

/**
 * Replaces the monitored region set with the user's pinned favorites.
 *
 * Always stops first: expo-location replaces regions wholesale, and leaving a
 * stale task running is how you end up nudged at a store you un-favorited.
 */
export const syncGeofences = async (
  favorites: Merchant[],
  enabled: boolean
): Promise<SyncResult> => {
  await stopGeofences();

  if (!enabled) {
    return { started: false, registered: [], skipped: [] };
  }

  const skipped: SyncResult["skipped"] = [];
  const regions: Location.LocationRegion[] = [];
  const registered: string[] = [];

  for (const merchant of favorites) {
    const region = toRegion(merchant);
    if (!region) {
      skipped.push({
        merchantId: merchant.id,
        name: merchant.name,
        reason: "No pinned location. Open the store and tap Pin current location."
      });
      continue;
    }
    if (regions.length >= MAX_REGIONS) {
      skipped.push({
        merchantId: merchant.id,
        name: merchant.name,
        reason: `Over the ${MAX_REGIONS} region limit iOS allows.`
      });
      continue;
    }
    regions.push(region);
    registered.push(merchant.id);
  }

  if (regions.length === 0) {
    return { started: false, registered: [], skipped };
  }

  try {
    await ensureAndroidChannel();
    await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
    return { started: true, registered, skipped };
  } catch (error) {
    return {
      started: false,
      registered: [],
      skipped,
      error: error instanceof Error ? error.message : String(error)
    };
  }
};

export const geofenceStatus = async (): Promise<{
  taskRegistered: boolean;
  running: boolean;
}> => {
  const taskRegistered = TaskManager.isTaskDefined(GEOFENCE_TASK);
  let running = false;
  try {
    running = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
  } catch {
    running = false;
  }
  return { taskRegistered, running };
};

/**
 * Decides whether to nudge for a region entry and sends it.
 *
 * Exported so the debug panel can dry-run the exact background path instead of
 * asking the user to drive to a Costco to test it.
 */
export const handleRegionEnter = async (
  regionId: string,
  now: Date = new Date()
): Promise<{ notified: boolean; reason: string; body?: string }> => {
  const snapshot = await loadSnapshot();
  const match = matchByRegionId(regionId, snapshot.merchants);
  const merchant = match.best?.merchant;

  if (!merchant) {
    return { notified: false, reason: match.explanation };
  }

  const result = recommend(
    walletCards(snapshot),
    {
      merchant,
      channel: "in_store",
      paymentMethod: snapshot.settings.defaultPaymentMethod
    },
    { overrides: snapshot.overrides, ledger: snapshot.ledger, now }
  );

  const decision = evaluateNudge(
    snapshot.settings,
    {
      merchantId: merchant.id,
      delta: result.deltaVsRunnerUp,
      hasWinner: result.winner != null,
      isTie: result.isTie
    },
    snapshot.nudgeState,
    now
  );

  if (!decision.allow || !result.winner) {
    return { notified: false, reason: decision.explanation };
  }

  const body = `Use ${result.winner.cardName} — ${formatRate(result.winner.effectiveRate)}. ${result.winner.headline}.`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `At ${merchant.name}?`,
      body,
      sound: "default",
      data: { merchantId: merchant.id, cardId: result.winner.cardId, source: "geofence" },
      ...(Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : {})
    },
    trigger: null
  });

  await saveJson(storageKeys.nudgeState, recordNudge(snapshot.nudgeState, merchant.id, now));

  return { notified: true, reason: decision.explanation, body };
};

interface GeofenceTaskData {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}

/**
 * Registered at module scope so it exists before iOS delivers a region event
 * to a cold-started app. `App.tsx` imports this module for that reason.
 */
TaskManager.defineTask<GeofenceTaskData>(GEOFENCE_TASK, async ({ data, error }) => {
  if (error || !data) {
    return;
  }

  if (data.eventType !== Location.GeofencingEventType.Enter) {
    return;
  }

  const identifier = data.region?.identifier;
  if (!identifier) {
    return;
  }

  try {
    await handleRegionEnter(identifier);
  } catch {
    // A crashed background task can get the app's location privileges revoked
    // by the OS, so failures are swallowed rather than thrown.
  }
});

/**
 * Reads the device's current position so the user can pin a store.
 *
 * Seeded merchants ship without coordinates on purpose — a Costco in one city
 * is not a Costco in another — so geofencing only works after the user stands
 * in the store once and pins it.
 */
export const captureCurrentLocation = async (): Promise<
  { ok: true; point: { latitude: number; longitude: number } } | { ok: false; reason: string }
> => {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    return { ok: false, reason: "Location permission is required to pin a store." };
  }

  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) {
    return { ok: false, reason: "Location services are turned off on this device." };
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced
    });
    return {
      ok: true,
      point: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      }
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "Could not read your location."
    };
  }
};
