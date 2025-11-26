import React, { useEffect, useRef } from "react";
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

function formatCurrency(v?: string | number) {
  const n = typeof v === "string" ? parseFloat(v) : v ?? 0;
  if (!isFinite(n)) return "RM 0.00";
  return "RM " + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString([], { 
    day: "2-digit", 
    month: "short", 
    year: "numeric",
    hour: "2-digit", 
    minute: "2-digit",
    hour12: false 
  });
}

export default function AddRecordSuccess() {
  const router = useRouter();
  const params = useLocalSearchParams();

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
  const accent = isIncome ? "#10B981" : "#EF4444";

  // Simple scale animation for the checkmark
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push("/screen/Home")} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isIncome ? "Income" : "Expense"} Added
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Main Content - No ScrollView for compact design */}
      <View style={styles.content}>
        {/* Success Card */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Success Badge */}
          <View style={[styles.badge, { backgroundColor: accent }]}>
            <MaterialIcons name="check" size={48} color="#fff" />
          </View>

          {/* Success Message */}
          <Text style={styles.successTitle}>
            {isIncome ? "Income" : "Expense"} saved!
          </Text>

          {/* Amount */}
          <Text 
            style={styles.amount} 
            numberOfLines={1} 
            adjustsFontSizeToFit
          >
            {formatCurrency(amount)}
          </Text>

          {/* Details Grid */}
          <View style={styles.detailsGrid}>
            <DetailItem
              icon="pricetag-outline"
              label="Category"
              value={category || "—"}
            />
            <DetailItem
              icon="calendar-outline"
              label="Date"
              value={formatDateTime(dateISO)}
            />
            <DetailItem
              icon="card-outline"
              label="Payment"
              value={paymentMethod || "—"}
            />
            <DetailItem
              icon={isIncome ? "trending-up-outline" : "trending-down-outline"}
              label="Type"
              value={type}
            />
          </View>

          {/* Note if exists */}
          {!!note && (
            <View style={styles.noteContainer}>
              <Ionicons name="create-outline" size={16} color="#6B7280" />
              <Text style={styles.noteText} numberOfLines={2}>
                {note}
              </Text>
            </View>
          )}

          {/* Primary Button */}
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/screen/Home")}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>Back to Home</Text>
          </TouchableOpacity>

          {/* Secondary Buttons */}
          <View style={styles.secondaryBtnsRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.push("/screen/AddRecord")}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={20} color="#1F2937" />
              <Text style={styles.secondaryBtnText}>Add another</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.push("/screen/ExpensesDetail")}
              activeOpacity={0.7}
            >
              <Ionicons name="file-tray-full-outline" size={20} color="#1F2937" />
              <Text style={styles.secondaryBtnText}>View records</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailItem}>
      <View style={styles.detailHeader}>
        <Ionicons name={icon} size={20} color="#6B7280" />
        <Text style={styles.detailLabel}>{label}</Text>
      </View>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#D7E5DD",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: "#D7E5DD",
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1F2937",
    letterSpacing: 0.3,
  },

  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    padding: 28,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },

  // Success Badge
  badge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  successTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 12,
    letterSpacing: 0.2,
  },

  amount: {
    fontSize: 48,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 24,
    letterSpacing: -1,
  },

  // Details Grid
  detailsGrid: {
    width: "100%",
    backgroundColor: "#F8FAFB",
    borderRadius: 18,
    padding: 18,
    gap: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E9EB",
  },

  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },

  detailLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },

  detailValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "right",
    maxWidth: "50%",
  },

  // Note Container
  noteContainer: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#F8FAFB",
    padding: 14,
    borderRadius: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E9EB",
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    lineHeight: 20,
  },

  // Primary Button
  primaryBtn: {
    width: "100%",
    backgroundColor: "#1E4539",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 14,
    shadowColor: "#1E4539",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 17,
    letterSpacing: 0.5,
  },

  // Secondary Buttons
  secondaryBtnsRow: {
    flexDirection: "row",
    width: "100%",
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#D7E5DD",
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#C4D6CA",
  },
  secondaryBtnText: {
    color: "#1F2937",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.2,
  },
});