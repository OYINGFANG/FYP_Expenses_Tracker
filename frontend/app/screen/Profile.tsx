// app/screen/Profile.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import {
  doc,
  onSnapshot,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { db } from "../../firebase";

/** ---------- Types ---------- */
type UserProfile = {
  username?: string;
  user_email?: string;
  user_gender?: string;
  user_dob?: any; // Firestore Timestamp
  user_password?: string;
  phone?: string;
  currency?: "MYR" | "USD" | "SGD" | string;
  avatarUrl?: string;
  defaultPaymentMethod?: "Cash" | "Bank" | "Credit Card" | "E-Wallet";
  created_at?: any; // Firestore Timestamp
  updated_at?: any; // Firestore Timestamp
};

type ExpenseDoc = {
  exp_id: string;
  user_id: string;
  exp_category: string;
  exp_payment_method: string;
  exp_total: number;
  exp_notes: string;
  exp_date: string;
  created_at: string;
  updated_at: string;
};

type FinancialStats = {
  monthSpend: number;
  lastTxAmount: number;
  lastTxDate: string;
  avgDailySpend: number;
  totalTransactions: number;
  topCategory: string;
  weekSpend: number;
};

/** ---------- Helpers ---------- */
function getUidAndPath(userIdFromStorage: string | null): {
  uid: string | null;
  userPath: string | null;
} {
  if (!userIdFromStorage) return { uid: null, userPath: null };
  const parts = userIdFromStorage.split("/");
  const looksLikePath = parts.length >= 3 && parts[1] === "USERS";
  const uid = looksLikePath ? parts[2] : userIdFromStorage;
  const userPath = `/USERS/${uid}`;
  return { uid, userPath };
}

