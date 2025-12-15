// app/screen/Notifications.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Swipeable, GestureHandlerRootView } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  getNotifications,
  markAllNotificationsRead,
  clearAllNotifications,
  markNotificationRead,
  deleteNotification,
  type AppNotification,
} from "../utils/notificationStore";

/* ---------- Brand / UI ---------- */
const BRAND_BG_GRADIENT = ["#1E5449", "#154C42", "#0F3D35"] as const;
const BRAND_DARK = "#1E3932";
const BRAND_GREEN = "#22C55E";
const CARD_BG = "#FFFFFF";
const MUTED = "#6B7280";
const RED = "#EF4444";
const ORANGE = "#F59E0B";
const BLUE = "#3B82F6";

/* ---------- Helpers ---------- */
const formatNotificationDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getNotificationIcon = (type: AppNotification["type"]) => {
  switch (type) {
    case "debtReminder":
      return "card-outline";
    case "savingsReminder":
      return "wallet-outline";
    case "budgetReminder":
      return "pie-chart-outline";
    case "badgeAchievement":
      return "trophy";
    default:
      return "notifications-outline";
  }
};

const getNotificationColor = (type: AppNotification["type"]) => {
  switch (type) {
    case "debtReminder":
      return RED;
    case "savingsReminder":
      return BRAND_GREEN;
    case "budgetReminder":
      return ORANGE;
    case "badgeAchievement":
      return BRAND_GREEN;
    default:
      return BLUE;
  }
};

