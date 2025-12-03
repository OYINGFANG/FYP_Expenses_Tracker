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
    const day = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
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
}: {
  data: CardData;
  onPress?: () => void;
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
          <Text style={styles.currency}>RM</Text>
          <Text style={styles.amount}>{Math.round(data.amount).toLocaleString()}</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <View style={styles.statIconWrapper}>
              <Ionicons name="calendar-outline" size={14} color="#6B7280" />
            </View>
            <View style={styles.statContent}>
              <Text style={styles.statLabel}>Daily Avg</Text>
              <Text style={styles.statValue}>RM {Math.round(data.dailyAverage)}</Text>
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
        unsubDebt = subscribeUserDebts(stored, setDebts, console.error);
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
    } catch (error) {
      console.error("Failed to load monthly snapshot from backend:", error);
      setBackendSnapshot(null);
      return null;
    }
  }, [userId, monthKey]);

  useEffect(() => {
    refreshSnapshot();
  }, [refreshSnapshot]);

  // Time windows
  const anchorISO = monthKeyToMidISO(monthKey);
  const { startISO, endISO } = useMemo(() => getPeriodRange(period, anchorISO), [period, anchorISO]);

  const prevMonthKey = useMemo(() => addMonths(monthKey, -1), [monthKey]);
  const prevAnchorISO = monthKeyToMidISO(prevMonthKey);
  const { startISO: prevStartISO, endISO: prevEndISO } = useMemo(
    () => getPeriodRange(period, prevAnchorISO),
    [period, prevAnchorISO]
  );

  // Process data
  const processData = (records: ExpenseRecord[] | IncomeRecord[]) => {
    const source = startISO && endISO ? records.filter((r) => r.dateISO >= startISO && r.dateISO < endISO) : records;
    const prevSource =
      prevStartISO && prevEndISO ? records.filter((r) => r.dateISO >= prevStartISO && r.dateISO < prevEndISO) : [];

    const byCat: Record<string, number> = {};
    CATEGORY_ORDER.forEach((c) => (byCat[c] = 0));
    source.forEach((r) => {
      const cat = (r.category && CATEGORY_ORDER.includes(r.category as any) ? r.category : "Others") as (typeof CATEGORY_ORDER)[number];
      byCat[cat] += Number(r.amount) || 0;
    });

    const total = Object.values(byCat).reduce((s, v) => s + v, 0);
    const prevTotal = prevSource.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const trend = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : 0;
    const days = getDaysInPeriod(period);

    const categories = CATEGORY_ORDER.map((name) => {
      const amount = byCat[name];
      const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
      return { name, amount, pct, color: CATEGORY_COLORS[name], icon: CATEGORY_ICONS[name] };
    })
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

  const expenseData = useMemo(() => processData(expenses), [expenses, startISO, endISO, prevStartISO, prevEndISO, period]);
  const incomeData = useMemo(() => processData(incomes), [incomes, startISO, endISO, prevStartISO, prevEndISO, period]);

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
      setAiInsights(response.insights);
    } catch (error: any) {
      console.error("AI Analysis error:", error);
      Alert.alert(
        "Analysis Failed",
        error.message || "Could not generate insights. Please check your connection and try again."
      );
    } finally {
      setLoadingInsights(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient colors={["#1E5449", "#154C42", "#0F3D35"] as const} style={StyleSheet.absoluteFill} />
      <View style={styles.decorLayer}>
        <View style={[styles.bubble, styles.bubbleA]} />
        <View style={[styles.bubble, styles.bubbleB]} />
      </View>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color="#fff" />
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
              onPress={() =>
                router.push(
                  topCard.type === "expense"
                    ? "/screen/ExpensesDetail"
                    : "/screen/IncomeOverview"
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
              onPress={() =>
                router.push(
                  topCard.type === "income"
                    ? "/screen/ExpensesDetail"
                    : "/screen/IncomeOverview"
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
              <Text style={styles.chartAmount}>RM {Math.round(currentData.total).toLocaleString()}</Text>
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
                    <Text style={styles.categoryAmount}>RM {Math.round(cat.amount).toLocaleString()}</Text>
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
  container: { flex: 1 },

  // Background
  decorLayer: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  bubble: { position: "absolute", borderRadius: 1000, opacity: 0.06 },
  bubbleA: {
    width: SCREEN_WIDTH * 1.5,
    height: SCREEN_WIDTH * 1.5,
    backgroundColor: "#34D399",
    top: -SCREEN_WIDTH * 0.7,
    right: -SCREEN_WIDTH * 0.3,
  },
  bubbleB: {
    width: SCREEN_WIDTH * 1.2,
    height: SCREEN_WIDTH * 1.2,
    backgroundColor: "#60A5FA",
    bottom: -SCREEN_WIDTH * 0.6,
    left: -SCREEN_WIDTH * 0.4,
  },

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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: "#fff" },
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
  dateSection: { marginHorizontal: 20, marginBottom: 16 },
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    ...shadowStyle(2, 0.06),
  },
  dateNavBtn: { width: 36, height: 18, borderRadius: 10, backgroundColor: "#F7FAF9", alignItems: "center", justifyContent: "center" },
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
