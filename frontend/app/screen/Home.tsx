import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import BottomNav from "../component/BottomNav";
import * as ImagePicker from "expo-image-picker";
import { manipulateAsync } from "expo-image-manipulator";
import { useRouter } from "expo-router";
import { getUsernameFromFirestore } from "../utils/UserUtils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CHAT_SERVER_URL } from "../services/api";
// Removed rule-based behavior analysis - now using AI
import { subscribeUserExpenseRecords, ExpenseRecord } from "../utils/ExpensesUtils";
import { getUserBudget, getCurrentMonthKey, getBudgetProgress, getMonthDateRange } from "../utils/budgetUtils";
import { subscribeUserIncomeRecords, type IncomeRecord } from "../utils/IncomeUtils";
import { subscribeUserDebts } from "../utils/DebtUtils";

// =================== OCR helpers ===================
const OCR_SERVER_URL = `${CHAT_SERVER_URL}/ocr/receipt`;

// Normalize various receipt date formats into ISO YYYY-MM-DD for the rest of the app
const normalizeReceiptDate = (rawDate?: string | null): string => {
  try {
    if (!rawDate) {
      return new Date().toISOString().split("T")[0];
    }

    const trimmed = rawDate.trim();

    // Already ISO-like: 2025-12-02T... or 2025-12-02
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }

    // Common receipt style: DD/MM/YYYY or DD-MM-YYYY (Malaysia style)
    const m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) {
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      let year = parseInt(m[3], 10);
      if (year < 100) year += 2000; // handle YY as 20YY
      const iso = new Date(year, month - 1, day).toISOString().split("T")[0];
      return iso;
    }

    // Fallback: let JS Date try to parse it
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  } catch (e) {
    console.warn("Failed to normalize receipt date:", rawDate, e);
  }

  // Last resort: today
  return new Date().toISOString().split("T")[0];
};

const detectCategory = (text: string): string => {
  const lower = (text || "").toLowerCase();
  if (lower.match(/rice|fish|chicken|tomato|egg|drink|tea|cabbage|meal|food|mee|cake/)) return "Food";
  if (lower.match(/grab|taxi|bus|fuel|toll|train|car|transport|RON95|RON97|diesel/)) return "Transport";
  if (lower.match(/supermarket|grocer|mart|tesco|jaya|aeon|lotus|grocery|shopping/)) return "Shopping";
  if (lower.match(/hotel|flight|travel|booking|trip/)) return "Travel";
  if (lower.match(/movie|cinema|ticket|entertainment|game/)) return "Entertainment";
  if (lower.match(/electric|water|bill|utility|tenaga|tm|unifi/)) return "Bills";
  if (lower.match(/pharmacy|clinic|hospital|health|medical/)) return "Health";
  if (lower.match(/education|school|university|college/)) return "Education";
  return "Others";
};

// Very simple heuristic to guess payment method from receipt text
const detectPaymentMethod = (text: string, receiptPaymentMethod?: string | null): string => {
  // First, check if the receipt has a payment_method field
  if (receiptPaymentMethod) {
    const lower = (receiptPaymentMethod || "").toLowerCase();
    if (lower.includes("cash")) return "Cash";
    if (lower.includes("card") || lower.includes("credit") || lower.includes("debit")) return "Credit Card";
    if (lower.includes("bank") || lower.includes("transfer") || lower.includes("qr") || lower.includes("duitnow")) return "Bank";
  }

  const lower = (text || "").toLowerCase();

  // Look for QR payment methods (DuitNow, Touch n Go, GrabPay, etc.)
  if (
    lower.match(/duitnow|duit now|qr pay|qr code|qr payment|touch n go|touchngo|grabpay|grab pay|boost|favepay|wechat pay|alipay|paywave|pay wave/)
  ) {
    return "Bank";
  }

  // Look for common card keywords
  if (
    lower.match(/visa|mastercard|master card|credit card|debit card|card ending|amex|american express/)
  ) {
    return "Credit Card";
  }

  // Look for bank / online banking hints
  if (
    lower.match(/online banking|bank transfer|maybank|cimb|rhb|hong leong|public bank|bank islam/)
  ) {
    return "Bank";
  }

  // Fallback
  return "Cash";
};


