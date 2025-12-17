// app/utils/badgeNotificationUtils.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { addNotification, type AppNotification } from "./notificationStore";
import type { SavingsBadge } from "./SavingsUtils";

/**
 * Create and add a notification when a badge is earned
 */
export async function createBadgeNotification(badge: SavingsBadge): Promise<void> {
  try {
    // Get userId for user-specific notifications
    const userId = await AsyncStorage.getItem("userId");
    
    const notification: AppNotification = {
      id: `badge_${badge.id}_${Date.now()}`,
      type: "badgeAchievement",
      title: "🎉 Achievement Unlocked!",
      body: `You earned the "${badge.title}" badge: ${badge.description}`,
      createdAt: new Date().toISOString(),
      read: false,
      badgeId: badge.id,
    };

    await addNotification(notification, userId);
  } catch (error) {
    console.error("Error creating badge notification:", error);
  }
}

/**
 * Create notifications for multiple badges earned
 */
export async function createBadgeNotifications(badges: SavingsBadge[]): Promise<void> {
  try {
    // Create notifications for each badge
    await Promise.all(badges.map((badge) => createBadgeNotification(badge)));
  } catch (error) {
    console.error("Error creating badge notifications:", error);
  }
}

