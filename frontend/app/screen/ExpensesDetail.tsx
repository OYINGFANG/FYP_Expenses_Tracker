import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";

import {
  subscribeUserExpenseRecords,
  type ExpenseRecord,
} from "../utils/ExpensesUtils";
import {
  subscribeUserIncomeRecords,
  type IncomeRecord,
} from "../utils/IncomeUtils";
import { getCurrentMonthKey } from "../utils/budgetUtils";

/** ---------- Visual constants ---------- */
const BRAND_DARK = "#020617";
const BRAND_GREEN = "#16A34A";
const CARD_BG = "#FFFFFF";
const LINE_SOFT = "#E5E7EB";
const RED = "#EF4444";
const MUTED = "#6B7280";
const ACCENT_PURPLE = "#8B5CF6";

/** ---------- Categories ---------- */
const CATEGORY_ORDER = [
  "Food",
  "Transport",
  "Housing",
  "Shopping",
  "Bills",
  "Entertainment",
  "Healthcare",
  "Education",
  "Savings",
  "Others",
] as const;

const CATEGORY_COLORS: Record<(typeof CATEGORY_ORDER)[number], string> = {
  Food: "#FF6B6B",
  Transport: "#4ECDC4",
  Housing: "#FFD93D",
  Shopping: "#95E1D3",
  Bills: "#6C5CE7",
  Entertainment: "#A29BFE",
  Healthcare: "#74B9FF",
  Education: "#FD79A8",
  Savings: "#FDCB6E",
  Others: "#B2BEC3",
};