// =================== Component ===================
export default function Home() {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [total, setTotal] = useState(0);
  const [expenseRecords, setExpenseRecords] = useState<ExpenseRecord[]>([]);
  const [behaviourReport, setBehaviourReport] = useState<{
    insights: Array<{
      message: string;
      severity: "critical" | "warning" | "info";
      icon?: string;
      type?: string;
      actionable?: boolean;
    }>;
    summary?: {
      overallHealth?: string;
      keyConcerns?: string[];
      positiveHighlights?: string[];
    };
    totals?: {
      monthTotal?: number;
      trendMoM?: number;
    };
  } | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [categoryBreakdown, setCategoryBreakdown] = useState<Record<string, number>>({});
  const [isScanningReceipt, setIsScanningReceipt] = useState(false);

  // 🔁 NEW: overall budget progress (current month)
  const [budgetTotal, setBudgetTotal] = useState(0);
  const [budgetSpent, setBudgetSpent] = useState(0);
  const [budgetRemaining, setBudgetRemaining] = useState(0);
  const [budgetUsedPct, setBudgetUsedPct] = useState(0);

  const [incomeRecords, setIncomeRecords] = useState<IncomeRecord[]>([]);

  const [debts, setDebts] = useState<Debt[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      const userData = await getUsernameFromFirestore();
      if (userData) {
        setUsername(userData.username);
        setTotal(userData.totalBalance);
      }
    };
    loadUserData();
  }, []);

  // ============ Debt health helpers ============

type Payment = {
  id: string;
  amount: number;
  dateISO: string;
  note?: string;
};

type Debt = {
  id: string;
  name?: string;
  originalAmount: number;
  currentBalance: number;
  monthlyPayment: number;
  payments: Payment[];
};

const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, n));

/** DTI 40%, Progress 30%, Payment Consistency 20%, Debt Count 10% */
function scoreFromDTI(dti: number) {
  return clamp(100 - Math.max(0, dti * 100 - 15) * 1.8);
}

function scoreFromProgress(debts: Debt[]) {
  if (debts.length === 0) return 100;
  const progressScores = debts.map((d) => {
    if (d.originalAmount <= 0) return 50;
    const progress =
      ((d.originalAmount - d.currentBalance) / d.originalAmount) * 100;
    return clamp(progress, 0, 100);
  });
  return progressScores.reduce((a, b) => a + b, 0) / progressScores.length;
}

function scoreFromConsistency(debts: Debt[]) {
  if (debts.length === 0) return 100;
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const consistencyScores = debts.map((d) => {
    const recentPayments = d.payments.filter(
      (p) => new Date(p.dateISO) >= threeMonthsAgo
    );
    if (recentPayments.length === 0) return 30;
    if (recentPayments.length >= 2) return 100;
    return 60;
  });
  return consistencyScores.reduce((a, b) => a + b, 0) / consistencyScores.length;
}

function scoreFromDebtCount(n: number) {
  if (n === 0) return 100;
  if (n <= 3) return 100;
  if (n <= 6) return 80;
  return clamp(80 - (n - 6) * 10, 30, 80);
}

// Load userId (from AsyncStorage)
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

// Subscribe to user's debts
useEffect(() => {
  if (!userId) return;

  const unsub = subscribeUserDebts(
    userId,
    (rows) => setDebts(rows as Debt[]),
    (err) => console.error("Home subscribeUserDebts error:", err)
  );

  return () => {
    if (unsub) unsub();
  };
}, [userId]);