function formatTimestamp(timestamp: any): string {
  if (!timestamp) return "—";
  try {
    // Handle Firestore Timestamp
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (e) {
    return "—";
  }
}

function calculateAge(dob: any): number | null {
  if (!dob) return null;
  try {
    const birthDate = dob.toDate ? dob.toDate() : new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  } catch (e) {
    return null;
  }
}

/** ---------- Edit Modal ---------- */
function useEditModal() {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [initial, setInitial] = useState("");
  const [value, setValue] = useState("");
  const [onSave, setOnSave] = useState<((v: string) => void) | null>(null);

  const open = (t: string, init: string, save: (v: string) => void) => {
    setTitle(t);
    setInitial(init);
    setValue(init);
    setOnSave(() => save);
    setVisible(true);
  };

  const close = () => setVisible(false);

  const ModalUI = (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={close}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={close} hitSlop={8}>
              <Ionicons name="close-circle" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={initial || "Enter value"}
            placeholderTextColor="#9CA3AF"
            style={styles.modalInput}
            autoFocus
          />
          <TouchableOpacity
            style={styles.modalSaveBtn}
            onPress={() => {
              onSave?.(value.trim());
              close();
            }}
          >
            <Text style={styles.modalSaveBtnText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return { open, ModalUI };
}

/** ---------- Screen ---------- */
export default function ProfileScreen() {
  const router = useRouter();

  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<FinancialStats>({
    monthSpend: 0,
    lastTxAmount: 0,
    lastTxDate: "",
    avgDailySpend: 0,
    totalTransactions: 0,
    topCategory: "—",
    weekSpend: 0,
  });

  const editModal = useEditModal();

  const monthBounds = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { startISO: start.toISOString(), nextISO: next.toISOString() };
  }, []);

  const weekBounds = useMemo(() => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    weekStart.setHours(0, 0, 0, 0);
    return { startISO: weekStart.toISOString() };
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem("userId");
      const { uid: extractedUid, userPath } = getUidAndPath(stored);

      if (!extractedUid || !userPath) {
        Alert.alert("Error", "User not found");
        setLoading(false);
        return;
      }
      setUid(extractedUid);

      // Subscribe: profile
      const unsubProfile = onSnapshot(doc(db, "USERS", extractedUid), (snap) => {
        setProfile((snap.data() as UserProfile) ?? null);
        setLoading(false);
      });

      // Subscribe: month expenses
      const monthQ = query(
        collection(db, "EXPENSES"),
        where("user_id", "==", userPath),
        where("exp_date", ">=", monthBounds.startISO),
        where("exp_date", "<", monthBounds.nextISO)
      );
      
      const unsubMonth = onSnapshot(monthQ, (snap) => {
        const expenses = snap.docs.map((d) => d.data() as ExpenseDoc);
        
        const sum = expenses.reduce((acc, dt) => {
          const v = typeof dt.exp_total === "number" ? dt.exp_total : Number(dt.exp_total);
          return acc + (Number.isFinite(v) ? v : 0);
        }, 0);

        // Calculate category frequency
        const categoryCount: Record<string, number> = {};
        expenses.forEach((exp) => {
          categoryCount[exp.exp_category] = (categoryCount[exp.exp_category] || 0) + 1;
        });
        
        const topCat = Object.keys(categoryCount).length > 0
          ? Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0][0]
          : "—";

        // Days in month so far
        const now = new Date();
        const daysInMonth = now.getDate();
        const avgDaily = daysInMonth > 0 ? sum / daysInMonth : 0;

        setStats((prev) => ({
          ...prev,
          monthSpend: sum,
          avgDailySpend: avgDaily,
          totalTransactions: expenses.length,
          topCategory: topCat,
        }));
      });

      // Subscribe: week expenses
      const weekQ = query(
        collection(db, "EXPENSES"),
        where("user_id", "==", userPath),
        where("exp_date", ">=", weekBounds.startISO)
      );
      
      const unsubWeek = onSnapshot(weekQ, (snap) => {
        const weekSum = snap.docs.reduce((acc, d) => {
          const dt = d.data() as ExpenseDoc;
          const v = typeof dt.exp_total === "number" ? dt.exp_total : Number(dt.exp_total);
          return acc + (Number.isFinite(v) ? v : 0);
        }, 0);
        
        setStats((prev) => ({ ...prev, weekSpend: weekSum }));
      });

      // Subscribe: last transaction
      const lastTxQ = query(
        collection(db, "EXPENSES"),
        where("user_id", "==", userPath),
        orderBy("exp_date", "desc"),
        limit(1)
      );
      
      const unsubLast = onSnapshot(lastTxQ, (snap) => {
        if (snap.docs[0]) {
          const lastDoc = snap.docs[0].data() as ExpenseDoc;
          setStats((prev) => ({
            ...prev,
            lastTxAmount: Number(lastDoc.exp_total),
            lastTxDate: lastDoc.exp_date,
          }));
        }
      });

      return () => {
        unsubProfile();
        unsubMonth();
        unsubWeek();
        unsubLast();
      };
    })();
  }, [monthBounds.nextISO, monthBounds.startISO, weekBounds.startISO]);

  const updateProfile = async (patch: Partial<UserProfile>) => {
    if (!uid) return;
    setSaving(true);
    try {
      const refDoc = doc(db, "USERS", uid);
      await updateDoc(refDoc, {
        ...patch,
        updated_at: new Date(),
      });
    } catch (e) {
      console.error(e);
      Alert.alert("Update failed", "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1E3932" />
          <Text style={styles.loadingText}>Loading profile…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const currency = profile?.currency || "MYR";
  const joined = formatTimestamp(profile?.created_at);
  const age = calculateAge(profile?.user_dob);
  const memberDays = profile?.created_at 
    ? Math.floor((new Date().getTime() - (profile.created_at.toDate ? profile.created_at.toDate().getTime() : new Date(profile.created_at).getTime())) / (1000 * 60 * 60 * 24))
    : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>My Profile</Text>
            <Text style={styles.headerSubtitle}>Manage your account</Text>
          </View>
          <TouchableOpacity 
            onPress={() => router.push("/screen/Home")} 
            style={styles.closeBtn}
            hitSlop={8}
          >
            <Ionicons name="close" size={24} color="#1E3932" />
          </TouchableOpacity>
        </View>

        {/* Profile Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroGradient}>
            <View style={styles.avatarSection}>
              <View style={styles.avatarContainer}>
                <Image
                  source={{
                    uri:
                      profile?.avatarUrl ||
                      `https://ui-avatars.com/api/?background=C9EAD6&color=1E3932&name=${encodeURIComponent(
                        profile?.username || "User"
                      )}&size=120&bold=true`,
                  }}
                  style={styles.avatar}
                />
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={28} color="#10B981" />
                </View>
              </View>
              
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{profile?.username || "Your Name"}</Text>
                <Text style={styles.profileEmail}>{profile?.user_email || "you@example.com"}</Text>
                
                <View style={styles.badgesRow}>
                  {age && (
                    <View style={styles.infoBadge}>
                      <Ionicons name="calendar-outline" size={12} color="#1E3932" />
                      <Text style={styles.badgeText}>{age} years old</Text>
                    </View>
                  )}
                  {profile?.user_gender && (
                    <View style={styles.infoBadge}>
                      <Ionicons name="person-outline" size={12} color="#1E3932" />
                      <Text style={styles.badgeText}>{profile.user_gender}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.joinedBadge}>
                  <Ionicons name="star" size={14} color="#F59E0B" />
                  <Text style={styles.joinedText}>Member for {memberDays} days • Since {joined}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Financial Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Financial Overview</Text>
          
          {/* Primary Stats */}
          <View style={styles.primaryStatsGrid}>
            <View style={styles.primaryStatCard}>
              <View style={styles.statIconBox}>
                <Ionicons name="trending-up" size={24} color="#1E3932" />
              </View>
              <Text style={styles.statLabel}>This Month</Text>
              <Text style={styles.statValue}>RM {stats.monthSpend.toFixed(2)}</Text>
              <Text style={styles.statSubtext}>
                ~RM {stats.avgDailySpend.toFixed(2)}/day
              </Text>
            </View>

            <View style={styles.primaryStatCard}>
              <View style={[styles.statIconBox, { backgroundColor: "#FEF3C7" }]}>
                <Ionicons name="calendar-outline" size={24} color="#D97706" />
              </View>
              <Text style={styles.statLabel}>This Week</Text>
              <Text style={styles.statValue}>RM {stats.weekSpend.toFixed(2)}</Text>
              <Text style={styles.statSubtext}>{stats.totalTransactions} transactions</Text>
            </View>
          </View>

          {/* Secondary Stats */}
          <View style={styles.secondaryStatsRow}>
            <View style={styles.secondaryStatCard}>
              <View style={styles.statRow}>
                <View style={[styles.miniIconBox, { backgroundColor: "#EDE9FE" }]}>
                  <Ionicons name="receipt" size={16} color="#8B5CF6" />
                </View>
                <View style={styles.statContent}>
                  <Text style={styles.miniStatLabel}>Last Transaction</Text>
                  <Text style={styles.miniStatValue}>
                    {stats.lastTxAmount > 0 ? `RM ${stats.lastTxAmount.toFixed(2)}` : "—"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.secondaryStatCard}>
              <View style={styles.statRow}>
                <View style={[styles.miniIconBox, { backgroundColor: "#D1FAE5" }]}>
                  <Ionicons name="bar-chart" size={16} color="#059669" />
                </View>
                <View style={styles.statContent}>
                  <Text style={styles.miniStatLabel}>Top Category</Text>
                  <Text style={styles.miniStatValue}>{stats.topCategory}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Account Settings */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          
          <View style={styles.settingsCard}>
            <SettingItem
              icon="person-outline"
              iconBg="#D1FAE5"
              iconColor="#1E3932"
              label="Username"
              value={profile?.username || "Not set"}
              onPress={() =>
                editModal.open("Username", profile?.username || "", (v) =>
                  updateProfile({ username: v })
                )
              }
            />
            <Divider />
            <SettingItem
              icon="call-outline"
              iconBg="#FEF3C7"
              iconColor="#D97706"
              label="Phone Number"
              value={profile?.phone || "Not set"}
              onPress={() =>
                editModal.open("Phone Number", profile?.phone || "", (v) =>
                  updateProfile({ phone: v })
                )
              }
            />
            <Divider />
            <SettingItem
              icon="mail-outline"
              iconBg="#E0E7FF"
              iconColor="#6366F1"
              label="Email Address"
              value={profile?.user_email || "—"}
              disabled
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.actionCard}>
            <View style={[styles.actionIconBox, { backgroundColor: "#E0E7FF" }]}>
              <Ionicons name="settings-outline" size={22} color="#6366F1" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>App Settings</Text>
              <Text style={styles.actionSubtext}>Manage app preferences</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <View style={[styles.actionIconBox, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="help-circle-outline" size={22} color="#D97706" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Help & Support</Text>
              <Text style={styles.actionSubtext}>Get assistance</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <View style={styles.logoutSection}>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={async () => {
              Alert.alert(
                "Sign Out",
                "Are you sure you want to sign out?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Sign Out",
                    style: "destructive",
                    onPress: async () => {
                      await AsyncStorage.multiRemove([
                        "loggedIn",
                        "userId",
                        "userEmail",
                        "token",
                      ]);
                      router.replace("/screen/SignIn");
                    },
                  },
                ],
                { cancelable: true }
              );
            }}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {saving && (
          <View style={styles.savingIndicator}>
            <ActivityIndicator size="small" color="#1E3932" />
            <Text style={styles.savingText}>Saving changes…</Text>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {editModal.ModalUI}
    </SafeAreaView>
  );
}

/** ---------- Components ---------- */
function SettingItem({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  onPress,
  disabled,
}: {
  icon: any;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.7}
      disabled={disabled}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingLabel}>{label}</Text>
          <Text style={[styles.settingValue, disabled && { opacity: 0.5 }]} numberOfLines={1}>
            {value}
          </Text>
        </View>
      </View>
      {!disabled && <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />}
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

/** ---------- Styles ---------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#E4F2ED" },
  scroll: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { 
    color: "#1E3932", 
    marginTop: 12, 
    fontWeight: "600",
    fontSize: 16 
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1E3932",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
    fontWeight: "500",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  // Hero Card
  heroCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  heroGradient: {
    backgroundColor: "#1E3932",
    padding: 20,
  },
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarContainer: {
    position: "relative",
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#C9EAD6",
    borderWidth: 3,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  verifiedBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 13,
    color: "#C9EAD6",
    fontWeight: "500",
    marginBottom: 10,
  },
  badgesRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  infoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#C9EAD6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    color: "#1E3932",
    fontWeight: "700",
  },
  joinedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  joinedText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "600",
  },

  // Stats Section
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E3932",
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  primaryStatsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  primaryStatCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  statIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#D1FAE5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1E3932",
    marginBottom: 4,
  },
  statSubtext: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  secondaryStatsRow: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryStatCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    ...Platform.select({
      android: {
        elevation: 2,
      },
    }),
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  miniIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  statContent: {
    flex: 1,
  },
  miniStatLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 2,
  },
  miniStatValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E3932",
  },

  // Settings Section
  settingsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  settingsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "600",
    marginBottom: 3,
  },
  settingValue: {
    fontSize: 15,
    color: "#1E3932",
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginLeft: 68,
  },

  // Actions
  actionsSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 10,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 14,
    ...Platform.select({
      android: {
        elevation: 2,
      },
    }),
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E3932",
    marginBottom: 2,
  },
  actionSubtext: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },

  // Logout
  logoutSection: {
    paddingHorizontal: 20,
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FEF2F2",
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FEE2E2",
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#EF4444",
  },

  // Saving Indicator
  savingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  savingText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E3932",
  },
  modalInput: {
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: "600",
    color: "#1E3932",
    backgroundColor: "#F9FAFB",
    marginBottom: 16,
  },
  modalSaveBtn: {
    backgroundColor: "#1E3932",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  modalSaveBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});