import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import * as Notifications from "expo-notifications";

import { api, onInvalidate } from "@/src/api";
import { useAuth } from "@/src/auth";

/** Device reminders: the backend computes the next reminders (prefs, quiet hours, timezone, discreet text);
 *  the phone cancels and re-schedules them so edits never leave stale or duplicate alerts. Web cannot schedule. */
export const deviceRemindersSupported = Platform.OS !== "web";

if (deviceRemindersSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

let timer: ReturnType<typeof setTimeout> | null = null;

export async function syncDeviceReminders() {
  if (!deviceRemindersSupported) return;
  const perm = await Notifications.getPermissionsAsync();
  if (perm.status !== "granted") return;
  const { items } = await api<{ items: { key: string; fire_at: string; title: string; body: string; link: string }[] }>("/reminders");
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const r of items) {
    const date = new Date(r.fire_at);
    if (date.getTime() <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: r.key,
      content: { title: r.title, body: r.body, data: { link: r.link } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
    });
  }
}

function scheduleSync() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => syncDeviceReminders().catch(() => {}), 1500);
}

/** Mount once inside the signed-in area: keeps the timezone current and re-syncs on changes and on foreground. */
export function useReminderSync() {
  const { user, updateMe } = useAuth();
  const uid = user?.id;
  useEffect(() => {
    if (!uid) return;
    const tz = -new Date().getTimezoneOffset();
    if (user?.settings?.tz_offset !== tz) updateMe({ settings: { tz_offset: tz } }).catch(() => {});
    onInvalidate(scheduleSync);
    scheduleSync();
    const sub = AppState.addEventListener("change", (s) => s === "active" && scheduleSync());
    return () => {
      onInvalidate(null);
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);
}
