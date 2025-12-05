// app/utils/savingsNotificationUtils.ts
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppNotification, addNotification } from "./notificationStore";
import type { SavingsGoal } from "./SavingsUtils";

const SAVINGS_REMINDER_PREFIX = "savingsReminder:";

/**
 * Ensure notification permissions are granted
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === "granted") {
      return true;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch (error) {
    console.error("Error requesting notification permission:", error);
    return false;
  }
}

/**
 * Calculate seconds until next 15th of the month (for Android)
 */
function getSecondsUntilNext15th(): number {
  const now = new Date();
  const currentDay = now.getDate();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  let targetDate: Date;

  if (currentDay >= 15) {
    // If today is 15th or later, target next month's 15th
    targetDate = new Date(currentYear, currentMonth + 1, 15, 9, 0, 0);
  } else {
    // If today is before 15th, target this month's 15th
    targetDate = new Date(currentYear, currentMonth, 15, 9, 0, 0);
  }

  const diffMs = targetDate.getTime() - now.getTime();
  return Math.max(0, Math.floor(diffMs / 1000));
}

/**
 * Schedule a savings reminder notification
 * @param goal - The savings goal to schedule a reminder for
 * @param testMode - If true, schedules notification for 5 seconds from now (for testing)
 */
export async function scheduleSavingsReminder(
  goal: SavingsGoal,
  testMode: boolean = false
): Promise<string | null> {
  // Check if goal qualifies for reminder
  // Only schedule if goal has monthlyTarget > 0 and hasn't reached targetAmount
  if (!goal.monthlyTarget || goal.monthlyTarget <= 0 || goal.currentAmount >= goal.targetAmount) {
    return null;
  }

  // Request permission
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
    console.warn("Notification permission not granted for savings reminder");
    return null;
  }

  try {
    // Build notification content
    const fmtRM = (n: number) =>
      `RM ${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const header = `Savings`;
    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
    const title = `Add to your savings: ${goal.name}`;
    const body = `Monthly target: ${fmtRM(goal.monthlyTarget)} | Remaining: ${fmtRM(remaining)}`;

    // Build trigger based on platform
    let trigger: Notifications.NotificationTriggerInput;

    if (testMode) {
      // TEST MODE: Schedule for 5 seconds from now
      trigger = {
        seconds: 5,
        repeats: false, // Don't repeat in test mode
      } as Notifications.TimeIntervalTriggerInput;
      console.log("🧪 TEST MODE: Scheduling savings notification for 5 seconds from now");
    } else if (Platform.OS === "ios") {
      // iOS supports calendar triggers with day
      trigger = {
        day: 15,
        hour: 9,
        minute: 0,
        repeats: true,
      } as Notifications.CalendarTriggerInput;
    } else {
      // Android: use seconds-based trigger with repeats
      const secondsUntilNext15th = getSecondsUntilNext15th();
      trigger = {
        seconds: secondsUntilNext15th || 86400, // fallback to 1 day if calculation fails
        repeats: true,
      } as Notifications.TimeIntervalTriggerInput;
    }

    // Schedule the notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data: {
          type: "savingsReminder",
          goalId: goal.id,
        },
      },
      trigger,
    });

    // Store notification ID in AsyncStorage
    const storageKey = `${SAVINGS_REMINDER_PREFIX}${goal.id}`;
    await AsyncStorage.setItem(storageKey, notificationId);

    // Also create an AppNotification entry for the Notification Center
    const appNotification: AppNotification = {
      id: `savings-${goal.id}-${Date.now()}`,
      type: "savingsReminder",
      header,
      title,
      body,
      createdAt: new Date().toISOString(),
      read: false,
      goalId: goal.id,
    };
    await addNotification(appNotification);

    return notificationId;
  } catch (error) {
    console.error("Error scheduling savings reminder:", error);
    return null;
  }
}

/**
 * Cancel a savings reminder notification
 */
export async function cancelSavingsReminder(goalId: string): Promise<void> {
  try {
    const storageKey = `${SAVINGS_REMINDER_PREFIX}${goalId}`;
    const notificationId = await AsyncStorage.getItem(storageKey);

    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      await AsyncStorage.removeItem(storageKey);
    }
  } catch (error) {
    console.error("Error canceling savings reminder:", error);
  }
}

/**
 * Sync savings reminder for a goal (idempotent)
 * - If goal qualifies (monthlyTarget > 0, currentAmount < targetAmount), ensure reminder exists
 * - If goal doesn't qualify, cancel any existing reminder
 * @param goal - The savings goal to sync
 * @param testMode - If true, schedules notification for 5 seconds from now (for testing)
 */
export async function syncSavingsReminderForGoal(
  goal: SavingsGoal,
  testMode: boolean = false
): Promise<void> {
  try {
    const storageKey = `${SAVINGS_REMINDER_PREFIX}${goal.id}`;
    const existingNotificationId = await AsyncStorage.getItem(storageKey);

    // If goal doesn't qualify, cancel any existing reminder
    if (!goal.monthlyTarget || goal.monthlyTarget <= 0 || goal.currentAmount >= goal.targetAmount) {
      if (existingNotificationId) {
        await cancelSavingsReminder(goal.id);
      }
      return;
    }

    // If goal qualifies and no reminder exists, create one
    if (!existingNotificationId) {
      await scheduleSavingsReminder(goal, testMode);
    }
    // If reminder already exists, we assume it's still valid
    // (could optionally reschedule if you want to update content/time)
  } catch (error) {
    console.error("Error syncing savings reminder:", error);
  }
}

/**
 * Test function to schedule a savings reminder for testing
 */
export async function scheduleTestSavingsReminder(goal: SavingsGoal): Promise<string | null> {
  return scheduleSavingsReminder(goal, true);
}

