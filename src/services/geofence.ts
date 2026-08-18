import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";

import { AppSettings, Merchant } from "../types/domain";

const GEOFENCE_TASK = "favorite-store-geofence-task";
let lastSentAt = 0;

const inQuietHours = (settings: AppSettings, now: Date): boolean => {
  const hour = now.getHours();
  if (settings.quietHoursStart > settings.quietHoursEnd) {
    return hour >= settings.quietHoursStart || hour < settings.quietHoursEnd;
  }
  return hour >= settings.quietHoursStart && hour < settings.quietHoursEnd;
};

export const shouldNotifyNow = (
  settings: AppSettings,
  delta: number,
  now = new Date()
): boolean => {
  if (delta < settings.nudgeDeltaThreshold) {
    return false;
  }

  if (inQuietHours(settings, now)) {
    return false;
  }

  // 45-minute throttle window to reduce notification fatigue.
  if (now.getTime() - lastSentAt < 45 * 60 * 1000) {
    return false;
  }

  lastSentAt = now.getTime();
  return true;
};

export const requestNudgePermissions = async (): Promise<boolean> => {
  const location = await Location.requestForegroundPermissionsAsync();
  if (!location.granted) {
    return false;
  }

  const locationBackground = await Location.requestBackgroundPermissionsAsync();
  if (!locationBackground.granted) {
    return false;
  }

  const notification = await Notifications.requestPermissionsAsync();
  return notification.granted || notification.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
};

export const registerFavoriteGeofences = async (favorites: Merchant[]): Promise<void> => {
  const regions: Location.LocationRegion[] = favorites
    .filter(
      (merchant) =>
        merchant.latitude != null && merchant.longitude != null && merchant.radiusMeters != null
    )
    .map((merchant) => ({
      identifier: merchant.id,
      latitude: merchant.latitude!,
      longitude: merchant.longitude!,
      radius: merchant.radiusMeters!,
      notifyOnEnter: true,
      notifyOnExit: false
    }));

  if (regions.length === 0) {
    return;
  }

  await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
};

TaskManager.defineTask(GEOFENCE_TASK, async ({ error }) => {
  if (error) {
    return;
  }

  // Full decision context is evaluated in-app after location wake-up.
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Card tip available",
      body: "Open Credit Card Teller to see your best card for this store.",
      sound: "default"
    },
    trigger: null
  });
});