const debtHealth = useMemo(() => {
  if (!debts.length) return null;

  const totalMonthly = debts.reduce(
    (sum, d) => sum + (d.monthlyPayment || 0),
    0
  );

  const dti = income > 0 ? totalMonthly / income : 0;

  const sDTI = scoreFromDTI(dti);
  const sProgress = scoreFromProgress(debts);
  const sConsistency = scoreFromConsistency(debts);
  const sCount = scoreFromDebtCount(debts.length);

  const healthScore = Math.round(
    0.4 * sDTI + 0.3 * sProgress + 0.2 * sConsistency + 0.1 * sCount
  );

  return {
    healthScore,
    dti,
    sDTI,
    sProgress,
    sConsistency,
    sCount,
  };
}, [debts, income]);

  // Subscribe to expense and income records for real-time updates
  useEffect(() => {
  let unsubExp: (() => void) | null = null;
  let unsubInc: (() => void) | null = null;

  const setup = async () => {
    try {
      const monthKey = getCurrentMonthKey();
      const { startISO, endISO } = getMonthDateRange(monthKey);

      // EXPENSES (current month only)
      unsubExp = await subscribeUserExpenseRecords(
        (records) => {
          setExpenseRecords(records);

          const monthExpense = records
            .filter(r => r.dateISO && r.dateISO >= startISO && r.dateISO < endISO)
            .reduce((sum, r) => sum + r.amount, 0);
          setExpense(monthExpense);

          const breakdown = records
            .filter(r => r.dateISO && r.dateISO >= startISO && r.dateISO < endISO)
            .reduce<Record<string, number>>((acc, r) => {
              const cat = r.category || "Miscellaneous";
              acc[cat] = (acc[cat] || 0) + r.amount;
              return acc;
            }, {});
          setCategoryBreakdown(breakdown);
        },
        (err) => console.error("Expense sub error:", err)
      );

      // INCOME (current month only)
      unsubInc = await subscribeUserIncomeRecords(
        (rows) => {
          setIncomeRecords(rows);
          const monthIncome = rows
            .filter(r => r.dateISO && r.dateISO >= startISO && r.dateISO < endISO)
            .reduce((sum, r) => sum + r.amount, 0);
          setIncome(monthIncome);
        },
        (err) => console.error("Income sub error:", err)
      );
    } catch (e) {
      console.error("Subscription setup error:", e);
    }
  };

  setup();
  return () => { if (unsubExp) unsubExp(); if (unsubInc) unsubInc(); };
}, []);

  // 🔁 NEW: load current-month budget progress (re-run whenever expenses change)
  useEffect(() => {
    const loadBudgetProgress = async () => {
      try {
        const monthKey = getCurrentMonthKey();
        const progress = await getBudgetProgress(monthKey);
        if (progress) {
          setBudgetTotal(progress.totalBudget);
          setBudgetSpent(progress.totalSpent);
          setBudgetRemaining(progress.remaining);
          setBudgetUsedPct(progress.utilizationPct); // already 0..100
        } else {
          // No saved budget for this month
          setBudgetTotal(0);
          setBudgetSpent(0);
          setBudgetRemaining(0);
          setBudgetUsedPct(0);
        }
      } catch (e) {
        console.error("loadBudgetProgress error:", e);
      }
    };
    loadBudgetProgress();
  }, [expenseRecords]);

  // Run AI-powered behavior analysis when data changes
  const runBehaviorAnalysis = async () => {
    try {
      setIsLoadingAnalysis(true);
      const userId = await AsyncStorage.getItem("userId");
      if (!userId) {
        setIsLoadingAnalysis(false);
        return;
      }

      // Get current month key
      const monthKey = getCurrentMonthKey();
      const { startISO, endISO } = getMonthDateRange(monthKey);

      // Filter expenses and income for current month
      const monthExpenses = expenseRecords.filter(
        (r) => r.dateISO && r.dateISO >= startISO && r.dateISO < endISO
      );
      const monthIncomes = incomeRecords.filter(
        (r) => r.dateISO && r.dateISO >= startISO && r.dateISO < endISO
      );

      // Get budget data
      let budgetData = {
        totalBudget: 0,
        totalSpent: 0,
        remaining: 0,
        allocations: {} as Record<string, number>,
      };

      try {
        const userBudget = await getUserBudget();
        if (userBudget) {
          budgetData.totalBudget = userBudget.totalBudget || 0;
          budgetData.allocations = userBudget.allocations || {};
        }

        const progress = await getBudgetProgress(monthKey);
        if (progress) {
          budgetData.totalSpent = progress.totalSpent;
          budgetData.remaining = progress.remaining;
        }
      } catch (error) {
        console.error("Error loading budget:", error);
      }

      // Prepare expenses data
      const expensesData = monthExpenses.map((r) => ({
        id: r.id,
        amount: Number(r.amount) || 0,
        category: (r.category as string) || "Others",
        description: (r.description || (r as any).note || "").toString(),
        dateISO: r.dateISO,
        note: (r as any).note || "",
      }));

      // Prepare income data
      const incomesData = monthIncomes.map((r) => ({
        id: r.id,
        amount: Number(r.amount) || 0,
        category: (r.category as string) || "Others",
        dateISO: r.dateISO,
        source: (r as any).source || "",
      }));

      // Prepare debt data
      const debtsData = debts.map((d) => ({
        id: d.id,
        name: d.name || "Unknown",
        currentBalance: Number(d.currentBalance) || 0,
        monthlyPayment: Number(d.monthlyPayment) || 0,
        originalAmount: Number(d.originalAmount) || 0,
      }));

      // Use total balance as savings (or could fetch from savings collection)
      const savingsAmount = total > 0 ? total : 0;

      // Call AI behavior analysis endpoint
      const response = await fetch(`${CHAT_SERVER_URL}/ai/behavior-analysis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expenses: expensesData,
          incomes: incomesData,
          debts: debtsData,
          budget: budgetData,
          savings: savingsAmount,
          currentMonthKey: monthKey,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Calculate trend for display (compare with previous month if available)
        const prevMonthKey = (() => {
          const [y, m] = monthKey.split("-").map(Number);
          const d = new Date(y, m - 2, 1);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        })();

        const prevMonthExpenses = expenseRecords.filter((r) => {
          if (!r.dateISO) return false;
          const rMonthKey = r.dateISO.slice(0, 7);
          return rMonthKey === prevMonthKey;
        });

        const prevMonthTotal = prevMonthExpenses.reduce(
          (sum, r) => sum + (Number(r.amount) || 0),
          0
        );
        const currentMonthTotal = monthExpenses.reduce(
          (sum, r) => sum + (Number(r.amount) || 0),
          0
        );

        const trendMoM =
          prevMonthTotal > 0
            ? (currentMonthTotal - prevMonthTotal) / prevMonthTotal
            : undefined;

        setBehaviourReport({
          insights: result.insights || [],
          summary: result.summary || {},
          totals: {
            monthTotal: result.metrics?.totalExpenses || currentMonthTotal,
            trendMoM,
          },
        });
      } else {
        throw new Error(result.error || "Analysis failed");
      }

      setIsLoadingAnalysis(false);
    } catch (e: any) {
      console.error("AI Behavior analysis error:", e);
      setIsLoadingAnalysis(false);
      // Set a fallback message
      setBehaviourReport({
        insights: [
          {
            message: "Unable to analyze behavior at this time. Please try again later.",
            severity: "info",
            icon: "ℹ️",
          },
        ],
        summary: {},
        totals: {},
      });
    }
  };

  useEffect(() => {
    // Run analysis when expenses, income, debts, or budget changes
    if (expenseRecords.length > 0 || incomeRecords.length > 0 || debts.length > 0) {
      runBehaviorAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseRecords, incomeRecords, debts, budgetTotal, budgetSpent]);

  // Calculate categories from real data
  const getCategoriesForDisplay = () => {
    const total = Object.values(categoryBreakdown).reduce((sum, val) => sum + val, 0);
    if (total === 0) return [];

    const categoryColors: Record<string, string> = {
      Food: "#f59e0b",
      Shopping: "#10b981",
      Bills: "#3b82f6",
      Entertainment: "#8b5cf6",
      Transport: "#ec4899",
      Healthcare: "#ef4444",
      Education: "#06b6d4",
      Miscellaneous: "#6b7280",
    };

    const categoryIcons: Record<string, string> = {
      Food: "restaurant",
      Shopping: "shopping-bag",
      Bills: "home",
      Entertainment: "film",
      Transport: "car",
      Healthcare: "medical",
      Education: "school",
      Miscellaneous: "ellipse",
    };

    const sorted = Object.entries(categoryBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, amount]) => ({
        name,
        amount: Math.round(amount),
        color: categoryColors[name] || "#6b7280",
        icon: categoryIcons[name] || "ellipse",
        percent: Math.round((amount / total) * 100),
        height: Math.max(30, Math.round((amount / total) * 120)),
      }));

    return sorted;
  };

  const categories = getCategoriesForDisplay();

  // Get behavior insights from AI analysis
  const getBehaviorInsights = (): { text: string; type: string; severity?: string; icon?: string }[] => {
    if (!behaviourReport || !behaviourReport.insights || behaviourReport.insights.length === 0) {
      if (isLoadingAnalysis) {
        return [
          { text: "Analyzing your financial behavior with AI...", type: "good", icon: "🤖" },
        ];
      }
      if (expenseRecords.length === 0 && incomeRecords.length === 0) {
        return [
          { text: "Start tracking expenses and income to unlock AI-powered insights! 📊", type: "good", icon: "💡" },
        ];
      }
      return [
        { text: "No insights available yet. Add more transactions to get personalized analysis.", type: "good", icon: "ℹ️" },
      ];
    }

    // AI already sorts by severity (critical > warning > info), so we just take top 6-8
    return behaviourReport.insights.slice(0, 8).map((insight) => ({
      text: insight.message,
      type: insight.severity === "critical" || insight.severity === "warning" ? "warning" : "good",
      severity: insight.severity,
      icon: insight.icon || "💡",
    }));
  };

  const insights = getBehaviorInsights();

  const handleScanReceipt = async (): Promise<void> => {
    Alert.alert(
      "Scan Receipt",
      "Choose how you want to upload your receipt:",
      [
        {
          text: "Camera",
          onPress: async () => {
            try {
              const { status } = await ImagePicker.requestCameraPermissionsAsync();
              if (status !== "granted") { Alert.alert("Permission required", "Please allow camera access."); return; }
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                base64: true,
                quality: 0.5,
              });
              if (!result.canceled) {
                await processReceipt(result.assets[0].uri, result.assets[0].base64 ?? undefined);
              }
            } catch (err) {
              console.error("Camera error:", err);
              Alert.alert("Error", "Failed to open camera.");
            }
          },
        },
        {
          text: "Gallery",
          onPress: async () => {
            try {
              const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!permission.granted) { Alert.alert("Permission required", "Please allow access to your gallery."); return; }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                base64: true,
                quality: 0.5,
              });
              if (!result.canceled) {
                await processReceipt(result.assets[0].uri, result.assets[0].base64 ?? undefined);
              }
            } catch (err) {
              console.error("Gallery error:", err);
              Alert.alert("Error", "Failed to open gallery.");
            }
          },
        },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const processReceipt = async (uri: string, base64?: string) => {
    try {
      setIsScanningReceipt(true);
      await manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.5, base64: true }
      );

      const formData = new FormData();
      formData.append("file", {
        uri,
        name: "receipt.jpg",
        type: "image/jpeg",
      } as any);

      const response = await fetch(OCR_SERVER_URL, { method: "POST", body: formData });
      const result = await response.json();
      console.log("🧾 OCR result:", JSON.stringify(result, null, 2));

      if (!result?.receipts?.length) {
        Alert.alert("No receipt detected", "Please try another image.");
        return;
      }

      const receipt = result.receipts[0];
      const total = receipt.total || receipt.totalInclTax || "0.00";
      const date  = normalizeReceiptDate(receipt.date);
      const rawText = receipt.ocr_text || receipt.raw_text || "";
      const merchantName = receipt.merchant_name || "";
      const receiptPaymentMethod = receipt.payment_method || null;

      const serviceCharge = typeof receipt.service_charge === "number" ? receipt.service_charge : 0;
      const taxAmount = typeof receipt.tax === "number" ? receipt.tax : 0;

      const category = detectCategory(rawText);
      const paymentMethod = detectPaymentMethod(rawText, receiptPaymentMethod);

      console.log("💰 Total:", total);
      console.log("📅 Date:", date);
      console.log("🏷️ Category:", category);
      console.log("🏦 Payment Method:", paymentMethod);
      console.log("🏪 Merchant:", merchantName);

      if (receipt.items && receipt.items.length > 0) {
        router.push({
          pathname: "/screen/SelectReceiptItems",
          params: {
            items: JSON.stringify(receipt.items),
            merchant: merchantName,
            date,
            category,
            paymentMethod,
            subtotal: receipt.sub_total != null ? String(receipt.sub_total) : "",
            serviceCharge: serviceCharge ? String(serviceCharge) : "",
            tax: taxAmount ? String(taxAmount) : "",
            grandTotal: String(total),
          },
        });
      } else {
        router.push({
          pathname: "/screen/AddRecord",
          params: {
            amount: total.toString(),
            date,
            note: (rawText as string).slice(0, 120),
            category,
            merchantName,
            paymentMethod,
          },
        });
      }
    } catch (error) {
      console.error("❌ Error processing receipt:", error);
      Alert.alert("Error", "Failed to process the receipt. Try again.");
    } finally {
      setIsScanningReceipt(false);
    }
  };


  const getInsightStyle = (severity?: string) => {
    switch (severity) {
      case "critical":
        return { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5", iconColor: "#DC2626" };
      case "warning":
        return { backgroundColor: "#FEF3C7", borderColor: "#FDE68A", iconColor: "#D97706" };
      case "info":
      default:
        return { backgroundColor: "#D1FAE5", borderColor: "#A7F3D0", iconColor: "#059669" };
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
          <View style={styles.headerContainer}>
            {/* Ask Auri (unchanged) */}
            <TouchableOpacity style={styles.askAuriButton} onPress={() => router.push("/screen/Avatar")}>
              <Text style={styles.askAuriText}>Ask Auri ✨</Text>
            </TouchableOpacity>

            {/* Greeting text flows normally */}
            <Text style={styles.greeting}>Hey, {username || "Guest"} 👋</Text>
            <Text style={styles.subWelcome}>Welcome back to your finances</Text>

            {/* Absolutely-positioned logout (won't affect greeting layout) */}
            <TouchableOpacity
              style={styles.logoutFab}
              onPress={async () => {
                Alert.alert("Logout", "Are you sure you want to log out?", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Yes, Logout",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        const rememberedEmail = await AsyncStorage.getItem("email");
                        const rememberedPassword = await AsyncStorage.getItem("password");
                        await AsyncStorage.multiRemove(["loggedIn", "userId", "userEmail", "token"]);
                        if (rememberedEmail) await AsyncStorage.setItem("email", rememberedEmail);
                        if (rememberedPassword) await AsyncStorage.setItem("password", rememberedPassword);
                        router.replace("/screen/SignIn");
                      } catch (error) {
                        console.error("Error during logout:", error);
                      }
                    },
                  },
                ]);
              }}
            >
              <Ionicons name="log-out-outline" size={20} color="#fff" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>

            {/* Balance Card */}
            <View style={styles.balanceCard}>
              <View style={styles.balanceContainer}>
                <Text style={styles.totalBalanceLabel}>Total Balance</Text>
                <View style={styles.balanceRow}>
                  <Text style={styles.totalBalanceValue}>
                    {isVisible ? `RM ${total.toLocaleString()}` : "RM *****"}
                  </Text>
                  <TouchableOpacity onPress={() => setIsVisible(!isVisible)}>
                    <Ionicons
                      name={isVisible ? "eye-outline" : "eye-off-outline"}
                      size={22}
                      color="#fff"
                      style={{ marginLeft: 8 }}
                    />
                  </TouchableOpacity>
                </View>

                {behaviourReport && behaviourReport.totals && (
                  <View style={styles.trendContainer}>
                    <View style={[
                      styles.trendBadge,
                      { backgroundColor: behaviourReport.totals.trendMoM && behaviourReport.totals.trendMoM > 0 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)' }
                    ]}>
                      <Ionicons 
                        name={behaviourReport.totals.trendMoM && behaviourReport.totals.trendMoM > 0 ? "trending-up" : "trending-down"} 
                        size={16} 
                        color={behaviourReport.totals.trendMoM && behaviourReport.totals.trendMoM > 0 ? "#EF4444" : "#10B981"} 
                      />
                      <Text style={[
                        styles.trendText,
                        { color: behaviourReport.totals.trendMoM && behaviourReport.totals.trendMoM > 0 ? "#EF4444" : "#10B981" }
                      ]}>
                        {behaviourReport.totals.trendMoM !== undefined 
                          ? `${behaviourReport.totals.trendMoM > 0 ? '+' : ''}${(behaviourReport.totals.trendMoM * 100).toFixed(1)}%`
                          : '0%'
                        } vs last month
                      </Text>
                    </View>
                  </View>
                )}

                {/* Income vs Expenses */}
                <View style={styles.incomeExpenseRow}>
                  <View style={styles.incomeBox}>
                    <View style={styles.incomeHeader}>
                      <Ionicons name="arrow-down" size={20} color="#10B981" />
                      <Text style={styles.incomeLabel}>Monthly Income</Text>
                    </View>
                    <Text style={styles.incomeValue}>RM {income.toLocaleString()}</Text>
                  </View>

                  <View style={styles.expenseBox}>
                    <View style={styles.incomeHeader}>
                      <Ionicons name="arrow-up" size={20} color="#EF4444" />
                      <Text style={styles.incomeLabel}>Monthly Expenses</Text>
                    </View>
                    <Text style={styles.incomeValue}>RM {expense.toLocaleString()}</Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionBox, { backgroundColor: "#D9F7BE" }]} onPress={() => router.push("/screen/AddRecord")}>
                  <Ionicons name="add" size={28} color="#1E3932" />
                  <Text style={styles.actionText}>Add</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionBox, { backgroundColor: "#FFF9C4" }]} onPress={handleScanReceipt}>
                  <Ionicons name="scan-outline" size={28} color="#1E3932" />
                  <Text style={styles.actionText}>Scan</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionBox, { backgroundColor: "#BBDEFB" }]} onPress={() => router.push("/screen/Savings")}>
                  <Ionicons name="wallet-outline" size={28} color="#1E3932" />
                  <Text style={styles.actionText}>Savings</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBox, { backgroundColor: "#F3E8FF" }]}
                  onPress={() => router.push("/screen/Debt")}
                >
                  <Ionicons name="card-outline" size={28} color="#1E3932" />
                  <Text style={styles.actionText}>Debt</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>


        {/* Health & Goals Cards */}
        <View style={styles.statsContainer}>
            <TouchableOpacity
              style={[styles.statCard, styles.healthCard]}
              activeOpacity={0.8}
              onPress={() => router.push("/screen/Debt")}
            >
              <Ionicons name="trophy" size={24} color="#fff" style={styles.statIcon} />
              <Text style={styles.statLabel}>Health Score</Text>

              <Text style={styles.statValue}>
                {debtHealth ? `${debtHealth.healthScore}%` : "—"}
              </Text>

              <Text style={styles.statSubtext}>
                {debtHealth
                  ? debtHealth.healthScore >= 80
                    ? "Excellent"
                    : debtHealth.healthScore >= 60
                    ? "Good standing"
                    : "Needs attention"
                  : "Add your debts to see score"}
              </Text>
            </TouchableOpacity>

          {/* Month Budget Progress */}
          <TouchableOpacity
            style={[styles.statCard, styles.goalCard]}
            activeOpacity={0.8}
            onPress={() => router.push("/screen/BudgetAllocation")}
          >
            <Ionicons name="flag" size={24} color="#000" style={styles.statIcon} />
            <Text style={styles.statLabel2}>Budget Progress</Text>

            {budgetTotal > 0 ? (
              <>
                <Text style={styles.statValue2}>
                  {Math.min(100, Math.max(0, budgetUsedPct)).toFixed(0)}%
                </Text>
                <Text style={styles.statSubtext2}>
                  RM {budgetSpent.toLocaleString()} / {budgetTotal.toLocaleString()}
                </Text>

                {/* tiny progress bar */}
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(100, Math.max(0, budgetUsedPct))}%`,
                        backgroundColor:
                          budgetUsedPct >= 100
                            ? "#EF4444"
                            : budgetUsedPct >= 80
                            ? "#F59E0B"
                            : "#1E3932",
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressHint}>
                  {budgetUsedPct >= 100
                    ? "🚨 You’ve exceeded the monthly budget"
                    : budgetUsedPct >= 80
                    ? "⚠️ Caution — 80%+ used"
                    : "✅ Keep going!"}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.statValue2}>—</Text>
                <Text style={styles.statSubtext2}>No budget set for this month</Text>
                <TouchableOpacity
                  onPress={() => router.push("/screen/BudgetAllocation")}
                  style={styles.setBudgetBtn}
                >
                  <Ionicons name="create-outline" size={14} color="#1E3932" />
                  <Text style={styles.setBudgetText}>Set budget now</Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Behavior Analysis Insights */}
        <View style={styles.insightsContainer}>
          <View style={styles.sectionHeader}>
            <View style={styles.insightsIconWrapper}>
              <Ionicons name="sparkles" size={18} color="#F59E0B" />
            </View>
            <Text style={styles.sectionTitle}>AI Insights</Text>
            {isLoadingAnalysis && (
              <Text style={styles.loadingText}>Analyzing...</Text>
            )}
          </View>

          {insights.length === 0 ? (
            <View style={[styles.insightBox, styles.insightGood]}>
              <Text style={styles.insightText}>
                {expenseRecords.length === 0
                  ? "Start adding expenses to receive personalized insights! 📊"
                  : "Analyzing your spending patterns..."}
              </Text>
            </View>
          ) : (
            insights.map((insight, idx) => {
              const style = getInsightStyle(insight.severity);
              return (
                <View
                  key={idx}
                  style={[
                    styles.insightBox,
                    {
                      backgroundColor: style.backgroundColor,
                      borderColor: style.borderColor,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <View style={styles.insightHeader}>
                    <Text style={styles.insightIcon}>{insight.icon || "💡"}</Text>
                    {insight.severity === "critical" && (
                      <View style={styles.criticalBadge}>
                        <Text style={styles.criticalBadgeText}>URGENT</Text>
                      </View>
                    )}
                    {insight.severity === "warning" && (
                      <View style={styles.warningBadge}>
                        <Text style={styles.warningBadgeText}>WARNING</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.insightText, { color: "#1E3932" }]}>{insight.text}</Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      {isScanningReceipt && (
        <View style={styles.scanOverlay}>
          <View style={styles.scanOverlayInner}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.scanOverlayText}>Reading your receipt...</Text>
            <Text style={styles.scanOverlaySubtext}>This usually takes a few seconds.</Text>
          </View>
        </View>
      )}

      <BottomNav />
    </SafeAreaView>
  );
}

// =================== Styles ===================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E4F2ED" },
  scrollContent: { paddingBottom: 100 },
  headerContainer: { paddingHorizontal: 20, paddingTop: 12 },
  askAuriButton: { alignSelf: "center", backgroundColor: "#C9EAD6", paddingVertical: 6, paddingHorizontal: 20, borderRadius: 20 },
  askAuriText: { fontWeight: "600", color: "#1E3932" },
  subWelcome: { color: "#1E3932", opacity: 0.7, fontSize: 14, marginBottom: 12 },
  logoutButton: { flexDirection: "row", alignItems: "center", alignSelf: "flex-end", backgroundColor: "#1E3932", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginTop: 8 },
  logoutText: { color: "#fff", fontSize: 13, fontWeight: "600", marginLeft: 5 },
  balanceCard: { backgroundColor: "#ffffff", borderRadius: 15, paddingVertical: 15, paddingHorizontal: 15, marginTop: 10, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 5 },
  balanceContainer: { alignItems: "center", paddingVertical: 20, paddingHorizontal: 15, borderRadius: 15, backgroundColor: "#1E3932", width: "100%" },
  totalBalanceLabel: { color: "#C9EAD6", fontSize: 14 },
  balanceRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginVertical: 8 },
  totalBalanceValue: { color: "#fff", fontSize: 30, fontWeight: "700" },
  incomeExpenseRow: { flexDirection: "row", gap: 10, width: "100%" },
  incomeBox: { flex: 1, backgroundColor: "rgba(255, 255, 255, 0.1)", borderRadius: 10, padding: 10 },
  expenseBox: { flex: 1, backgroundColor: "rgba(255, 255, 255, 0.1)", borderRadius: 10, padding: 10 },
  incomeHeader: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6 },
  incomeLabel: { color: "#C9EAD6", fontSize: 15 },
  incomeValue: { color: "#fff", fontSize: 16, fontWeight: "700" },
  actionRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20, width: "100%", gap: 8 },
  actionBox: { flex: 1, height: 85, alignItems: "center", justifyContent: "center", borderRadius: 12 },
  actionText: { color: "#1E3932", fontWeight: "500", marginTop: 5, fontSize: 13 },
  insightsContainer: { paddingHorizontal: 20, marginTop: 25 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { fontWeight: "700", fontSize: 18, color: "#1E3932" },
  breakdownContainer: { paddingHorizontal: 20, marginTop: 25 },
  breakdownHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  breakdownSubtitle: { fontSize: 12, color: "#6b7280" },
  breakdownCard: { backgroundColor: "#fff", borderRadius: 15, padding: 15, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  chartContainer: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", height: 120, marginBottom: 20 },
  chartBar: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  barFill: { width: 40, borderTopLeftRadius: 6, borderTopRightRadius: 6, marginBottom: 8 },
  barIcon: { marginTop: 4 },
  categoryList: { gap: 8 },
  categoryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  categoryLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  categoryDot: { width: 12, height: 12, borderRadius: 6 },
  categoryName: { fontSize: 13, color: "#374151" },
  categoryRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  categoryAmount: { fontSize: 13, fontWeight: "600", color: "#1E3932" },
  categoryPercent: { fontSize: 12, color: "#6b7280", width: 35, textAlign: "right" },
  statsContainer: { paddingHorizontal: 20, marginTop: 25, flexDirection: "row", gap: 12 },
  statCard: { flex: 1, borderRadius: 15, padding: 15 },
  healthCard: { backgroundColor: "#115D59", borderRadius: 15, padding: 15, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6 },
  goalCard: { backgroundColor: "#B3DCD6", borderRadius: 15, padding: 15, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6 },
  statIcon: { opacity: 0.9, marginBottom: 8 },
  statLabel: { color: "#fff", fontSize: 12, opacity: 0.9 },
  statValue: { color: "#fff", fontSize: 28, fontWeight: "700", marginTop: 4 },
  statSubtext: { color: "#fff", fontSize: 11, opacity: 0.8, marginTop: 4 },
  statLabel2: { color: "#000", fontSize: 12, opacity: 0.9 },
  statValue2: { color: "#000", fontSize: 28, fontWeight: "700", marginTop: 4 },
  statSubtext2: { color: "#000", fontSize: 11, opacity: 0.8, marginTop: 4 },
insightBox: {
  borderRadius: 12,
  padding: 12,
  marginBottom: 8,
  borderWidth: 1,
},
insightGood: {
  backgroundColor: "#D1FAE5",
  borderColor: "#A7F3D0",
},
insightWarning: {
  backgroundColor: "#FEF3C7",
  borderColor: "#FDE68A",
},
insightText: {
  color: "#1E3932",
  fontSize: 13,
  lineHeight: 18,
},
insightHeader: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 6,
},
insightIcon: {
  fontSize: 20,
},
criticalBadge: {
  backgroundColor: "#DC2626",
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: 4,
},
criticalBadgeText: {
  color: "#fff",
  fontSize: 10,
  fontWeight: "700",
},
warningBadge: {
  backgroundColor: "#D97706",
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: 4,
},
warningBadgeText: {
  color: "#fff",
  fontSize: 10,
  fontWeight: "700",
},
loadingText: {
  fontSize: 11,
  color: "#6b7280",
  marginLeft: 8,
  fontStyle: "italic",
},
analysisSummary: {
  marginTop: 12,
  padding: 12,
  backgroundColor: "rgba(255, 255, 255, 0.1)",
  borderRadius: 10,
  width: "100%",
},
summaryRow: {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginVertical: 4,
},
summaryLabel: {
  color: "#C9EAD6",
  fontSize: 12,
  fontWeight: "500",
},
summaryValue: {
  color: "#fff",
  fontSize: 14,
  fontWeight: "700",
},
emptyBreakdown: {
  padding: 32,
  alignItems: "center",
  justifyContent: "center",
},
emptyBreakdownText: {
  fontSize: 16,
  fontWeight: "600",
  color: "#6b7280",
  marginBottom: 8,
},
emptyBreakdownSubtext: {
  fontSize: 12,
  color: "#9ca3af",
  textAlign: "center",
},
greeting: {
  fontSize: 18,
  color: "#1E3932",
  fontWeight: "600",
  flexShrink: 1,
  marginTop: 15,
},
logoutButtonRow: {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#1E3932",
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 12,
  gap: 6,
  marginTop: 0,
},
logoutFab: {
    position: "absolute",
    right: 16,
    top: 57, 
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E3932",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    zIndex: 10,           
    gap: 6,
  },
    trendContainer: {
    marginBottom: 20,
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  trendText: {
    fontSize: 15,
    fontWeight: "600",
  },
    insightsIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
   // budget progress bar
  progressTrack: {
    height: 8,
    width: "100%",
    backgroundColor: "#E6F4EE",
    borderRadius: 999,
    marginTop: 10,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  progressHint: {
    marginTop: 6,
    fontSize: 11,
    color: "#1E3932",
    fontWeight: "600",
  },
  // CTA for no-budget
  setBudgetBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  setBudgetText: {
    color: "#1E3932",
    fontWeight: "800",
    fontSize: 12,
  },
  scanOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  scanOverlayInner: {
    backgroundColor: "#1E3932",
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: "center",
    width: "75%",
  },
  scanOverlayText: {
    marginTop: 12,
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  scanOverlaySubtext: {
    marginTop: 6,
    color: "#C9EAD6",
    fontSize: 12,
    textAlign: "center",
  },

});