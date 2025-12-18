// app/screen/Stats.tsx
import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { G, Path, Text as SvgText } from "react-native-svg";
import * as d3 from "d3-shape";
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
import BottomNav from "../component/BottomNav";
import { fetchMonthlySnapshot, getMonthlyInsights } from "../services/monthlyInsights";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { subscribeUserDebts, type Debt } from "../utils/DebtUtils";
import { Alert, ActivityIndicator } from "react-native";
import type { MonthlySnapshot } from "../utils/financeTypes";
import { formatCurrency, subscribeUserCurrency, type Currency } from "../utils/currencyUtils";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/** ------- Layout constants (controls gap and animation) ------- */
const EXCHANGE_BTN_SIZE = 54;          // matches button style
const GAP_BETWEEN_CARDS = 10;          // visible space between cards
const BASE_OFFSET = 165;               // your previous separation baseline
const CARD_SEPARATION = BASE_OFFSET + GAP_BETWEEN_CARDS; // used for layout + animation

// ============================================================================
// CONSTANTS
// ============================================================================
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

// Income categories
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

const isDevClient = process.env.EXPO_PUBLIC_ENV !== "production";

// ============================================================================
// TYPES
// ============================================================================
type Period = "Week" | "Month" | "Year" | "All";
type Slice = { key: string; value: number; color: string; pct: number };

interface CardData {
  type: "expense" | "income";
  label: string;
  amount: number;
  transactions: number;
  dailyAverage: number;
  topCategory: { name: string; amount: number; icon: any; color: string } | null;
  trend: number;
  bgGradient: [string, string];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
const getPeriodRange = (period: Period, anchorISO: string) => {
  if (period === "All") return { startISO: "", endISO: "" };

  const d = new Date(anchorISO);
  if (Number.isNaN(d.getTime())) return { startISO: "", endISO: "" };

  if (period === "Week") {
    // Get the start of the current week (Sunday)
    const day = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    start.setHours(0, 0, 0, 0);
    // End is 7 days later (next Sunday), but we want to include up to end of Saturday
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    end.setHours(23, 59, 59, 999);
    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }

  if (period === "Month") {
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }

  const start = new Date(d.getFullYear(), 0, 1);
  const end = new Date(d.getFullYear() + 1, 0, 1);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
};

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

const monthKeyToMidISO = (yyyymm: string) => {
  const [y, m] = yyyymm.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 15).toISOString();
};

const getDaysInPeriod = (period: Period): number => {
  const days = { Week: 7, Month: 30, Year: 365, All: 30 };
  return days[period];
};

// ============================================================================
// COMPONENTS
// ============================================================================
function LabeledPieChart({ data, size = 240 }: { data: Slice[]; size?: number }) {
  const radius = size / 2;
  const innerRadius = radius * 0.55;

  const { arcData, arcGen } = useMemo(() => {
    const values = data.map((d) => ({ ...d, value: Number(d.value) || 0 }));
    const pieGen = d3.pie<Slice>().value((d) => d.value).sort(null);
    const arcs = pieGen(values);
    const arcGenerator = d3
      .arc<d3.PieArcDatum<Slice>>()
      .outerRadius(radius - 8)
      .innerRadius(innerRadius)
      .cornerRadius(6)
      .padAngle(0.03);
    return { arcData: arcs, arcGen: arcGenerator };
  }, [data, radius, innerRadius]);

  return (
    <Svg width={size} height={size}>
      <G x={size / 2} y={size / 2}>
        {arcData.map((a, i) => {
          const path = arcGen(a);
          if (!path) return null;

          const [labelX, labelY] = arcGen.centroid(a);
          const showLabel = a.data.pct >= 8;

          return (
            <G key={i}>
              <Path d={path} fill={a.data.color} opacity={0.9} />
              {showLabel && (
                <SvgText
                  x={labelX}
                  y={labelY}
                  fill="#fff"
                  fontSize={11}
                  fontWeight="800"
                  textAnchor="middle"
                  alignmentBaseline="middle"
                >
                  {a.data.pct}%
                </SvgText>
              )}
            </G>
          );
        })}
      </G>
    </Svg>
  );
}

