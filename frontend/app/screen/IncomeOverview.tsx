// IncomeOverview.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Modal,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import {
  subscribeUserIncomeRecords,
  type IncomeRecord,
} from "../utils/IncomeUtils";
import { getCurrentMonthKey } from "../utils/budgetUtils";
import { formatCurrency, subscribeUserCurrency, type Currency } from "../utils/currencyUtils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth } from "../../firebase";

/** ---------- Visual constants ---------- */
const BRAND_DARK = "#020617";
const BRAND_GREEN = "#16A34A";
const CARD_BG = "#FFFFFF";
const LINE_SOFT = "#E5E7EB";
const MUTED = "#6B7280";

/** ---------- Categories ---------- */
const INCOME_CATEGORY_ORDER = [
  "Salary",
  "Investment",
  "Gift",
  "Freelance",
  "Bonus",
  "Others",
] as const;

const INCOME_CATEGORY_COLORS: Record<(typeof INCOME_CATEGORY_ORDER)[number], string> = {
  Salary: "#22C55E",
  Investment: "#3B82F6",
  Gift: "#F97316",
  Freelance: "#8B5CF6",
  Bonus: "#EAB308",
  Others: "#9CA3AF",
};

const INCOME_CATEGORY_ICONS: Record<(typeof INCOME_CATEGORY_ORDER)[number], any> = {
  Salary: "briefcase",
  Investment: "trending-up",
  Gift: "gift",
  Freelance: "construct",
  Bonus: "ribbon",
  Others: "ellipse",
};

/** ---------- Payment methods ---------- */
const METHODS = ["All", "Cash", "Card", "Wallet", "Bank"] as const;

/** ---------- Helpers ---------- */