const CATEGORY_ICONS: Record<(typeof CATEGORY_ORDER)[number], any> = {
  Food: "restaurant",
  Transport: "car",
  Housing: "home",
  Shopping: "cart",
  Bills: "receipt",
  Entertainment: "game-controller",
  Healthcare: "medical",
  Education: "school",
  Savings: "wallet",
  Others: "ellipsis-horizontal",
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
const fmtRM = (n: number) =>
  `RM ${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
const isoToHeader = (iso: string) => {
  const d = new Date(iso);
  const dow = d.toLocaleDateString("en-US", { weekday: "long" });
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  return `${month} ${String(day).padStart(2, "0")}, ${dow}`;
};
const makeCSV = (rows: ExpenseRecord[]) => {
  const header = "date,category,amount,paymentMethod,note\n";
  const body = rows
    .map((r) => {
      const d = new Date(r.dateISO || Date.now()).toISOString().slice(0, 10);
      const cat = (r.category as string) || "Others";
      const amt = Number(r.amount) || 0;
      const pm = (r as any).paymentMethod || "";
      const note = ((r as any).note || "").toString().replace(/,/g, " ");
      return `${d},${cat},${amt},${pm},${note}`;
    })
    .join("\n");
  return header + body;
};

/** ---------- Reusable small UI ---------- */
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
function Row({
  r,
  onPress,
  onLongPress,
  balanceAfter,
}: {
  r: ExpenseRecord;
  onPress?: () => void;
  onLongPress?: () => void;
  balanceAfter?: number;
}) {
  const cat = (r.category && CATEGORY_ORDER.includes(r.category as any)
    ? (r.category as (typeof CATEGORY_ORDER)[number])
    : "Others") as (typeof CATEGORY_ORDER)[number];

  const color = CATEGORY_COLORS[cat];
  const icon = CATEGORY_ICONS[cat];
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
        {Boolean((r as any).note) && (
          <Text numberOfLines={1} style={styles.rowSub}>
            {(r as any).note}
          </Text>
        )}
      </View>

      <View style={styles.rowRight}>
        <Text style={[styles.rowAmount, { color: RED }]}>-{fmtRM(amount)}</Text>
        {typeof balanceAfter === "number" && (
          <Text style={styles.rowBalanceText}>Balance: {fmtRM(balanceAfter)}</Text>
        )}
        {Boolean((r as any).paymentMethod) && (
          <View style={styles.paymentBadge}>
            <Text style={styles.paymentText}>{(r as any).paymentMethod}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

/** ---------- Category Breakdown ---------- */
function CategoryBreakdown({ expenses }: { expenses: ExpenseRecord[] }) {
  const categoryData = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach((r) => {
      const cat = (r.category && CATEGORY_ORDER.includes(r.category as any)
        ? r.category
        : "Others") as string;
      totals[cat] = (totals[cat] || 0) + (Number(r.amount) || 0);
    });

    const total = Object.values(totals).reduce((s, v) => s + v, 0);
    return Object.entries(totals)
      .map(([cat, amt]) => ({
        category: cat as (typeof CATEGORY_ORDER)[number],
        amount: amt,
        percentage: total > 0 ? (amt / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [expenses]);

  if (!categoryData.length) return null;

  return (
    <View style={styles.categoryCard}>
      <View style={styles.cardHeader}>
        <Ionicons name="pie-chart" size={18} color={BRAND_DARK} />
        <Text style={styles.cardTitle}>Top Spending Categories</Text>
      </View>

      {categoryData.map((item, idx) => {
        const color = CATEGORY_COLORS[item.category];
        return (
          <View key={item.category} style={styles.categoryRow}>
            <View style={styles.categoryLeft}>
              <View style={[styles.categoryDot, { backgroundColor: color }]} />
              <Text style={styles.categoryName}>{item.category}</Text>
            </View>
            <View style={styles.categoryRight}>
              <Text style={styles.categoryAmount}>{fmtRM(item.amount)}</Text>
              <Text style={styles.categoryPercent}>{item.percentage.toFixed(1)}%</Text>
            </View>
            {idx < categoryData.length - 1 && <View style={styles.categoryDivider} />}
          </View>
        );
      })}
    </View>
  );
}

/** ---------- Spending Insights ---------- */
function SpendingInsights({
  expenses,
  monthKey,
}: {
  expenses: ExpenseRecord[];
  monthKey: string;
}) {
  const insights = useMemo(() => {
    if (expenses.length === 0) return null;

    const total = expenses.reduce((s, r) => s + (Number(r.amount) || 0), 0);

    const [y, m] = monthKey.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const avgPerDay = daysInMonth ? total / daysInMonth : 0;

    const byDay: Record<string, number> = {};
    expenses.forEach((r) => {
      const d = new Date(r.dateISO);
      const key = `${d.getDate()}`;
      byDay[key] = (byDay[key] || 0) + (Number(r.amount) || 0);
    });

    const entries = Object.entries(byDay);
    const maxDay = entries.sort((a, b) => b[1] - a[1])[0];

    return {
      avgPerDay,
      highestDay: maxDay ? { day: maxDay[0], amount: maxDay[1] } : null,
      transactionCount: expenses.length,
      total,
    };
  }, [expenses, monthKey]);

  if (!insights) return null;

  return (
    <View style={styles.insightsCard}>
      <View style={styles.cardHeader}>
        <Ionicons name="bulb" size={18} color={ACCENT_PURPLE} />
        <Text style={[styles.cardTitle, { color: ACCENT_PURPLE }]}>Spending Insights</Text>
      </View>

      <View style={styles.insightsGrid}>
        <View style={styles.insightItem}>
          <Text style={styles.insightLabel}>Daily Average</Text>
          <Text style={styles.insightValue}>{fmtRM(insights.avgPerDay)}</Text>
        </View>
        <View style={styles.insightItem}>
          <Text style={styles.insightLabel}>Transactions</Text>
          <Text style={styles.insightValue}>{insights.transactionCount}</Text>
        </View>
        <View style={styles.insightItem}>
          <Text style={styles.insightLabel}>Total Spent</Text>
          <Text style={styles.insightValue}>{fmtRM(insights.total)}</Text>
        </View>
      </View>

      {insights.highestDay && (
        <View style={styles.insightHighlight}>
          <View style={styles.insightHighlightRow}>
            <Ionicons name="trending-up" size={16} color={RED} />
            <Text style={styles.insightHighlightText}>
              Highest spending on day {insights.highestDay.day}:{" "}
              {fmtRM(insights.highestDay.amount)}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

/** ---------- Main Screen ---------- */
export default function ExpensesDetail() {
  const router = useRouter();

  const [monthKey, setMonthKey] = useState<string>(getCurrentMonthKey());
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);

  const [viewMode, setViewMode] = useState<"list" | "insights">("list");
  const [search, setSearch] = useState("");
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [method, setMethod] = useState<(typeof METHODS)[number]>("All");
  const [sort, setSort] = useState<"date-desc" | "date-asc" | "amount-desc" | "amount-asc">(
    "date-desc"
  );

  const [openModal, setOpenModal] = useState(false);
  const [selected, setSelected] = useState<ExpenseRecord | null>(null);

  useEffect(() => {
    let unsubExp: (() => void) | null = null;
    let unsubInc: (() => void) | null = null;
    (async () => {
      unsubExp = await subscribeUserExpenseRecords(setExpenses, console.error);
      unsubInc = await subscribeUserIncomeRecords(setIncomes, console.error);
    })();
    return () => {
      unsubExp?.();
      unsubInc?.();
    };
  }, []);

  const { startISO, endISO } = useMemo(() => monthStartEndISO(monthKey), [monthKey]);

  const monthExpenses = useMemo(
    () => expenses.filter((r) => r.dateISO >= startISO && r.dateISO < endISO),
    [expenses, startISO, endISO]
  );
  const monthIncomes = useMemo(
    () => incomes.filter((r) => r.dateISO >= startISO && r.dateISO < endISO),
    [incomes, startISO, endISO]
  );

  const totalExpense = useMemo(
    () => monthExpenses.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [monthExpenses]
  );
  const totalIncome = useMemo(
    () => monthIncomes.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [monthIncomes]
  );
  const total = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (total / totalIncome) * 100 : 0;

  /** ---------- Filters & sort ---------- */
  const filteredExpenses = useMemo(() => {
    let arr = [...monthExpenses];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      arr = arr.filter((r) => {
        const note = ((r as any).note || "").toString().toLowerCase();
        const cat = (r.category || "").toString().toLowerCase();
        const pm = ((r as any).paymentMethod || "").toString().toLowerCase();
        const amt = String(r.amount || "").toLowerCase();
        return note.includes(q) || cat.includes(q) || pm.includes(q) || amt.includes(q);
      });
    }

    if (selectedCats.size > 0) {
      arr = arr.filter((r) => selectedCats.has((r.category as string) || "Others"));
    }

    if (method !== "All") {
      arr = arr.filter((r) => ((r as any).paymentMethod || "") === method);
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
        // date-desc
        arr.sort((a, b) => (a.dateISO < b.dateISO ? 1 : -1));
    }

    return arr;
  }, [monthExpenses, search, selectedCats, method, sort]);

  /** ---------- Running balance per expense ---------- */
  const runningBalanceById = useMemo(() => {
    // Sort all visible expenses in chronological order
    const sorted = [...filteredExpenses].sort((a, b) =>
      (a.dateISO || "").localeCompare(b.dateISO || "")
    );

    let cumulativeExpense = 0;
    const map: Record<string, number> = {};

    sorted.forEach((r) => {
      const amt = Number(r.amount) || 0;
      cumulativeExpense += amt;
      const remaining = totalIncome - cumulativeExpense;
      if (r.id) {
        map[r.id] = remaining;
      }
    });

    return map;
  }, [filteredExpenses, totalIncome]);

  /** ---------- Grouped for list ---------- */
  const grouped = useMemo(() => {
    const byDay: Record<string, ExpenseRecord[]> = {};
    filteredExpenses.forEach((r) => {
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
  }, [filteredExpenses]);

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

  const openRecord = (r: ExpenseRecord) => {
    setSelected(r);
    setOpenModal(true);
  };

  const handleDelete = () => {
    setOpenModal(false);
    Alert.alert("Delete", "Implement deleteExpenseRecord() for your backend.");
  };

  const handleEdit = () => {
    setOpenModal(false);
    router.push({ pathname: "/screen/AddRecord", params: { editId: selected?.id || "" } });
  };

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
          <Text style={styles.appBarTitle}>Expenses</Text>
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
          <TouchableOpacity
            style={styles.appBarIconBtn}
            activeOpacity={0.7}
            onPress={() => setViewMode((v) => (v === "list" ? "insights" : "list"))}
          >
            <Ionicons
              name={viewMode === "list" ? "analytics-outline" : "list-outline"}
              size={20}
              color={BRAND_DARK}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Summary */}
        <LinearGradient
          colors={["#FEF2F2", "#FFF7ED"]}
          style={styles.summaryCard}
        >
          <View style={styles.summaryHeaderRow}>
            <View>
              <Text style={styles.summaryLabel}>Total Expenses</Text>
              <Text style={styles.summaryValue}>{fmtRM(totalExpense)}</Text>
            </View>
            <View
              style={[
                styles.summaryPill,
                { backgroundColor: "rgba(239, 68, 68, 0.12)" },
              ]}
            >
              <Ionicons name="cash-outline" size={14} color={RED} />
              <Text style={[styles.summaryPillText, { color: RED }]}>This month</Text>
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
            {CATEGORY_ORDER.map((c) => (
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

        {/* Mode: insights or list */}
        {viewMode === "insights" ? (
          <>
            <SpendingInsights expenses={filteredExpenses} monthKey={monthKey} />
            <CategoryBreakdown expenses={filteredExpenses} />
          </>
        ) : (
          <View style={styles.listContainer}>
            {grouped.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="wallet-outline" size={42} color="#9CA3AF" />
                </View>
                <Text style={styles.emptyTitle}>No transactions</Text>
                <Text style={styles.emptyText}>
                  Adjust your filters or add a new record to see it here.
                </Text>
              </View>
            ) : (
              grouped.map((g) => (
                <View key={g.dayKey} style={styles.dayGroup}>
                  <View style={styles.dayHeaderRow}>
                    <Text style={styles.dayHeaderText}>{g.header}</Text>
                    <View style={styles.dayTotalPill}>
                      <Text style={styles.dayTotalText}>{fmtRM(g.dayTotal)}</Text>
                    </View>
                  </View>
                  {g.items.map((r) => (
                    <Row
                      key={r.id || r.dateISO + String(r.amount)}
                      r={r}
                      balanceAfter={r.id ? runningBalanceById[r.id] : undefined}
                      onPress={() => openRecord(r)}
                      onLongPress={() => openRecord(r)}
                    />
                  ))}
                </View>
              ))
            )}
          </View>
        )}
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
              <Text style={styles.modalTitle}>Expense details</Text>
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
                    <Text style={[styles.modalValue, { color: RED }]}>
                      -{fmtRM(Number(selected.amount) || 0)}
                    </Text>
                  </View>
                  {!!(selected as any).paymentMethod && (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Method</Text>
                      <Text style={styles.modalValue}>{(selected as any).paymentMethod}</Text>
                    </View>
                  )}
                  {!!(selected as any).note && (
                    <View style={styles.modalRow}>
                      <Text style={styles.modalLabel}>Note</Text>
                      <Text style={styles.modalValue}>{(selected as any).note}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnGhost]}
                    onPress={handleDelete}
                  >
                    <Ionicons name="trash" size={16} color={RED} />
                    <Text style={[styles.modalBtnText, { color: RED }]}>Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalBtnPrimary]}
                    onPress={handleEdit}
                  >
                    <Ionicons name="create-outline" size={16} color="#fff" />
                    <Text style={[styles.modalBtnText, { color: "#fff" }]}>Edit</Text>
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
    color: MUTED,
  },
  appBarRight: {
    flexDirection: "row",
    gap: 8,
  },

  // Summary
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
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchInput: {
    flex: 1,
    paddingHorizontal: 8,
    color: "#020617",
    fontSize: 13,
  },
  clearBtn: {
    paddingLeft: 4,
  },
  filtersRow: {
    marginTop: 10,
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 8,
  },
  filtersLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 2,
  },
  sortChipRow: {
    width: "100%",
  },
  sortChipGroup: {
    flexDirection: "row",
    gap: 6,
    marginTop: 4,
    flexWrap: "wrap",
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
  },
  sortChipActive: {
    backgroundColor: "#E5E7EB",
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  sortChipTextActive: {
    color: "#0B1120",
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
  chipCompact: {
    paddingVertical: 6,
  },
  chipInactive: {
    backgroundColor: "#fff",
    borderColor: LINE_SOFT,
  },
  chipActive: {
    backgroundColor: BRAND_DARK,
    borderColor: BRAND_DARK,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
    color: BRAND_DARK,
  },
  chipTextActive: {
    color: "#fff",
  },

  // Category & insights cards
  categoryCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 18,
    ...shadow(2, 0.06),
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: BRAND_DARK,
  },
  categoryRow: {
    paddingVertical: 12,
  },
  categoryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "700",
    color: BRAND_DARK,
  },
  categoryRight: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: BRAND_DARK,
  },
  categoryPercent: {
    fontSize: 13,
    fontWeight: "700",
    color: MUTED,
  },
  categoryDivider: {
    height: 1,
    backgroundColor: LINE_SOFT,
    marginTop: 12,
  },

  insightsCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 18,
    ...shadow(2, 0.06),
  },
  insightsGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  insightItem: {
    flex: 1,
    backgroundColor: "#F7FAF9",
    borderRadius: 14,
    padding: 14,
  },
  insightLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: MUTED,
    marginBottom: 6,
  },
  insightValue: {
    fontSize: 18,
    fontWeight: "900",
    color: BRAND_DARK,
  },
  insightHighlight: {
    marginTop: 14,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: RED,
  },
  insightHighlightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  insightHighlightText: {
    fontSize: 13,
    fontWeight: "600",
    color: BRAND_DARK,
    flex: 1,
  },

  // List
  listContainer: {
    marginTop: 16,
    marginHorizontal: 16,
    marginBottom: 8,
  },
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  dayHeaderText: {
    fontSize: 14,
    fontWeight: "800",
    color: BRAND_DARK,
  },
  dayTotalPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  dayTotalText: {
    fontSize: 13,
    fontWeight: "800",
    color: RED,
  },

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
  rowMid: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: BRAND_DARK,
    marginBottom: 2,
  },
  rowSub: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
  },
  rowRight: {
    alignItems: "flex-end",
  },
  rowAmount: {
    fontSize: 14,
    fontWeight: "800",
  },
  rowBalanceText: {
    fontSize: 11,
    fontWeight: "600",
    color: MUTED,
    marginTop: 2,
  },
  paymentBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  paymentText: {
    fontSize: 11,
    fontWeight: "600",
    color: MUTED,
  },

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
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: BRAND_DARK,
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12,
    color: MUTED,
    textAlign: "center",
  },

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
    backgroundColor: "#FFFFFF",
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
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: BRAND_DARK,
  },
  modalBody: {
    marginTop: 10,
    gap: 10,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalLabel: {
    color: MUTED,
    fontWeight: "700",
  },
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
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalBtnGhost: {
    backgroundColor: "#FFF1F2",
  },
  modalBtnPrimary: {
    backgroundColor: BRAND_DARK,
  },
  modalBtnText: {
    fontWeight: "800",
  },
});

function shadow(height: number, opacity: number) {
  return {
    shadowColor: "#000",
    shadowOffset: { width: 0, height },
    shadowOpacity: opacity,
    shadowRadius: height * 2,
    elevation: height + 2,
  };
}
