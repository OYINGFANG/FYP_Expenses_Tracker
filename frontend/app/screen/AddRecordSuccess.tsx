import React, { useEffect, useRef, useState } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { subscribeUserCurrency, getCachedCurrency, formatCurrency as formatCurrencyUtil, type Currency } from "../utils/currencyUtils";

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();

  if (isToday) {
    return "Today • " + d.toLocaleString("en-MY", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  return d.toLocaleString("en-MY", { 
    day: "numeric",
    month: "short", 
    hour: "2-digit", 
    minute: "2-digit",
    hour12: true,
  });
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value?: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLeft}>
        <View style={styles.detailIconContainer}>
          <Ionicons name={icon} size={18} color="#1E3932" />
        </View>
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value?.trim() ? value : "—"}
      </Text>
    </View>
  );
}

export default function AddRecordSuccess() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [currency, setCurrency] = useState<Currency>("MYR");

  const getParam = (key: string): string | undefined => {
    const val = (params as any)[key];
    if (Array.isArray(val)) return val[0];
    return val ?? undefined;
  };

  const amount = getParam("amount");
  const category = getParam("category");
  const type = (getParam("type") || "Expenses") as "Expenses" | "Income";
  const paymentMethod = getParam("paymentMethod");
  const dateISO = getParam("date");
  const note = getParam("note");

  const isIncome = type === "Income";
  
  // Load user's currency preference
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const loadCurrency = async () => {
      try {
        // First try to get cached currency for immediate display
        const cachedCurrency = await getCachedCurrency();
        setCurrency(cachedCurrency);

        // Then subscribe to Firestore for real-time updates
        const userId = await AsyncStorage.getItem("userId");
        if (userId) {
          // Extract UID if it's a path (handle both "/USERS/uid" and "uid" formats)
          const parts = userId.split("/");
          const uid = userId.startsWith("/USERS/") && parts.length >= 3 ? parts[2] : userId;
          unsubscribe = subscribeUserCurrency(uid, (newCurrency) => {
            setCurrency(newCurrency);
          });
        }
      } catch (error) {
        console.error("Error loading currency:", error);
        // Default to MYR if there's an error
        setCurrency("MYR");
      }
    };

    loadCurrency();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Animations
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const checkScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 9,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(150),
        Animated.spring(checkScale, {
          toValue: 1,
          tension: 120,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const successColor = isIncome ? "#22C55E" : "#1E3932";
  const gradientColors: readonly [string, string, ...string[]] = isIncome
    ? ["#D1FAE5", "#A7F3D0"]
    : ["#FEE2E2", "#FECACA"];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.push("/screen/Home")}
            style={styles.backBtn}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color="#1E3932" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
          {/* Success Icon */}
        <Animated.View
          style={[
              styles.successContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
            <Animated.View
              style={[
                styles.checkCircle,
                {
                  backgroundColor: successColor,
                  transform: [{ scale: checkScale }],
                },
              ]}
            >
              <Ionicons name="checkmark" size={40} color="#fff" />
            </Animated.View>
            <Text style={styles.successTitle}>
              {isIncome ? "Income" : "Expense"} Recorded!
            </Text>
            <Text style={styles.successSubtitle}>
              Your transaction has been saved successfully
          </Text>
        </Animated.View>

          {/* Amount Card */}
        <Animated.View
          style={[
            styles.amountCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
            <LinearGradient
              colors={gradientColors}
              style={styles.amountCardGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={[styles.amountValue, { color: isIncome ? "#1E3932" : "#DC2626" }]}>
                {formatCurrencyUtil(parseFloat(amount || "0") || 0, currency)}
            </Text>
            </LinearGradient>
        </Animated.View>

        {/* Details Card */}
        <Animated.View
          style={[
            styles.detailsCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.detailsTitle}>Transaction Details</Text>
          
          <DetailRow
            icon="calendar-outline"
            label="Date & Time"
            value={formatDateTime(dateISO)}
          />

            <DetailRow
              icon="pricetag-outline"
              label="Category"
              value={category}
            />
          
          <DetailRow
            icon="card-outline"
            label="Payment Method"
              value={paymentMethod}
          />

            {note && note.trim() && (
            <View style={styles.noteSection}>
              <View style={styles.noteHeader}>
                  <Ionicons name="document-text-outline" size={18} color="#1E3932" />
                <Text style={styles.noteLabel}>Note</Text>
              </View>
              <Text style={styles.noteText}>{note}</Text>
            </View>
          )}
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View
          style={[
            styles.actionsContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/screen/Home")}
            activeOpacity={0.8}
          >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.primaryBtnText}>Done</Text>
          </TouchableOpacity>

          <View style={styles.secondaryBtns}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.push("/screen/AddRecord")}
              activeOpacity={0.7}
            >
                <Ionicons name="add-circle-outline" size={18} color="#1E3932" />
              <Text style={styles.secondaryBtnText}>Add Another</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.push(isIncome ? "/screen/IncomeDetail" : "/screen/ExpensesDetail")}
              activeOpacity={0.7}
            >
                <Ionicons name="list-outline" size={18} color="#1E3932" />
              <Text style={styles.secondaryBtnText}>View All</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F0F5F3",
  },
  container: {
    flex: 1,
    backgroundColor: "#F0F5F3",
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  successContainer: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#22C55E",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1E3932",
    marginBottom: 4,
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
    textAlign: "center",
  },
  amountCard: {
    borderRadius: 10,
    marginBottom: 15,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  amountCardGradient: {
    padding: 10,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  amountValue: {
    fontSize: 35,
    fontWeight: "900",
    color: "#1E3932",
    letterSpacing: -1,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  detailsCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E3932",
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  detailLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  detailIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E3932",
    textAlign: "right",
    maxWidth: "50%",
  },
  noteSection: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  noteHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  noteLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E3932",
  },
  noteText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#4B5563",
    lineHeight: 18,
  },
  actionsContainer: {
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: "#1E3932",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 10,
    gap: 8,
    shadowColor: "#1E3932",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryBtns: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fff",
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  secondaryBtnText: {
    color: "#1E3932",
    fontWeight: "700",
    fontSize: 14,
  },
});
