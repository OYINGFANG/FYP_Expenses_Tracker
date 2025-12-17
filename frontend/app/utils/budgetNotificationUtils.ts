// app/utils/budgetNotificationUtils.ts
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppNotification, addNotification, getNotifications } from "./notificationStore";
import { getBudgetProgress, getCurrentMonthKey } from "./budgetUtils";

const BUDGET_NOTIFICATION_PREFIX = "budgetNotification:";
const BUDGET_WARNING_THRESHOLD = 0.8; // 80% of budget used
const BUDGET_EXCEEDED_THRESHOLD = 1.0; // 100% of budget used

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
 * Format currency
 */
const fmtRM = (n: number) =>
  `RM ${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Check and create budget notifications
 * This should be called when expenses are added or budget progress is updated
 */
export async function checkAndCreateBudgetNotifications(
  userId: string,
  monthKey?: string
): Promise<void> {
  try {
    const currentMonthKey = monthKey || getCurrentMonthKey();
    const progress = await getBudgetProgress(currentMonthKey);

    if (!progress || progress.totalBudget <= 0) {
      return; // No budget set, no notifications needed
    }

    const utilizationPct = progress.utilizationPct / 100; // Convert to 0-1 range
    const remaining = progress.remaining;
    const totalSpent = progress.totalSpent;
    const totalBudget = progress.totalBudget;

    // Check for overall budget warnings
    const storageKey = `${BUDGET_NOTIFICATION_PREFIX}${currentMonthKey}:overall`;
    const existingNotificationId = await AsyncStorage.getItem(storageKey);

    if (utilizationPct >= BUDGET_EXCEEDED_THRESHOLD) {
      // Budget exceeded - create notification if not already exists
      if (!existingNotificationId) {
        await createBudgetExceededNotification(totalSpent, totalBudget, remaining, currentMonthKey);
        // Store a marker to prevent duplicates
        await AsyncStorage.setItem(storageKey, "exceeded");
      }
    } else if (utilizationPct >= BUDGET_WARNING_THRESHOLD && !existingNotificationId) {
      // Budget warning (80% used) - create notification if not already exists
      await createBudgetWarningNotification(totalSpent, totalBudget, remaining, currentMonthKey);
      await AsyncStorage.setItem(storageKey, "warning");
    } else if (utilizationPct < BUDGET_WARNING_THRESHOLD && existingNotificationId) {
      // Budget usage dropped below warning threshold, clear the marker
      await AsyncStorage.removeItem(storageKey);
    }

    // Check for category budget exceeded
    for (const [category, catProgress] of Object.entries(progress.byCategory)) {
      if (catProgress.allocated > 0 && catProgress.ratio >= 1.0) {
        const catStorageKey = `${BUDGET_NOTIFICATION_PREFIX}${currentMonthKey}:${category}`;
        const catExisting = await AsyncStorage.getItem(catStorageKey);
        
        if (!catExisting) {
          await createCategoryBudgetExceededNotification(
            category,
            catProgress.spent,
            catProgress.allocated,
            currentMonthKey
          );
          await AsyncStorage.setItem(catStorageKey, "exceeded");
        }
      } else if (catProgress.allocated > 0 && catProgress.ratio < 1.0) {
        // Category is no longer exceeded, clear the marker
        const catStorageKey = `${BUDGET_NOTIFICATION_PREFIX}${currentMonthKey}:${category}`;
        await AsyncStorage.removeItem(catStorageKey);
      }
    }
  } catch (error) {
    console.error("Error checking budget notifications:", error);
  }
}

/**
 * Create a notification for budget exceeded
 */
async function createBudgetExceededNotification(
  totalSpent: number,
  totalBudget: number,
  remaining: number,
  monthKey: string
): Promise<void> {
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
    console.warn("Notification permission not granted for budget notification");
  }

  const header = "Budget";
  const title = "Budget Exceeded!";
  const body = `You've spent ${fmtRM(totalSpent)} of ${fmtRM(totalBudget)}. Over by ${fmtRM(Math.abs(remaining))}.`;

  // Use stable ID to prevent duplicates
  const notificationId = `budget-exceeded-${monthKey}`;
  
  // Get userId for user-specific notifications
  const userId = await AsyncStorage.getItem("userId");
  
  // Check if notification already exists
  const existing = await getNotifications(userId);
  const alreadyExists = existing.some(n => n.id === notificationId);
  
  if (alreadyExists) {
    // Update existing notification instead of creating duplicate
    const existingNotif = existing.find(n => n.id === notificationId);
    if (existingNotif) {
      const updated: AppNotification = {
        ...existingNotif,
        title,
        body,
        createdAt: new Date().toISOString(),
        read: false,
      };
      await addNotification(updated, userId);
    }
    return; // Don't create duplicate push notification either
  }

  // Schedule immediate push notification
  if (hasPermission) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          data: {
            type: "budgetReminder",
            monthKey,
          },
        },
        trigger: null, // null trigger = immediate notification
      });
    } catch (error) {
      console.error("Error scheduling budget exceeded notification:", error);
    }
  }

  // Also create an AppNotification entry for the Notification Center
  const appNotification: AppNotification = {
    id: notificationId,
    type: "budgetReminder",
    header,
    title,
    body,
    createdAt: new Date().toISOString(),
    read: false,
    monthKey,
  };

  await addNotification(appNotification, userId);
}