const monthKeyToLabel = (key: string) => {
  const [y, m] = key.split("-").map(Number);
  const date = new Date(y, (m || 1) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

const addMonths = (yyyymm: string, delta: number) => {
  const [y, m] = yyyymm.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const monthStartEndISO = (yyyymm: string) => {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(y, (m || 1) - 1, 1);
  const end = new Date(y, (m || 1), 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
};

const isoToHeader = (iso: string) => {
  const d = new Date(iso);
  const dow = d.toLocaleDateString("en-US", { weekday: "long" });
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  return `${month} ${String(day).padStart(2, "0")}, ${dow}`;
};

/** ---------- Small Chip ---------- */
function Chip({
  label,
  active,
  onPress,
  compact,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  compact?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.chip,
        compact && styles.chipCompact,
        active ? styles.chipActive : styles.chipInactive,
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

/** ---------- Row ---------- */
function IncomeRow({
  r,
  onPress,
  onLongPress,
  balanceAfter,
  currency,
}: {
  r: IncomeRecord;
  onPress?: () => void;
  onLongPress?: () => void;
  balanceAfter?: number;
  currency: Currency;
}) {
  const cat = (r.category && INCOME_CATEGORY_ORDER.includes(r.category as any)
    ? (r.category as (typeof INCOME_CATEGORY_ORDER)[number])
    : "Others") as (typeof INCOME_CATEGORY_ORDER)[number];

  const color = INCOME_CATEGORY_COLORS[cat];
  const icon = INCOME_CATEGORY_ICONS[cat];
  const amount = Number(r.amount) || 0;

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={0.7}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <View style={[styles.iconWrap, { backgroundColor: color + "15" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>

      <View style={styles.rowMid}>
        <Text style={styles.rowTitle}>{cat}</Text>
        {Boolean(r.description) && (
          <Text numberOfLines={1} style={styles.rowSub}>
            {r.description}
          </Text>
        )}
      </View>

      <View style={styles.rowRight}>
        <Text style={[styles.rowAmount, { color: BRAND_GREEN }]}>+{formatCurrency(amount, currency)}</Text>
        {typeof balanceAfter === "number" && (
          <Text style={styles.rowBalanceText}>Balance: {formatCurrency(balanceAfter, currency)}</Text>
        )}
        {Boolean(r.paymentMethod) && (
          <View style={styles.paymentBadge}>
            <Text style={styles.paymentText}>{r.paymentMethod}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

/** ---------- Main Screen ---------- */
export default function IncomeOverview() {
  const router = useRouter();

  const [monthKey, setMonthKey] = useState<string>(getCurrentMonthKey());
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [currency, setCurrency] = useState<Currency>("MYR");
  const [userId, setUserId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState<(typeof METHODS)[number]>("All");
  const [sort, setSort] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">(
    "date-desc"
  );

  const [openModal, setOpenModal] = useState(false);
  const [selected, setSelected] = useState<IncomeRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // Get userId and subscribe to currency
  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem("userId");
      const uid = stored || auth.currentUser?.uid || null;
      if (uid) {
        setUserId(uid);
        if (!stored) await AsyncStorage.setItem("userId", uid);
        const unsubCurrency = subscribeUserCurrency(uid, (curr) => {
          setCurrency(curr);
        });
        return () => {
          if (unsubCurrency) unsubCurrency();
        };
      }
    })();
  }, []);

  useEffect(() => {
    let unsubInc: (() => void) | null = null;
    (async () => {
      unsubInc = await subscribeUserIncomeRecords(setIncomes, console.error);
      setLoading(false);
    })();
    return () => {
      unsubInc?.();
    };
  }, []);

  const { startISO, endISO } = useMemo(() => monthStartEndISO(monthKey), [monthKey]);

  const monthIncomes = useMemo(
    () => incomes.filter((r) => r.dateISO >= startISO && r.dateISO < endISO),
    [incomes, startISO, endISO]
  );

  const totalIncome = useMemo(
    () => monthIncomes.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [monthIncomes]
  );

  /** ---------- Filters & sort ---------- */
  const filteredIncomes = useMemo(() => {
    let arr = [...monthIncomes];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter((r) => {
        const note = (r.description || "").toString().toLowerCase();
        const cat = (r.category || "").toString().toLowerCase();
        const pm = (r.paymentMethod || "").toString().toLowerCase();
        const amt = String(r.amount || "").toLowerCase();
        return note.includes(q) || cat.includes(q) || pm.includes(q) || amt.includes(q);
      });
    }

    if (selectedCats.size > 0) {
      arr = arr.filter((r) => selectedCats.has((r.category as string) || "Others"));
    }

    if (method !== "All") {
      arr = arr.filter((r) => (r.paymentMethod || "") === method);
    }

    switch (sort) {
      case "date-asc":
        arr.sort((a, b) => (a.dateISO > b.dateISO ? 1 : -1));
        break;
      case "amount-desc":
        arr.sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0));
        break;
      case "amount-asc":
        arr.sort((a, b) => (Number(a.amount) || 0) - (Number(b.amount) || 0));
        break;
      default:
        arr.sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
    }

    return arr;
  }, [monthIncomes, search, selectedCats, method, sort]);

  /** ---------- Running balance per income ---------- */
  const runningBalanceById = useMemo(() => {
    const sorted = [...filteredIncomes].sort((a, b) =>
      (a.dateISO || "").localeCompare(b.dateISO || "")
    );

    let cumulativeIncome = 0;
    const map: Record<string, number> = {};

    sorted.forEach((r) => {
      const amt = Number(r.amount) || 0;
      cumulativeIncome += amt;
      if (r.id) {
        map[r.id] = cumulativeIncome;
      }
    });

    return map;
  }, [filteredIncomes]);

  /** ---------- Grouped for list ---------- */
  const grouped = useMemo(() => {
    const byDay: Record<string, IncomeRecord[]> = {};
    filteredIncomes.forEach((r) => {
      const d = new Date(r.dateISO);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(d.getDate()).padStart(2, "0")}`;
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(r);
    });
    return Object.entries(byDay)
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([k, arr]) => ({
        dayKey: k,
        header: isoToHeader(arr[0].dateISO),
        items: arr,
        dayTotal: arr.reduce((s, r) => s + (Number(r.amount) || 0), 0),
      }));
  }, [filteredIncomes]);

  /** ---------- Actions ---------- */
  const toggleCat = (c: string) => {
    const next = new Set(selectedCats);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    setSelectedCats(next);
  };

  const clearFilters = () => {
    setSelectedCats(new Set());
    setMethod("All");
    setSearch("");
    setSort("date-desc");
  };

  const openRecord = (r: IncomeRecord) => {
    setSelected(r);
    setOpenModal(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={BRAND_GREEN} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {/* Top app bar */}
      <View style={styles.appBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.appBarIconBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={BRAND_DARK} />
        </TouchableOpacity>

        <View style={styles.appBarCenter}>
          <Text style={styles.appBarTitle}>Income</Text>
          <View style={styles.appBarMonthRow}>
            <TouchableOpacity
              onPress={() => setMonthKey((k) => addMonths(k, -1))}
              style={styles.monthArrowBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={14} color={MUTED} />
            </TouchableOpacity>

            <View style={styles.appBarMonth}>
              <Ionicons name="calendar-outline" size={14} color={MUTED} />
              <Text style={styles.appBarMonthText}>{monthKeyToLabel(monthKey)}</Text>
            </View>

            <TouchableOpacity
              onPress={() => setMonthKey((k) => addMonths(k, 1))}
              style={styles.monthArrowBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-forward" size={14} color={MUTED} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.appBarRight}>
          {/* Reserved for future actions */}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Summary */}
        <LinearGradient
          colors={["#ECFEFF", "#F0FDF4"]}
          style={styles.summaryCard}
        >
          <View style={styles.summaryHeaderRow}>
            <View>
              <Text style={styles.summaryLabel}>Total Income</Text>
              <Text style={styles.summaryValue}>{formatCurrency(totalIncome, currency)}</Text>
            </View>
            <View
              style={[
                styles.summaryPill,
                { backgroundColor: "rgba(22, 163, 74, 0.12)" },
              ]}
            >
              <Ionicons name="cash-outline" size={14} color={BRAND_GREEN} />
              <Text style={styles.summaryPillText}>This month</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Search & filters */}
        <View style={styles.filtersCard}>
          <View style={styles.searchRow}>
            <Ionicons name="search" size={16} color="#9CA3AF" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search amount, note, category..."
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
            />
            {!!(search || selectedCats.size || method !== "All" || sort !== "date-desc") && (
              <TouchableOpacity onPress={clearFilters} style={styles.clearBtn}>
                <Ionicons name="close-circle" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.filtersRow}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {METHODS.map((m) => (
                <Chip
                  key={m}
                  label={m}
                  active={method === m}
                  onPress={() => setMethod(m)}
                  compact
                />
              ))}
            </ScrollView>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryChipsRow}
          >
            {INCOME_CATEGORY_ORDER.map((c) => (
              <Chip
                key={c}
                label={c}
                active={selectedCats.has(c)}
                onPress={() => toggleCat(c)}
                compact
              />
            ))}
          </ScrollView>
        </View>

        {/* List */}
        <View style={styles.listContainer}>
          {grouped.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="wallet-outline" size={42} color="#9CA3AF" />
              </View>
              <Text style={styles.emptyTitle}>No income</Text>
              <Text style={styles.emptyText}>
                Add a new income record to see it here.
              </Text>
            </View>
          ) : (
            grouped.map((g) => (
              <View key={g.dayKey} style={styles.dayGroup}>
                <View style={styles.dayHeaderRow}>
                  <Text style={styles.dayHeaderText}>{g.header}</Text>
                  <View style={styles.dayTotalPill}>
                    <Text style={styles.dayTotalText}>+{formatCurrency(g.dayTotal, currency)}</Text>
                  </View>
                </View>
                {g.items.map((r) => (
                  <IncomeRow
                    key={r.id || r.dateISO + String(r.amount)}
                    r={r}
                    currency={currency}
                    balanceAfter={r.id ? runningBalanceById[r.id] : undefined}
                    onPress={() => openRecord(r)}
                    onLongPress={() => openRecord(r)}
                  />
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Floating Add button */}
      <TouchableOpacity
        activeOpacity={0.9}
        style={styles.fab}
        onPress={() => router.push("/screen/AddRecord")}
      >
        <LinearGradient colors={["#22C55E", "#16A34A"]} style={styles.fabGrad}>
          <Ionicons name="add" size={26} color="#ECFDF5" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Record modal */}
      <Modal
        visible={openModal}
        transparent
        animationType="slide"
        onRequestClose={() => setOpenModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Income details</Text>
              <TouchableOpacity onPress={() => setOpenModal(false)}>
                <Ionicons name="close" size={20} color={BRAND_DARK} />
              </TouchableOpacity>
            </View>

            {selected && (
              <>
                <View style={styles.modalBody}>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Date</Text>
                    <Text style={styles.modalValue}>
                      {new Date(selected.dateISO).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Category</Text>
                    <Text style={styles.modalValue}>{selected.category || "Others"}</Text>
                  </View>
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Amount</Text>
                    <Text style={[styles.modalValue, { color: BRAND_GREEN }]}>
                      +{formatCurrency(Number(selected.amount) || 0, currency)}
                    </Text>
                  </View>
                  {!!selected.paymentMethod && (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Method</Text>
                      <Text style={styles.modalValue}>{selected.paymentMethod}</Text>
                    </View>
                  )}
                  {!!selected.description && (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Note</Text>
                      <Text style={styles.modalValue}>{selected.description}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnPrimary]}
                    onPress={() => setOpenModal(false)}
                  >
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={[styles.modalBtnText, { color: "#fff" }]}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/** ---------- Styles ---------- */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  content: {
    paddingBottom: 120,
  },

  // App bar
  appBar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  appBarIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  appBarCenter: {
    flex: 1,
    alignItems: "center",
  },
  appBarTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: BRAND_DARK,
  },
  appBarMonthRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  monthArrowBtn: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E5E7EB",
  },
  appBarMonth: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#E5E7EB",
  },
  appBarMonthText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
  },
  appBarRight: {
    flexDirection: "row",
    gap: 8,
  },

  // Summary hero
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    padding: 18,
  },
  summaryHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    letterSpacing: 0.4,
  },
  summaryValue: {
    marginTop: 6,
    fontSize: 30,
    fontWeight: "900",
    color: BRAND_DARK,
    letterSpacing: -0.4,
  },
  summaryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  summaryPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: BRAND_GREEN,
  },

  // Filters
  filtersCard: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 18,
    backgroundColor: CARD_BG,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 8,
    color: BRAND_DARK,
  },
  clearBtn: {
    padding: 4,
  },
  filtersRow: {
    marginTop: 10,
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 8,
  },
  categoryChipsRow: {
    gap: 8,
    marginTop: 10,
  },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipCompact: { paddingVertical: 6 },
  chipInactive: { backgroundColor: "#fff", borderColor: LINE_SOFT },
  chipActive: { backgroundColor: BRAND_DARK, borderColor: BRAND_DARK },
  chipText: { fontSize: 12, fontWeight: "700", color: BRAND_DARK },
  chipTextActive: { color: "#fff" },

  // List
  listContainer: { marginTop: 16, marginHorizontal: 16, marginBottom: 8 },
  dayGroup: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  dayHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dayHeaderText: { fontSize: 14, fontWeight: "800", color: BRAND_DARK },
  dayTotalPill: {
    backgroundColor: "rgba(22, 163, 74, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  dayTotalText: { fontSize: 13, fontWeight: "800", color: BRAND_GREEN },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: LINE_SOFT + "60",
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowMid: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: "700", color: BRAND_DARK, marginBottom: 2 },
  rowSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  rowRight: { alignItems: "flex-end" },
  rowAmount: { fontSize: 14, fontWeight: "800" },
  rowBalanceText: { fontSize: 11, fontWeight: "600", color: MUTED, marginTop: 2 },
  paymentBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginTop: 2,
  },
  paymentText: { fontSize: 11, fontWeight: "600", color: MUTED },

  // Empty state
  emptyState: {
    marginTop: 32,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: BRAND_DARK, marginBottom: 4 },
  emptyText: { fontSize: 12, color: MUTED, textAlign: "center" },

  // FAB
  fab: {
    position: "absolute",
    right: 18,
    bottom: 24,
    shadowColor: "#22C55E",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  fabGrad: {
    width: 58,
    height: 58,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#DCFCE7",
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { fontSize: 16, fontWeight: "800", color: BRAND_DARK },
  modalBody: { marginTop: 10, gap: 10 },
  modalRow: { flexDirection: "row", justifyContent: "space-between" },
  modalLabel: { color: MUTED, fontWeight: "700" },
  modalValue: {
    color: BRAND_DARK,
    fontWeight: "700",
    maxWidth: "60%",
    textAlign: "right",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
    justifyContent: "flex-end",
  },
  modalBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalBtnPrimary: { backgroundColor: BRAND_DARK },
  modalBtnText: { fontWeight: "800" },
});