/* ---------- Notification Item Component ---------- */
function NotificationItem({
  notification,
  onMarkRead,
  onDelete,
  onReload,
}: {
  notification: AppNotification;
  onMarkRead: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const icon = getNotificationIcon(notification.type);
  const color = getNotificationColor(notification.type);
  const swipeableRef = React.useRef<Swipeable>(null);

  // Render right actions (swipe left to reveal delete)
  const renderRightActions = () => {
    return (
      <TouchableOpacity
        style={styles.rightAction}
        onPress={async () => {
          swipeableRef.current?.close();
          await onDelete(notification.id);
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="trash" size={24} color="#fff" />
      </TouchableOpacity>
    );
  };

  // Render left actions (swipe right to reveal mark as read)
  const renderLeftActions = () => {
    return (
      <TouchableOpacity
        style={styles.leftAction}
        onPress={async () => {
          swipeableRef.current?.close();
          await onMarkRead(notification.id);
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="checkmark-done" size={24} color="#fff" />
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      rightThreshold={40}
      leftThreshold={40}
    >
      <View
        style={[
          styles.notificationCard,
          notification.read && styles.notificationCardRead,
        ]}
      >
        <View style={[styles.notificationIcon, { backgroundColor: color + "22" }]}>
          <Ionicons name={icon as any} size={20} color={color} />
        </View>
        <View style={styles.notificationContent}>
          {notification.header && (
            <Text style={styles.notificationHeader}>
              {notification.header}
            </Text>
          )}
          <Text
            style={[
              styles.notificationTitle,
              notification.read && styles.notificationTitleRead,
            ]}
          >
            {notification.title}
          </Text>
          <Text
            style={[
              styles.notificationBody,
              notification.read && styles.notificationBodyRead,
            ]}
          >
            {notification.body}
          </Text>
          <Text style={styles.notificationDate}>
            {formatNotificationDate(notification.createdAt)}
          </Text>
        </View>
      </View>
    </Swipeable>
  );
}

/* ---------- Filter Types ---------- */
type StatusFilter = "all" | "unread" | "read";
type TypeFilter = "all" | "debtReminder" | "savingsReminder" | "budgetReminder" | "badgeAchievement";

/* ---------- Main Screen ---------- */
export default function Notifications() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const notifs = await getNotifications();
      setNotifications(notifs);
    } catch (error) {
      console.error("Error loading notifications:", error);
      Alert.alert("Error", "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      await loadNotifications();
    } catch (error) {
      console.error("Error marking notifications as read:", error);
      Alert.alert("Error", "Failed to mark notifications as read.");
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear All Notifications",
      "Are you sure you want to clear all notifications? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear All",
          style: "destructive",
          onPress: async () => {
            try {
              await clearAllNotifications();
              await loadNotifications();
            } catch (error) {
              console.error("Error clearing notifications:", error);
              Alert.alert("Error", "Failed to clear notifications.");
            }
          },
        },
      ]
    );
  };

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      await loadNotifications();
    } catch (error) {
      console.error("Error marking notification as read:", error);
      Alert.alert("Error", "Failed to mark notification as read.");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteNotification(id);
      await loadNotifications();
    } catch (error) {
      console.error("Error deleting notification:", error);
      Alert.alert("Error", "Failed to delete notification.");
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Filter notifications based on selected filters
  const filteredNotifications = notifications.filter((notif) => {
    // Status filter
    if (statusFilter === "unread" && notif.read) return false;
    if (statusFilter === "read" && !notif.read) return false;

    // Type filter
    if (typeFilter !== "all" && notif.type !== typeFilter) return false;

    return true;
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient colors={BRAND_BG_GRADIENT} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
      </View>

      {/* Action Buttons */}
      {notifications.length > 0 && (
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            onPress={handleMarkAllRead}
            style={styles.actionButton}
            activeOpacity={0.7}
          >
            <Ionicons name="checkmark-done" size={18} color={BRAND_DARK} />
            <Text style={styles.actionButtonText}>Mark All Read</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleClearAll}
            style={[styles.actionButton, styles.actionButtonDanger]}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color={RED} />
            <Text style={[styles.actionButtonText, { color: RED }]}>
              Clear All
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Section */}
      {notifications.length > 0 && (
        <View style={styles.filterContainer}>
          {/* Status Filters */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Status:</Text>
            <View style={styles.filterChips}>
              <TouchableOpacity
                onPress={() => setStatusFilter("all")}
                style={[
                  styles.filterChip,
                  statusFilter === "all" && styles.filterChipActive,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    statusFilter === "all" && styles.filterChipTextActive,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStatusFilter("unread")}
                style={[
                  styles.filterChip,
                  statusFilter === "unread" && styles.filterChipActive,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    statusFilter === "unread" && styles.filterChipTextActive,
                  ]}
                >
                  Unread
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStatusFilter("read")}
                style={[
                  styles.filterChip,
                  statusFilter === "read" && styles.filterChipActive,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    statusFilter === "read" && styles.filterChipTextActive,
                  ]}
                >
                  Read
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Type Filters */}
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Type:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterChips}
            >
              <TouchableOpacity
                onPress={() => setTypeFilter("all")}
                style={[
                  styles.filterChip,
                  typeFilter === "all" && styles.filterChipActive,
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    typeFilter === "all" && styles.filterChipTextActive,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTypeFilter("debtReminder")}
                style={[
                  styles.filterChip,
                  typeFilter === "debtReminder" && styles.filterChipActive,
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="card-outline"
                  size={14}
                  color={
                    typeFilter === "debtReminder"
                      ? "#fff"
                      : BRAND_DARK
                  }
                />
                <Text
                  style={[
                    styles.filterChipText,
                    typeFilter === "debtReminder" &&
                      styles.filterChipTextActive,
                  ]}
                >
                  Debt
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTypeFilter("savingsReminder")}
                style={[
                  styles.filterChip,
                  typeFilter === "savingsReminder" && styles.filterChipActive,
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="wallet-outline"
                  size={14}
                  color={
                    typeFilter === "savingsReminder"
                      ? "#fff"
                      : BRAND_DARK
                  }
                />
                <Text
                  style={[
                    styles.filterChipText,
                    typeFilter === "savingsReminder" &&
                      styles.filterChipTextActive,
                  ]}
                >
                  Savings
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTypeFilter("budgetReminder")}
                style={[
                  styles.filterChip,
                  typeFilter === "budgetReminder" && styles.filterChipActive,
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="pie-chart-outline"
                  size={14}
                  color={
                    typeFilter === "budgetReminder"
                      ? "#fff"
                      : BRAND_DARK
                  }
                />
                <Text
                  style={[
                    styles.filterChipText,
                    typeFilter === "budgetReminder" &&
                      styles.filterChipTextActive,
                  ]}
                >
                  Budget
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setTypeFilter("badgeAchievement")}
                style={[
                  styles.filterChip,
                  typeFilter === "badgeAchievement" && styles.filterChipActive,
                ]}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="trophy"
                  size={14}
                  color={
                    typeFilter === "badgeAchievement"
                      ? "#fff"
                      : BRAND_DARK
                  }
                />
                <Text
                  style={[
                    styles.filterChipText,
                    typeFilter === "badgeAchievement" &&
                      styles.filterChipTextActive,
                  ]}
                >
                  Badges
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}

      {/* Notifications List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading notifications…</Text>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color={MUTED} />
          <Text style={styles.emptyTitle}>No notifications</Text>
          <Text style={styles.emptyText}>
            You are all caught up! New notifications will appear here.
          </Text>
        </View>
      ) : filteredNotifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="filter-outline" size={64} color={MUTED} />
          <Text style={styles.emptyTitle}>No notifications match your filters</Text>
          <Text style={styles.emptyText}>
            Try adjusting your filter options to see more notifications.
          </Text>
          <TouchableOpacity
            onPress={() => {
              setStatusFilter("all");
              setTypeFilter("all");
            }}
            style={styles.resetFilterButton}
            activeOpacity={0.7}
          >
            <Text style={styles.resetFilterButtonText}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          {unreadCount > 0 && statusFilter !== "read" && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>
                {filteredNotifications.filter((n) => !n.read).length} unread notification
                {filteredNotifications.filter((n) => !n.read).length !== 1 ? "s" : ""}
              </Text>
            </View>
          )}
          {filteredNotifications.map((notif) => (
            <NotificationItem
              key={notif.id}
              notification={notif}
              onMarkRead={handleMarkRead}
              onDelete={handleDelete}
              onReload={loadNotifications}
            />
          ))}
        </ScrollView>
      )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    pointerEvents: "none",
  },
  actionsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: CARD_BG,
    paddingVertical: 10,
    borderRadius: 12,
    ...shadow(2, 0.06),
  },
  actionButtonDanger: {
    backgroundColor: "#FFF1F2",
  },
  actionButtonText: {
    color: BRAND_DARK,
    fontWeight: "700",
    fontSize: 13,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#E5E7EB",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  unreadBadge: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    backgroundColor: ORANGE + "22",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ORANGE + "44",
  },
  unreadBadgeText: {
    color: ORANGE,
    fontWeight: "700",
    fontSize: 12,
    textAlign: "center",
  },
  notificationCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    ...shadow(2, 0.06),
  },
  notificationCardRead: {
    opacity: 0.7,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: BRAND_DARK,
    marginBottom: 4,
  },
  notificationTitleRead: {
    fontWeight: "600",
    color: MUTED,
  },
  notificationBody: {
    fontSize: 13,
    fontWeight: "600",
    color: BRAND_DARK,
    marginBottom: 6,
    lineHeight: 18,
  },
  notificationBodyRead: {
    fontWeight: "400",
    color: MUTED,
  },
  notificationDate: {
    fontSize: 11,
    fontWeight: "600",
    color: MUTED,
    marginTop: 2,
  },
  rightAction: {
    backgroundColor: RED,
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    marginBottom: 12,
    borderRadius: 16,
    marginRight: 16,
  },
  leftAction: {
    backgroundColor: BRAND_GREEN,
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    marginBottom: 12,
    borderRadius: 16,
    marginLeft: 16,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  filterLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "700",
    minWidth: 50,
  },
  filterChips: {
    flexDirection: "row",
    gap: 8,
    flex: 1,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  filterChipActive: {
    backgroundColor: CARD_BG,
    borderColor: CARD_BG,
  },
  filterChipText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: BRAND_DARK,
  },
  resetFilterButton: {
    marginTop: 16,
    backgroundColor: CARD_BG,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    ...shadow(2, 0.06),
  },
  resetFilterButtonText: {
    color: BRAND_DARK,
    fontSize: 14,
    fontWeight: "700",
  },
});

/* shadow helper */
function shadow(height: number, opacity: number) {
  return {
    shadowColor: "#000",
    shadowOffset: { width: 0, height },
    shadowOpacity: opacity,
    shadowRadius: height * 2,
    elevation: height + 2,
  };
}

