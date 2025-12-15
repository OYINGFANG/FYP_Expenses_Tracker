// app/utils/notificationStore.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const NOTIFICATIONS_KEY = "appNotifications";

export type AppNotification = {
  id: string; 
  type: "debtReminder" | "savingsReminder" | "budgetReminder" | "badgeAchievement";
  header?: string;
  title: string;
  body: string;
  createdAt: string; 
  read: boolean;
  debtId?: string; 
  goalId?: string;
  monthKey?: string;
  category?: string;
  badgeId?: string; // For badge achievement notifications
};

/**
 * Get all notifications from AsyncStorage
 */
export async function getNotifications(): Promise<AppNotification[]> {
  try {
    const data = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
    if (!data) return [];
    const notifications: AppNotification[] = JSON.parse(data);
    return notifications.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error("Error getting notifications:", error);
    return [];
  }
}

/**
 * Add a new notification to AsyncStorage
 */
export async function addNotification(n: AppNotification): Promise<void> {
  try {
    const existing = await getNotifications();
    // Check if notification with same ID already exists
    const exists = existing.some(notif => notif.id === n.id);
    if (exists) {
      // Update existing notification instead of duplicating
      const updated = existing.map(notif => notif.id === n.id ? n : notif);
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
    } else {
      // Add new notification
      existing.push(n);
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(existing));
    }
  } catch (error) {
    console.error("Error adding notification:", error);
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(): Promise<void> {
  try {
    const notifications = await getNotifications();
    const updated = notifications.map(n => ({ ...n, read: true }));
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Error marking notifications as read:", error);
  }
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications(): Promise<void> {
  try {
    await AsyncStorage.removeItem(NOTIFICATIONS_KEY);
  } catch (error) {
    console.error("Error clearing notifications:", error);
  }
}

/**
 * Mark a specific notification as read
 */
export async function markNotificationRead(id: string): Promise<void> {
  try {
    const notifications = await getNotifications();
    const updated = notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    );
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
}

/**
 * Delete a specific notification
 */
export async function deleteNotification(id: string): Promise<void> {
  try {
    const notifications = await getNotifications();
    const filtered = notifications.filter(n => n.id !== id);
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error("Error deleting notification:", error);
  }
}

