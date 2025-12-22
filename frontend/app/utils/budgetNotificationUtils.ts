// app/utils/budgetNotificationUtils.ts
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppNotification, addNotification } from "./notificationStore";
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
  const currentMonthKey = monthKey || getCurrentMonthKey();
  
  // Use a processing lock to prevent concurrent execution
  const processingLockKey = `${BUDGET_NOTIFICATION_PREFIX}${currentMonthKey}:processing`;
  const isProcessing = await AsyncStorage.getItem(processingLockKey);
  
  if (isProcessing) {
    // Another call is already processing, skip this one
    console.log("Budget notification check already in progress, skipping duplicate call");
    return;
  }

  try {
    // Set processing lock IMMEDIATELY to prevent race conditions
    await AsyncStorage.setItem(processingLockKey, "true");
    
    const progress = await getBudgetProgress(currentMonthKey);

    if (!progress || progress.totalBudget <= 0) {
      // No budget set, no notifications needed - but lock will be cleared in finally
      return;
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
        // Set marker IMMEDIATELY to prevent race conditions from concurrent calls
        await AsyncStorage.setItem(storageKey, "exceeded");
        await createBudgetExceededNotification(totalSpent, totalBudget, remaining, currentMonthKey);
      }
    } else if (utilizationPct >= BUDGET_WARNING_THRESHOLD && !existingNotificationId) {
      // Budget warning (80% used) - create notification if not already exists
      // Set marker IMMEDIATELY to prevent race conditions from concurrent calls
      await AsyncStorage.setItem(storageKey, "warning");
      await createBudgetWarningNotification(totalSpent, totalBudget, remaining, currentMonthKey);
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
          // Set marker IMMEDIATELY to prevent race conditions from concurrent calls
          await AsyncStorage.setItem(catStorageKey, "exceeded");
          await createCategoryBudgetExceededNotification(
            category,
            catProgress.spent,
            catProgress.allocated,
            currentMonthKey
          );
        }
      } else if (catProgress.allocated > 0 && catProgress.ratio < 1.0) {
        // Category is no longer exceeded, clear the marker
        const catStorageKey = `${BUDGET_NOTIFICATION_PREFIX}${currentMonthKey}:${category}`;
        await AsyncStorage.removeItem(catStorageKey);
      }
    }
  } catch (error) {
    console.error("Error checking budget notifications:", error);
  } finally {
    // Always clear the processing lock when done
    await AsyncStorage.removeItem(processingLockKey);
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

  // Use stable ID to prevent duplicates - addNotification will handle duplicate checking
  const notificationId = `budget-exceeded-${monthKey}`;
  
  // Get userId for user-specific notifications
  const userId = await AsyncStorage.getItem("userId");
  
  if (!userId) {
    console.warn("No userId available for budget notification");
    return;
  }

  // Create the AppNotification entry - addNotification will check for duplicates and update if exists
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

  // addNotification will handle duplicate checking and updating
  await addNotification(appNotification, userId);

  // Schedule immediate push notification only if permission granted
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

  // Use stable ID to prevent duplicates - addNotification will handle duplicate checking
  const notificationId = `budget-warning-${monthKey}`;
  
  // Get userId for user-specific notifications
  const userId = await AsyncStorage.getItem("userId");
  
  if (!userId) {
    console.warn("No userId available for budget notification");
    return;
  }

  // Create the AppNotification entry - addNotification will check for duplicates and update if exists
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

  // addNotification will handle duplicate checking and updating
  await addNotification(appNotification, userId);

  // Schedule immediate push notification only if permission granted
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

  // Use stable ID to prevent duplicates - addNotification will handle duplicate checking
  // Sanitize category name for use in ID (replace spaces and special chars)
  const sanitizedCategory = category.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const notificationId = `budget-category-${sanitizedCategory}-${monthKey}`;
  
  // Get userId for user-specific notifications
  const userId = await AsyncStorage.getItem("userId");
  
  if (!userId) {
    console.warn("No userId available for budget notification");
    return;
  }

  // Create the AppNotification entry - addNotification will check for duplicates and update if exists
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

  // addNotification will handle duplicate checking and updating
  await addNotification(appNotification, userId);

  // Schedule immediate push notification only if permission granted
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