/**
 * Create a notification for budget warning (80% used)
 */
async function createBudgetWarningNotification(
  totalSpent: number,
  totalBudget: number,
  remaining: number,
  monthKey: string
): Promise<void> {
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
    console.warn("Notification permission not granted for budget notification");
  }

  const header = "Budget";
  const title = "Budget Warning";
  const body = `You've used 80% of your budget. ${fmtRM(remaining)} remaining out of ${fmtRM(totalBudget)}.`;

  // Use stable ID to prevent duplicates
  const notificationId = `budget-warning-${monthKey}`;
  
  // Get userId for user-specific notifications
  const userId = await AsyncStorage.getItem("userId");
  
  // Check if notification already exists
  const existing = await getNotifications(userId);
  const alreadyExists = existing.some(n => n.id === notificationId);
  
  if (alreadyExists) {
    // Update existing notification instead of creating duplicate
    const existingNotif = existing.find(n => n.id === notificationId);
    if (existingNotif) {
      const updated: AppNotification = {
        ...existingNotif,
        title,
        body,
        createdAt: new Date().toISOString(),
        read: false,
      };
      await addNotification(updated, userId);
    }
    return; // Don't create duplicate push notification either
  }

  // Schedule immediate push notification
  if (hasPermission) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          data: {
            type: "budgetReminder",
            monthKey,
          },
        },
        trigger: null, // null trigger = immediate notification
      });
    } catch (error) {
      console.error("Error scheduling budget warning notification:", error);
    }
  }

  // Also create an AppNotification entry for the Notification Center
  const appNotification: AppNotification = {
    id: notificationId,
    type: "budgetReminder",
    header,
    title,
    body,
    createdAt: new Date().toISOString(),
    read: false,
    monthKey,
  };

  await addNotification(appNotification, userId);
}

/**
 * Create a notification for category budget exceeded
 */
async function createCategoryBudgetExceededNotification(
  category: string,
  spent: number,
  allocated: number,
  monthKey: string
): Promise<void> {
  const hasPermission = await ensureNotificationPermission();
  if (!hasPermission) {
    console.warn("Notification permission not granted for budget notification");
  }

  const header = "Budget";
  const title = `${category} Budget Exceeded`;
  const body = `You've spent ${fmtRM(spent)} on ${category}, exceeding your budget of ${fmtRM(allocated)}.`;

  // Use stable ID to prevent duplicates
  const notificationId = `budget-category-${category}-${monthKey}`;
  
  // Get userId for user-specific notifications
  const userId = await AsyncStorage.getItem("userId");
  
  // Check if notification already exists
  const existing = await getNotifications(userId);
  const alreadyExists = existing.some(n => n.id === notificationId);
  
  if (alreadyExists) {
    // Update existing notification instead of creating duplicate
    const existingNotif = existing.find(n => n.id === notificationId);
    if (existingNotif) {
      const updated: AppNotification = {
        ...existingNotif,
        title,
        body,
        createdAt: new Date().toISOString(),
        read: false,
      };
      await addNotification(updated, userId);
    }
    return; // Don't create duplicate push notification either
  }

  // Schedule immediate push notification
  if (hasPermission) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          data: {
            type: "budgetReminder",
            monthKey,
            category,
          },
        },
        trigger: null, // null trigger = immediate notification
      });
    } catch (error) {
      console.error("Error scheduling category budget notification:", error);
    }
  }

  // Also create an AppNotification entry for the Notification Center
  const appNotification: AppNotification = {
    id: notificationId,
    type: "budgetReminder",
    header,
    title,
    body,
    createdAt: new Date().toISOString(),
    read: false,
    monthKey,
    category,
  };

  await addNotification(appNotification, userId);
}

/**
 * Clear budget notifications for a specific month
 */
export async function clearBudgetNotificationsForMonth(monthKey: string): Promise<void> {
  try {
    // Clear overall budget notification
    const storageKey = `${BUDGET_NOTIFICATION_PREFIX}${monthKey}:overall`;
    await AsyncStorage.removeItem(storageKey);

    // Clear category budget notifications
    const allKeys = await AsyncStorage.getAllKeys();
    const categoryKeys = allKeys.filter(key => 
      key.startsWith(`${BUDGET_NOTIFICATION_PREFIX}${monthKey}:`) && 
      key !== storageKey
    );
    
    if (categoryKeys.length > 0) {
      await AsyncStorage.multiRemove(categoryKeys);
    }
  } catch (error) {
    console.error("Error clearing budget notifications:", error);
  }
}

