// app/utils/debtNotificationUtils.ts
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppNotification, addNotification } from "./notificationStore";

// Type compatible with Debt from DebtUtils
export type Debt = {
  id: string;
  name: string;
  type: string;
  originalAmount: number;
  currentBalance: number;
  monthlyPayment: number;
  startDate?: string;
  payments?: any[];
  createdAt: string;
};

const DEBT_REMINDER_PREFIX = "debtReminder:";

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
 * Schedule a debt reminder notification
 * @param debt - The debt to schedule a reminder for
 * @param testMode - If true, schedules notification for 5 seconds from now (for testing)
 */
export async function scheduleDebtReminder(
  debt: Debt,
  testMode: boolean = false
): Promise<string | null> {
  // Check if debt qualifies for reminder
  if (debt.currentBalance <= 0 || debt.monthlyPayment <= 0) {
    return null;
  }

  // Request permission
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
    console.warn("Notification permission not granted for debt reminder");
    return null;
  }

  try {
    // Build notification content
    const fmtRM = (n: number) =>
      `RM ${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const header = `Debt`;
    const title = `Pay your debt: ${debt.name || debt.type}`;
    const body = `Monthly payment: ${fmtRM(debt.monthlyPayment)} | Balance: ${fmtRM(debt.currentBalance)}`;

    // Build trigger based on platform
    let trigger: Notifications.NotificationTriggerInput;

    if (testMode) {
      // TEST MODE: Schedule for 5 seconds from now
      trigger = {
        seconds: 5,
        repeats: false, // Don't repeat in test mode
      } as Notifications.TimeIntervalTriggerInput;
      console.log("🧪 TEST MODE: Scheduling notification for 5 seconds from now");
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
          type: "debtReminder",
          debtId: debt.id,
        },
      },
      trigger,
    });

    // Store notification ID in AsyncStorage
    const storageKey = `${DEBT_REMINDER_PREFIX}${debt.id}`;
    await AsyncStorage.setItem(storageKey, notificationId);

    // Get userId for user-specific notifications
    const userId = await AsyncStorage.getItem("userId");
    
    // Also create an AppNotification entry for the Notification Center
    const appNotification: AppNotification = {
      id: `debt-${debt.id}-${Date.now()}`,
      type: "debtReminder",
      header,
      title,
      body,
      createdAt: new Date().toISOString(),
      read: false,
      debtId: debt.id,
    };
    await addNotification(appNotification, userId);

    return notificationId;
  } catch (error) {
    console.error("Error scheduling debt reminder:", error);
    return null;
  }
}

/**
 * Cancel a debt reminder notification
 */
export async function cancelDebtReminder(debtId: string): Promise<void> {
  try {
    const storageKey = `${DEBT_REMINDER_PREFIX}${debtId}`;
    const notificationId = await AsyncStorage.getItem(storageKey);

    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      await AsyncStorage.removeItem(storageKey);
    }
  } catch (error) {
    console.error("Error canceling debt reminder:", error);
  }
}

/**
 * Sync debt reminder for a debt (idempotent)
 * - If debt qualifies (balance > 0, monthlyPayment > 0), ensure reminder exists
 * - If debt doesn't qualify, cancel any existing reminder
 * @param debt - The debt to sync
 * @param testMode - If true, schedules notification for 5 seconds from now (for testing)
 */
export async function syncDebtReminderForDebt(
  debt: Debt,
  testMode: boolean = false
): Promise<void> {
  try {
    const storageKey = `${DEBT_REMINDER_PREFIX}${debt.id}`;
    const existingNotificationId = await AsyncStorage.getItem(storageKey);

    // If debt doesn't qualify, cancel any existing reminder
    if (debt.currentBalance <= 0 || debt.monthlyPayment <= 0) {
      if (existingNotificationId) {
        await cancelDebtReminder(debt.id);
      }
      return;
    }

    // If debt qualifies and no reminder exists, create one
    if (!existingNotificationId) {
      await scheduleDebtReminder(debt, testMode);
    }
    // If reminder already exists, we assume it's still valid
    // (could optionally reschedule if you want to update content/time)
  } catch (error) {
    console.error("Error syncing debt reminder:", error);
  }
}


export async function scheduleTestDebtReminder(debt: Debt): Promise<string | null> {
  return scheduleDebtReminder(debt, true);
}