/** Enhanced Card */
function EnhancedCard({
  data,
  onPress,
  currency,
}: {
  data: CardData;
  onPress?: () => void;
  currency: Currency;
}) {
  const isExpense = data.type === "expense";
  const trendUp = data.trend > 0;
  const trendColor = isExpense ? (trendUp ? "#EF4444" : "#22C55E") : trendUp ? "#22C55E" : "#EF4444";
  const trendIcon = trendUp ? "trending-up" : "trending-down";

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={styles.card}
    >
      <LinearGradient colors={data.bgGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardGradient} />
      <View style={styles.cardContent}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.headerBadge}>
            <View style={[styles.iconBadge, { backgroundColor: isExpense ? "#FEE2E2" : "#D1FAE5" }]}>
              <Ionicons name={isExpense ? "arrow-down-circle" : "arrow-up-circle"} size={18} color={isExpense ? "#EF4444" : "#22C55E"} />
            </View>
            <Text style={styles.cardLabel}>{data.label}</Text>
          </View>

          {data.trend !== 0 && (
            <View style={[styles.trendBadge, { backgroundColor: trendColor + "20", borderColor: trendColor + "40" }]}>
              <Ionicons name={trendIcon} size={10} color={trendColor} />
              <Text style={[styles.trendText, { color: trendColor }]}>{Math.abs(data.trend)}%</Text>
            </View>
          )}
        </View>

        {/* Amount */}
        <View style={styles.amountSection}>
          <Text style={styles.amount}>{formatCurrency(Math.round(data.amount), currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <View style={styles.statIconWrapper}>
              <Ionicons name="calendar-outline" size={14} color="#6B7280" />
            </View>
            <View style={styles.statContent}>
              <Text style={styles.statLabel}>Daily Avg</Text>
              <Text style={styles.statValue}>{formatCurrency(Math.round(data.dailyAverage), currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text>
            </View>
          </View>

          {data.topCategory && (
            <View style={styles.statBox}>
              <View style={[styles.statIconWrapper, { backgroundColor: data.topCategory.color + "20" }]}>
                <Ionicons name={data.topCategory.icon} size={14} color={data.topCategory.color} />
              </View>
              <View style={styles.statContent}>
                <Text style={styles.statLabel}>Top Category</Text>
                <Text style={styles.statValue}>{data.topCategory.name}</Text>
              </View>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}


// ============================================================================
// MAIN SCREEN
// ============================================================================
export default function Stats() {
  const router = useRouter();

  const [isFlipped, setIsFlipped] = useState(false);
  const [period, setPeriod] = useState<Period>("Month");
  const [monthKey, setMonthKey] = useState<string>(getCurrentMonthKey());
  const [showDetails, setShowDetails] = useState(true);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [backendSnapshot, setBackendSnapshot] = useState<MonthlySnapshot | null>(null);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>("MYR");

  // Animation
  const topCardAnim = useRef(new Animated.Value(0)).current;
  const bottomCardAnim = useRef(new Animated.Value(0)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;

  // Load userId
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("userId");
        if (stored) setUserId(stored);
      } catch (e) {
        console.error("Failed to load userId", e);
      }
    })();
  }, []);

  // Subscribe to data
  useEffect(() => {
    let unsubExp: (() => void) | null = null;
    let unsubInc: (() => void) | null = null;
    let unsubDebt: (() => void) | null = null;
    (async () => {
      unsubExp = await subscribeUserExpenseRecords(setExpenses, console.error);
      unsubInc = await subscribeUserIncomeRecords(setIncomes, console.error);
      
      // Subscribe to debts and savings if userId is available
      const stored = await AsyncStorage.getItem("userId");
      if (stored) {
        setUserId(stored);
        unsubDebt = subscribeUserDebts(stored, setDebts, console.error);
        // Subscribe to currency
        subscribeUserCurrency(stored, (curr) => {
          setCurrency(curr);
        });
      }
    })();
    return () => {
      unsubExp?.();
      unsubInc?.();
      unsubDebt?.();
    };
  }, []);

  const refreshSnapshot = useCallback(async () => {
    if (!userId) return null;
    try {
      const snapshot = await fetchMonthlySnapshot(userId, monthKey);
      setBackendSnapshot(snapshot);
      if (snapshot) {
        if (isDevClient) {
          console.log("📦 Frontend MonthlySnapshot from backend:", JSON.stringify(snapshot, null, 2));
        } else {
          console.log("📦 Snapshot stats:", {
            income: snapshot.totalIncome,
            spending: snapshot.spendingTotals?.spending,
            savings: snapshot.savingsSummary?.savingsContrib,
            dti: snapshot.debtSummary?.debtToIncomeRatio,
          });
        }
      }
      return snapshot;
    } catch (error: any) {
      // Error is already handled gracefully in fetchMonthlySnapshot (returns null)
      // Just ensure state is cleared if needed
      setBackendSnapshot(null);
      return null;
    }
  }, [userId, monthKey]);

  useEffect(() => {
    refreshSnapshot();
  }, [refreshSnapshot]);

  // Time windows
  // For Week period, use current date; for others, use month midpoint
  const anchorISO = period === "Week" ? new Date().toISOString() : monthKeyToMidISO(monthKey);
  const { startISO, endISO } = useMemo(() => getPeriodRange(period, anchorISO), [period, anchorISO]);

  const prevMonthKey = useMemo(() => addMonths(monthKey, -1), [monthKey]);
  // For Week period, use previous week; for others, use previous month midpoint
  const prevAnchorISO = period === "Week" 
    ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() 
    : monthKeyToMidISO(prevMonthKey);
  const { startISO: prevStartISO, endISO: prevEndISO } = useMemo(
    () => getPeriodRange(period, prevAnchorISO),
    [period, prevAnchorISO]
  );

  // Process data
  const processData = (records: ExpenseRecord[] | IncomeRecord[], type: "expense" | "income") => {
    const source = startISO && endISO ? records.filter((r) => r.dateISO >= startISO && r.dateISO < endISO) : records;
    const prevSource =
      prevStartISO && prevEndISO ? records.filter((r) => r.dateISO >= prevStartISO && r.dateISO < prevEndISO) : [];

    // Use appropriate category list based on type
    const byCat: Record<string, number> = {};
    
    if (type === "income") {
      INCOME_CATEGORY_ORDER.forEach((c) => (byCat[c] = 0));
      source.forEach((r) => {
        const cat = (r.category && INCOME_CATEGORY_ORDER.includes(r.category as any) ? r.category : "Others") as (typeof INCOME_CATEGORY_ORDER)[number];
        byCat[cat] += Number(r.amount) || 0;
      });
    } else {
      CATEGORY_ORDER.forEach((c) => (byCat[c] = 0));
      source.forEach((r) => {
        const cat = (r.category && CATEGORY_ORDER.includes(r.category as any) ? r.category : "Others") as (typeof CATEGORY_ORDER)[number];
        byCat[cat] += Number(r.amount) || 0;
      });
    }

    const total = Object.values(byCat).reduce((s, v) => s + v, 0);
    const prevTotal = prevSource.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const trend = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : 0;
    const days = getDaysInPeriod(period);

    const categories = (type === "income"
      ? INCOME_CATEGORY_ORDER.map((name) => {
          const amount = byCat[name];
          const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
          return { name, amount, pct, color: INCOME_CATEGORY_COLORS[name], icon: INCOME_CATEGORY_ICONS[name] };
        })
      : CATEGORY_ORDER.map((name) => {
          const amount = byCat[name];
          const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
          return { name, amount, pct, color: CATEGORY_COLORS[name], icon: CATEGORY_ICONS[name] };
        }))
      .filter((r) => r.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    const slices: Slice[] =
      categories.length > 0
        ? categories.map((r) => ({ key: r.name, value: r.amount, color: r.color, pct: r.pct }))
        : [{ key: "empty", value: 1, color: "#E5E7EB", pct: 100 }];

    const topCat = categories[0] || null;

    return {
      total,
      transactions: source.length,
      dailyAverage: days > 0 ? total / days : 0,
      trend,
      categories,
      slices,
      topCategory: topCat ? { name: topCat.name, amount: topCat.amount, icon: topCat.icon, color: topCat.color } : null,
    };
  };

  const expenseData = useMemo(() => processData(expenses, "expense"), [expenses, startISO, endISO, prevStartISO, prevEndISO, period]);
  const incomeData = useMemo(() => processData(incomes, "income"), [incomes, startISO, endISO, prevStartISO, prevEndISO, period]);

  // Cards
  const expenseCard: CardData = {
    type: "expense",
    label: "Expenses",
    amount: expenseData.total,
    transactions: expenseData.transactions,
    dailyAverage: expenseData.dailyAverage,
    topCategory: expenseData.topCategory,
    trend: expenseData.trend,
    bgGradient: ["#FEF9C3", "#FDE68A"],
  };

  const incomeCard: CardData = {
    type: "income",
    label: "Income",
    amount: incomeData.total,
    transactions: incomeData.transactions,
    dailyAverage: incomeData.dailyAverage,
    topCategory: incomeData.topCategory,
    trend: incomeData.trend,
    bgGradient: ["#D1FAE5", "#A7F3D0"],
  };

  const topCard = isFlipped ? incomeCard : expenseCard;
  const bottomCard = isFlipped ? expenseCard : incomeCard;
  const currentData = isFlipped ? incomeData : expenseData;

  // Animation
  const handleExchange = () => {
    Animated.parallel([
      Animated.timing(topCardAnim, { toValue: 1, duration: 500, easing: Easing.bezier(0.34, 1.56, 0.64, 1), useNativeDriver: true }),
      Animated.timing(bottomCardAnim, { toValue: 1, duration: 500, easing: Easing.bezier(0.34, 1.56, 0.64, 1), useNativeDriver: true }),
      Animated.timing(rotationAnim, { toValue: 1, duration: 500, easing: Easing.bezier(0.34, 1.56, 0.64, 1), useNativeDriver: true }),
    ]).start(() => {
      topCardAnim.setValue(0);
      bottomCardAnim.setValue(0);
      rotationAnim.setValue(0);
      setIsFlipped((v) => !v);
    });
  };

  /** Use CARD_SEPARATION so the cards always keep a visible gap */
  const topCardTranslateY = topCardAnim.interpolate({ inputRange: [0, 1], outputRange: [0, CARD_SEPARATION] });
  const bottomCardTranslateY = bottomCardAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -CARD_SEPARATION] });
  const exchangeRotation = rotationAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });

  const title = useMemo(() => monthKeyToLabel(monthKey), [monthKey]);

  // Handle AI Spending Analysis
  const handleAIAnalysis = async () => {
    if (!userId) {
      Alert.alert("Error", "User ID not found. Please try again.");
      return;
    }

    if (period !== "Month") {
      Alert.alert("Info", "AI Analysis is only available for monthly periods. Please select 'Month'.");
      return;
    }

    setLoadingInsights(true);
    setAiInsights(null);

    try {
      const snapshot = (await refreshSnapshot()) ?? backendSnapshot;
      if (!snapshot) {
        Alert.alert(
          "Snapshot Unavailable",
          "We couldn't load your monthly snapshot from the server. Please try again in a moment."
        );
        setLoadingInsights(false);
        return;
      }

      const response = await getMonthlyInsights(userId, monthKey, snapshot);
      if (response) {
        setAiInsights(response.insights);
      } else {
        // Backend unavailable - handle gracefully without showing error
        setAiInsights(null);
        console.warn("Monthly insights unavailable - backend server not reachable");
      }
    } catch (error: any) {
      console.error("AI Analysis error:", error);
      setAiInsights(null);
      // Only show alert for unexpected errors, not for backend unavailability
      if (!error.message?.includes('timeout') && !error.message?.includes('ECONNREFUSED')) {
        Alert.alert(
          "Analysis Failed",
          error.message || "Could not generate insights. Please check your connection and try again."
        );
      }
    } finally {
      setLoadingInsights(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#1E3932" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Wallet</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Cards Container with dynamic height and true gap */}
        <View style={[styles.cardsContainer, { height: CARD_SEPARATION * 2 }]}>
          {/* Top card */}
          <Animated.View
            style={[
              styles.cardWrapper,
              { top: 0 },
              { transform: [{ translateY: topCardTranslateY }] },
            ]}
          >
            <EnhancedCard
              data={topCard}
              currency={currency}
              onPress={() =>
                router.push(
                  topCard.type === "expense"
                    ? "/screen/ExpensesDetail"
                    : "/screen/IncomeDetail"
                )
              }
            />
          </Animated.View>

          {/* Bottom card, pushed down by separation */}
          <Animated.View
            style={[
              styles.cardWrapper,
              { top: CARD_SEPARATION },
              { transform: [{ translateY: bottomCardTranslateY }] },
            ]}
          >
            <EnhancedCard
              data={bottomCard}
              currency={currency}
              onPress={() =>
                router.push(
                  topCard.type === "income"
                    ? "/screen/ExpensesDetail"
                    : "/screen/IncomeDetail"
                )
              }
            />
          </Animated.View>

          {/* Swap button sits in the gap */}
          <Animated.View
            style={[
              styles.exchangeBtnWrapper,
              { top: CARD_SEPARATION - EXCHANGE_BTN_SIZE / 2 },
              { transform: [{ rotate: exchangeRotation }] },
            ]}
          >
            <TouchableOpacity style={styles.exchangeBtn} onPress={handleExchange} activeOpacity={0.85}>
            <LinearGradient colors={["#A7F3D0", "#6EE7B7"] as const} style={styles.exchangeBtnGradient}>
            <Ionicons name="swap-vertical" size={24} color="#065F46" />
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Date Nav */}
        <View style={styles.dateSection}>
          <View style={styles.dateNav}>
            <TouchableOpacity onPress={() => setMonthKey((k) => addMonths(k, -1))} style={styles.dateNavBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={20} color="#1E3932" />
            </TouchableOpacity>
            <Text style={styles.dateText}>{title}</Text>
            <TouchableOpacity onPress={() => setMonthKey((k) => addMonths(k, +1))} style={styles.dateNavBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-forward" size={20} color="#1E3932" />
            </TouchableOpacity>
          </View>

          {/* Period Filter */}
          <View style={styles.periodContainer}>
            {(["Week", "Month", "Year", "All"] as Period[]).map((p) => {
              const active = period === p;
              return (
                <TouchableOpacity key={p} style={[styles.periodChip, active && styles.periodChipActive]} onPress={() => setPeriod(p)} activeOpacity={0.7}>
                  <Text style={[styles.periodText, active && styles.periodTextActive]}>{p}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Distribution */}
        <View style={styles.distributionCard}>
          <View style={styles.distributionHeader}>
            <Text style={styles.distributionTitle}>Distribution</Text>
            <TouchableOpacity onPress={() => setShowDetails(!showDetails)} activeOpacity={0.7}>
              <Ionicons name={showDetails ? "chevron-up" : "chevron-down"} size={24} color="#22C55E" />
            </TouchableOpacity>
          </View>

          <View style={styles.chartWrapper}>
            <LabeledPieChart data={currentData.slices} size={240} />
            <View style={styles.chartCenter}>
              <Text style={styles.chartAmount}>{formatCurrency(Math.round(currentData.total), currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text>
              <Text style={styles.chartLabel}>{currentData.transactions} txns</Text>
            </View>
          </View>

          <View style={styles.legendContainer}>
            {currentData.categories.slice(0, 5).map((cat, idx) => (
              <View key={cat.name + idx} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                <Text style={styles.legendText}>{cat.name}</Text>
              </View>
            ))}
          </View>

          {showDetails && (
            <View style={styles.categoryList}>
              {currentData.categories.map((cat, idx) => (
                <View key={cat.name + idx} style={styles.categoryItem}>
                  <View style={styles.categoryLeft}>
                    <View style={[styles.categoryIcon, { backgroundColor: cat.color + "20" }]}>
                      <Ionicons name={cat.icon} size={18} color={cat.color} />
                    </View>
                    <Text style={styles.categoryName}>{cat.name}</Text>
                  </View>
                  <View style={styles.categoryRight}>
                    <Text style={styles.categoryAmount}>{formatCurrency(Math.round(cat.amount), currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</Text>
                    <Text style={[styles.categoryPct, { color: cat.color }]}>{cat.pct}%</Text>
                  </View>
                </View>
              ))}

              {currentData.categories.length === 0 && (
                <View style={styles.emptyState}>
                  <Ionicons name="pie-chart-outline" size={40} color="#D1D5DB" />
                  <Text style={styles.emptyText}>No data available</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* AI Spending Analysis Section */}
        {/* <View style={styles.aiAnalysisCard}>
          <View style={styles.aiAnalysisHeader}>
            <View style={styles.aiIconWrapper}>
              <Ionicons name="sparkles" size={20} color="#8B5CF6" />
            </View>
            <Text style={styles.aiAnalysisTitle}>AI Spending Analysis</Text>
          </View>

          {loadingInsights ? (
            <View style={styles.aiLoadingContainer}>
              <ActivityIndicator size="small" color="#8B5CF6" />
              <Text style={styles.aiLoadingText}>Generating insights...</Text>
            </View>
          ) : aiInsights ? (
            <View style={styles.aiInsightsContainer}>
              <Text style={styles.aiInsightsText}>{aiInsights}</Text>
              <TouchableOpacity
                style={styles.aiRegenerateBtn}
                onPress={handleAIAnalysis}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh-outline" size={16} color="#8B5CF6" />
                <Text style={styles.aiRegenerateText}>Regenerate</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.aiGenerateBtn}
              onPress={handleAIAnalysis}
              activeOpacity={0.8}
              disabled={loadingInsights}
            >
              <Ionicons name="sparkles" size={18} color="#FFFFFF" />
              <Text style={styles.aiGenerateBtnText}>Generate Analysis</Text>
            </TouchableOpacity>
          )}
        </View> */}

        <View style={{ height: 32 }} />
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E4F2ED" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#1E3932" },
  scrollContent: { paddingBottom: 36 },

  // Cards Container 
  cardsContainer: { marginHorizontal: 20, position: "relative", marginBottom: 16 },
  cardWrapper: { position: "absolute", width: "100%" },

  // Card
  card: { borderRadius: 20, overflow: "hidden", ...shadowStyle(4, 0.1) },
  cardGradient: { ...StyleSheet.absoluteFillObject },
  cardContent: { padding: 12 },

  // Header
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  headerBadge: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconBadge: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardLabel: { fontSize: 15, fontWeight: "800", color: "#1E3932" },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  trendText: { fontSize: 11, fontWeight: "800" },

  // Amount
  amountSection: { flexDirection: "row", alignItems: "baseline", marginBottom: 8 },
  currency: { fontSize: 15, fontWeight: "700", color: "#6B7280", marginRight: 6 },
  amount: { fontSize: 28, fontWeight: "900", color: "#1E3932", letterSpacing: -0.2 },

  // Stats Grid
  statsGrid: { flexDirection: "row", gap: 8, marginBottom: 6 },
  statBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 10,
  },
  statIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  statContent: { flex: 1 },
  statLabel: { fontSize: 10, fontWeight: "700", color: "#6B7280", marginBottom: 2 },
  statValue: { fontSize: 13, fontWeight: "800", color: "#1E3932" },

  // Exchange Button
  exchangeBtnWrapper: { position: "absolute", alignSelf: "center", zIndex: 10 },
  exchangeBtn: { ...shadowStyle(5, 0.18) },
  exchangeBtnGradient: {
    width: EXCHANGE_BTN_SIZE,
    height: EXCHANGE_BTN_SIZE,
    borderRadius: EXCHANGE_BTN_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#154C42",
  },

  // Date Section
  dateSection: { marginHorizontal: 20, marginBottom: 20 },
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 20,
    ...shadowStyle(2, 0.06),
  },
  dateNavBtn: { width: 36, height: 25, borderRadius: 10, backgroundColor: "#E4F2ED", alignItems: "center", justifyContent: "center" },
  dateText: { fontSize: 16, fontWeight: "700", color: "#1E3932" },

  // Period Filter
  periodContainer: { flexDirection: "row", gap: 8 },
  periodChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center",
    ...shadowStyle(1, 0.04),
  },
  periodChipActive: { backgroundColor: "#1E3932" },
  periodText: { fontSize: 13, fontWeight: "700", color: "#6B7280" },
  periodTextActive: { color: "#fff" },

  // Distribution Card
  distributionCard: { backgroundColor: "#fff", marginHorizontal: 20, borderRadius: 20, padding: 20, ...shadowStyle(2, 0.06) },
  distributionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  distributionTitle: { fontSize: 18, fontWeight: "800", color: "#1E3932" },

  // Chart
  chartWrapper: { alignItems: "center", marginBottom: 16 },
  chartCenter: { position: "absolute", top: "50%", alignItems: "center", transform: [{ translateY: -20 }] },
  chartAmount: { fontSize: 20, fontWeight: "800", color: "#1E3932", marginBottom: 2 },
  chartLabel: { fontSize: 11, fontWeight: "600", color: "#9CA3AF" },

  // Legend
  legendContainer: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, fontWeight: "600", color: "#6B7280" },

  // Category List
  categoryList: { borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 12 },
  categoryItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10 },
  categoryLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  categoryIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  categoryName: { fontSize: 14, fontWeight: "700", color: "#1E3932" },
  categoryRight: { alignItems: "flex-end" },
  categoryAmount: { fontSize: 14, fontWeight: "700", color: "#1E3932", marginBottom: 2 },
  categoryPct: { fontSize: 12, fontWeight: "600" },

  // Empty State
  emptyState: { alignItems: "center", paddingVertical: 28 },
  emptyText: { fontSize: 13, fontWeight: "600", color: "#9CA3AF", marginTop: 8 },

  // AI Analysis Card
  aiAnalysisCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    borderRadius: 20,
    padding: 20,
    ...shadowStyle(3, 0.08),
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  aiAnalysisHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  aiIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  aiAnalysisTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  aiGenerateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8B5CF6",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    ...shadowStyle(2, 0.15),
  },
  aiGenerateBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  aiLoadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 10,
  },
  aiLoadingText: {
    fontSize: 14,
    color: "#64748B",
    fontWeight: "600",
  },
  aiInsightsContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: "#8B5CF6",
  },
  aiInsightsText: {
    fontSize: 14,
    lineHeight: 22,
    color: "#0F172A",
    fontWeight: "500",
    marginBottom: 12,
  },
  aiRegenerateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignSelf: "flex-start",
  },
  aiRegenerateText: {
    fontSize: 13,
    color: "#8B5CF6",
    fontWeight: "700",
  },
});

function shadowStyle(height: number, opacity: number) {
  return {
    shadowColor: "#000",
    shadowOffset: { width: 0, height },
    shadowOpacity: opacity,
    shadowRadius: height * 2,
    elevation: height + 2,
  };
}
