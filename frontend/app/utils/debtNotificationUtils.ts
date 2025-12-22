// app/utils/debtNotificationUtils.ts
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppNotification, addNotification } from "./notificationStore";

// Import the actual Debt type from DebtUtils
import type { Debt } from "./DebtUtils";

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

/**
 * Check if a payment date is in the current month
 */
function isPaymentInCurrentMonth(paymentDateISO: string, currentMonthKey: string): boolean {
  const paymentDate = new Date(paymentDateISO);
  const [year, month] = currentMonthKey.split("-").map(Number);
  const paymentYear = paymentDate.getFullYear();
  const paymentMonth = paymentDate.getMonth() + 1; // getMonth() returns 0-11
  
  return paymentYear === year && paymentMonth === month;
}

/**
 * Check if debt has been paid in the current month
 */
function hasPaidThisMonth(debt: Debt, currentMonthKey: string): boolean {
  if (!debt.payments || debt.payments.length === 0) {
    return false;
  }
  
  return debt.payments.some(p => isPaymentInCurrentMonth(p.dateISO, currentMonthKey));
}

/**
 * Get current month key in YYYY-MM format
 */
function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Check and send notifications for unpaid debts on the 15th of the month
 * This function should be called when the app opens or runs in background
 * @param debts - Array of all user debts
 * @param userId - User ID for storing notifications
 */
export async function checkAndNotifyUnpaidDebts(
  debts: Debt[],
  userId: string | null
): Promise<void> {
  try {
    // Only check on the 15th or later in the month
    const today = new Date();
    const dayOfMonth = today.getDate();
    
    if (dayOfMonth < 15) {
      // Too early in the month, don't check yet
      return;
    }

    // Check if we've already sent notifications this month
    const currentMonthKey = getCurrentMonthKey();
    const lastCheckKey = `debtUnpaidCheck:${currentMonthKey}`;
    const lastCheck = await AsyncStorage.getItem(lastCheckKey);
    
    if (lastCheck === "checked") {
      // Already checked this month, skip
      return;
    }

    // Request notification permission
    const hasPermission = await ensureNotificationPermission();
    if (!hasPermission) {
      console.warn("Notification permission not granted for unpaid debt check");
      return;
    }

    if (!userId) {
      console.warn("No userId provided for unpaid debt check");
      return;
    }

    const fmtRM = (n: number) =>
      `RM ${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Filter debts that:
    // 1. Have a monthly payment > 0
    // 2. Have a current balance > 0
    // 3. Have NOT been paid this month
    const unpaidDebts = debts.filter((debt) => {
      if (debt.monthlyPayment <= 0 || debt.currentBalance <= 0) {
        return false;
      }
      return !hasPaidThisMonth(debt, currentMonthKey);
    });

    if (unpaidDebts.length === 0) {
      // Mark as checked even if no unpaid debts (to avoid repeated checks)
      await AsyncStorage.setItem(lastCheckKey, "checked");
      return;
    }

    // Send notifications for unpaid debts
    const notifications: AppNotification[] = [];
    
    for (const debt of unpaidDebts) {
      const header = `Debt Payment Reminder`;
      const title = `💰 Unpaid Debt: ${debt.name || debt.type}`;
      const body = `Your monthly payment of ${fmtRM(debt.monthlyPayment)} is due. Current balance: ${fmtRM(debt.currentBalance)}`;

      // Send push notification
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title,
            body,
            sound: true,
            data: {
              type: "debtUnpaidReminder",
              debtId: debt.id,
            },
          },
          trigger: null, // Send immediately
        });
      } catch (error) {
        console.error(`Error sending push notification for debt ${debt.id}:`, error);
      }

      // Create AppNotification entry for the Notification Center
      const appNotification: AppNotification = {
        id: `debt-unpaid-${debt.id}-${Date.now()}`,
        type: "debtUnpaidReminder",
        header,
        title,
        body,
        createdAt: new Date().toISOString(),
        read: false,
        debtId: debt.id,
      };
      
      notifications.push(appNotification);
    }

    // Save all notifications to the notification store
    for (const notification of notifications) {
      try {
        await addNotification(notification, userId);
      } catch (error) {
        console.error(`Error saving notification for debt ${notification.debtId}:`, error);
      }
    }

    // Mark as checked for this month
    await AsyncStorage.setItem(lastCheckKey, "checked");
    
    console.log(`✅ Checked unpaid debts: ${unpaidDebts.length} unpaid debt(s) found and notified`);
  } catch (error) {
    console.error("Error checking and notifying unpaid debts:", error);
  }
}

