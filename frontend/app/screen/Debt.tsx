// app/screen/Debt.tsx
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
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  subscribeUserIncomeRecords,
  type IncomeRecord,
} from "../utils/IncomeUtils";
import { getCurrentMonthKey } from "../utils/budgetUtils";

// 🔥 Firestore store (make sure you created app/utils/DebtUtils.ts)
import {
  subscribeUserDebts,
  upsertDebt,
  addDebtPayment,
  deleteDebtDeep,
} from "../utils/DebtUtils";

// If you use Firebase Auth, import your initialized auth
import { auth } from "../../firebase";

/* ---------- Brand / UI ---------- */
const BRAND_BG_GRADIENT = ["#1E5449", "#154C42", "#0F3D35"] as const;
const BRAND_DARK = "#1E3932";
const BRAND_GREEN = "#22C55E";
const CARD_BG = "#FFFFFF";
const LINE_SOFT = "#E5E7EB";
const MUTED = "#6B7280";
const RED = "#EF4444";
const ORANGE = "#F59E0B";
const BLUE = "#3B82F6";

type DebtType =
  | "Credit Card"
  | "Personal Loan"
  | "Mortgage"
  | "Car Loan"
  | "Student Loan"
  | "Medical"
  | "Other";

type Payment = {
  id: string;
  amount: number;
  dateISO: string;
  note?: string;
};

type Debt = {
  id: string;
  name: string;
  type: DebtType;
  originalAmount: number;  // initial debt amount
  currentBalance: number;   // remaining balance
  monthlyPayment: number;   // target monthly payment
  targetDate?: string;      // target payoff date (ISO)
  payments: Payment[];      // payment history
  createdAt: string;        // ISO date
};

const TYPE_ICON: Record<DebtType, keyof typeof Ionicons.glyphMap> = {
  "Credit Card": "card",
  "Personal Loan": "cash",
  Mortgage: "home",
  "Car Loan": "car",
  "Student Loan": "school",
  Medical: "medical",
  Other: "wallet",
};

const TYPE_COLORS: Record<DebtType, string> = {
  "Credit Card": "#3B82F6",
  "Personal Loan": "#10B981",
  Mortgage: "#8B5CF6",
  "Car Loan": "#F59E0B",
  "Student Loan": "#EC4899",
  Medical: "#EF4444",
  Other: "#6B7280",
};

/* ---------- Helpers ---------- */
const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));
const fmtRM = (n: number) =>
  `RM ${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const parseNum = (s: string) => {
  const n = Number(String(s).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const monthStartEndISO = (yyyymm: string) => {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(y, (m || 1) - 1, 1).toISOString();
  const end = new Date(y, (m || 1), 1).toISOString();
  return { startISO: start, endISO: end };
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
};

const getMonthsRemaining = (currentBalance: number, monthlyPayment: number) => {
  if (monthlyPayment <= 0 || currentBalance <= 0) return null;
  return Math.ceil(currentBalance / monthlyPayment);
};

/* ---------- Health Score ---------- */
/** DTI 40%, Progress 30%, Payment Consistency 20%, Debt Count 10% */
function scoreFromDTI(dti: number) {
  return clamp(100 - Math.max(0, dti * 100 - 15) * 1.8);
}

function scoreFromProgress(debts: Debt[]) {
  if (debts.length === 0) return 100;
  const progressScores = debts.map(d => {
    if (d.originalAmount <= 0) return 50;
    const progress = ((d.originalAmount - d.currentBalance) / d.originalAmount) * 100;
    return clamp(progress, 0, 100);
  });
  return progressScores.reduce((a, b) => a + b, 0) / progressScores.length;
}

function scoreFromConsistency(debts: Debt[]) {
  if (debts.length === 0) return 100;
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  const consistencyScores = debts.map(d => {
    const recentPayments = d.payments.filter(p => new Date(p.dateISO) >= threeMonthsAgo);
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

/* ---------- Debt Row Component ---------- */
function DebtRow({
  d,
  onEdit,
  onDelete,
  onAddPayment,
}: {
  d: Debt;
  onEdit: () => void;
  onDelete: () => void;
  onAddPayment: () => void;
}) {
  const color = TYPE_COLORS[d.type];
  const progress = d.originalAmount > 0 ? ((d.originalAmount - d.currentBalance) / d.originalAmount) * 100 : 0;
  const monthsLeft = getMonthsRemaining(d.currentBalance, d.monthlyPayment);
  
  return (
    <View style={styles.debtCard}>
      {/* Header */}
      <View style={styles.debtHeader}>
        <View style={[styles.debtIcon, { backgroundColor: color + "22" }]}>
          <Ionicons name={TYPE_ICON[d.type]} size={22} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.debtName}>{d.name || d.type}</Text>
          <Text style={styles.debtType}>{d.type}</Text>
        </View>
        <View style={styles.debtActions}>
          <TouchableOpacity onPress={onEdit} style={styles.actionBtn}>
            <Ionicons name="create-outline" size={18} color={BRAND_DARK} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={[styles.actionBtn, { backgroundColor: "#FFF1F2" }]}>
            <Ionicons name="trash" size={16} color={RED} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%`, backgroundColor: color }]} />
        </View>
        <Text style={styles.progressText}>{Math.round(progress)}% paid off</Text>
      </View>

      {/* Balance Info */}
      <View style={styles.balanceSection}>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={[styles.balanceValue, { color }]}>{fmtRM(d.currentBalance)}</Text>
        </View>
        <View style={styles.balanceDivider} />
        <View style={styles.balanceItem}>
          <Text style={styles.balanceLabel}>Monthly Payment</Text>
          <Text style={styles.balanceValue}>{fmtRM(d.monthlyPayment)}</Text>
        </View>
      </View>

      {/* Timeline */}
      <View style={styles.timelineSection}>
        {monthsLeft ? (
          <>
            <Ionicons name="time-outline" size={16} color={MUTED} />
            <Text style={styles.timelineText}>
              {monthsLeft} month{monthsLeft !== 1 ? "s" : ""} remaining
              {monthsLeft <= 12 && <Text style={{ color: BRAND_GREEN }}> • On track!</Text>}
            </Text>
          </>
        ) : (
          <Text style={[styles.timelineText, { color: ORANGE }]}>
            Set monthly payment to see timeline
          </Text>
        )}
      </View>

      {/* Recent Payments */}
      {d.payments.length > 0 && (
        <View style={styles.paymentsSection}>
          <Text style={styles.paymentsTitle}>Recent Payments</Text>
          {d.payments.slice(0, 3).map((p) => (
            <View key={p.id} style={styles.paymentRow}>
              <Ionicons name="checkmark-circle" size={14} color={BRAND_GREEN} />
              <Text style={styles.paymentDate}>{formatDate(p.dateISO)}</Text>
              <Text style={styles.paymentAmount}>{fmtRM(p.amount)}</Text>
            </View>
          ))}
          {d.payments.length > 3 && (
            <Text style={styles.paymentsMore}>+{d.payments.length - 3} more</Text>
          )}
        </View>
      )}

      {/* Add Payment Button */}
      <TouchableOpacity onPress={onAddPayment} style={styles.addPaymentBtn}>
        <Ionicons name="add-circle" size={18} color={BRAND_DARK} />
        <Text style={styles.addPaymentText}>Record Payment</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ---------- Add/Edit Debt Modal ---------- */
function DebtEditor({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: Debt | null;
  onClose: () => void;
  onSave: (d: Debt) => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState<DebtType>(initial?.type || "Credit Card");
  const [originalAmount, setOriginalAmount] = useState(String(initial?.originalAmount ?? ""));
  const [currentBalance, setCurrentBalance] = useState(String(initial?.currentBalance ?? ""));
  const [monthlyPayment, setMonthlyPayment] = useState(String(initial?.monthlyPayment ?? ""));

  useEffect(() => {
    if (!open) return;
    setName(initial?.name || "");
    setType(initial?.type || "Credit Card");
    setOriginalAmount(String(initial?.originalAmount ?? ""));
    setCurrentBalance(String(initial?.currentBalance ?? ""));
    setMonthlyPayment(String(initial?.monthlyPayment ?? ""));
  }, [open, initial]);

  const save = () => {
    const orig = parseNum(originalAmount);
    const curr = parseNum(currentBalance);
    const monthly = parseNum(monthlyPayment);

    if (!orig || !curr) {
      Alert.alert("Missing info", "Please enter the original amount and current balance.");
      return;
    }
    if (curr > orig) {
      Alert.alert("Invalid balance", "Current balance cannot exceed original amount.");
      return;
    }

    const d: Debt = {
      id: initial?.id || String(Date.now()), // temp id; Firestore can also auto-id
      name: name.trim(),
      type,
      originalAmount: orig,
      currentBalance: curr,
      monthlyPayment: monthly,
      payments: initial?.payments || [],
      createdAt: initial?.createdAt || new Date().toISOString(),
    };
    onSave(d);
    onClose();
  };
  

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{initial ? "Edit Debt" : "Add Debt"}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={BRAND_DARK} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
            <LabeledInput label="Debt Name" value={name} onChangeText={setName} placeholder="e.g., Maybank Credit Card" />

            <View style={{ marginTop: 12 }}>
              <Text style={styles.inputLabel}>Type</Text>
              <View style={styles.typeGrid}>
                {(["Credit Card","Personal Loan","Mortgage","Car Loan","Student Loan","Medical","Other"] as DebtType[]).map((t) => {
                  const active = type === t;
                  return (
                    <TouchableOpacity key={t} onPress={() => setType(t)} style={[styles.typeChip, active && styles.typeChipActive]}>
                      <Ionicons name={TYPE_ICON[t]} size={14} color={active ? "#fff" : BRAND_DARK} />
                      <Text style={[styles.typeChipText, active && { color: "#fff" }]}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <LabeledInput 
              label="Original Amount" 
              value={originalAmount} 
              onChangeText={setOriginalAmount} 
              keyboardType="numeric" 
              placeholder="e.g., 10000" 
            />
            <LabeledInput 
              label="Current Balance" 
              value={currentBalance} 
              onChangeText={setCurrentBalance} 
              keyboardType="numeric" 
              placeholder="e.g., 7500" 
            />
            <LabeledInput 
              label="Target Monthly Payment" 
              value={monthlyPayment} 
              onChangeText={setMonthlyPayment} 
              keyboardType="numeric" 
              placeholder="e.g., 500" 
            />

            {parseNum(monthlyPayment) > 0 && parseNum(currentBalance) > 0 && (
              <View style={styles.estimateBox}>
                <Ionicons name="information-circle" size={16} color={BLUE} />
                <Text style={styles.estimateText}>
                  Estimated payoff: {getMonthsRemaining(parseNum(currentBalance), parseNum(monthlyPayment))} months
                </Text>
              </View>
            )}
          </ScrollView>

          <TouchableOpacity onPress={save} style={styles.modalPrimary}>
            <Ionicons name="save" size={18} color="#fff" />
            <Text style={styles.modalPrimaryText}>Save</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------- Payment Modal ---------- */
function PaymentModal({
  open,
  debt,
  onClose,
  onSave,
}: {
  open: boolean;
  debt: Debt | null;
  onClose: () => void;
  onSave: (debtId: string, payment: Payment) => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open && debt) {
      setAmount(String(debt.monthlyPayment || ""));
      setDate(new Date().toISOString().split("T")[0]);
      setNote("");
    }
  }, [open, debt]);

  const save = () => {
    if (!debt) return;
    const amt = parseNum(amount);
    if (!amt) {
      Alert.alert("Invalid amount", "Please enter a valid payment amount.");
      return;
    }

    const payment: Payment = {
      id: String(Date.now()),
      amount: amt,
      dateISO: new Date(date).toISOString(),
      note: note.trim() || undefined,
    };

    onSave(debt.id, payment);
    onClose();
  };

  if (!debt) return null;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Record Payment</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={BRAND_DARK} />
            </TouchableOpacity>
          </View>

          <View style={styles.paymentModalDebt}>
            <Text style={styles.paymentModalDebtName}>{debt.name || debt.type}</Text>
            <Text style={styles.paymentModalBalance}>Balance: {fmtRM(debt.currentBalance)}</Text>
          </View>

          <LabeledInput 
            label="Payment Amount" 
            value={amount} 
            onChangeText={setAmount} 
            keyboardType="numeric" 
            placeholder="e.g., 500" 
          />

          <LabeledInput 
            label="Payment Date" 
            value={date} 
            onChangeText={setDate} 
            placeholder="YYYY-MM-DD" 
          />

          <LabeledInput 
            label="Note (Optional)" 
            value={note} 
            onChangeText={setNote} 
            placeholder="e.g., Monthly payment" 
          />

          <TouchableOpacity onPress={save} style={styles.modalPrimary}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.modalPrimaryText}>Record Payment</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ---------- Small labeled input ---------- */
function LabeledInput(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        {...rest}
        style={[styles.input, style]}
        placeholderTextColor={MUTED}
      />
    </View>
  );
}

/* ---------- Main Screen ---------- */
export default function Debt() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [monthKey] = useState<string>(getCurrentMonthKey());

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);

  const [userId, setUserId] = useState<string | null>(null);

  const [showBreakdown, setShowBreakdown] = useState(false);

  // resolve user id and subscribe to debts
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("userId");
        const uid = stored || auth.currentUser?.uid || null;
        if (uid && !stored) await AsyncStorage.setItem("userId", uid);
        setUserId(uid);

        // if no user ID at all, stop loading so screen can render
        if (!uid) {
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to resolve userId", e);
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const unsub = subscribeUserDebts(
      userId,
      (rows) => {
        setDebts(rows as Debt[]);
        setLoading(false);  // ⬅️ stop loading once debts loaded
      },
      (e) => {
        console.error("subscribeUserDebts error:", e);
        setLoading(false);  // ⬅️ also stop loading on error
      }
    );

    return () => unsub?.();
  }, [userId]);

  // subscribe incomes (from DB)
  useEffect(() => {
    let unsub: null | (() => void) = null;
    (async () => {
      unsub = await subscribeUserIncomeRecords(setIncomes, console.error);
    })();
    return () => unsub?.();
  }, []);

  const { startISO, endISO } = useMemo(() => monthStartEndISO(monthKey), [monthKey]);

  // compute monthly income from DB for current month
  const incomeFromRecords = useMemo(() => {
    const arr = incomes.filter((r) => r.dateISO >= startISO && r.dateISO < endISO);
    const sum = arr.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    return sum;
  }, [incomes, startISO, endISO]);

  const monthlyIncome = incomeFromRecords;

  /* ----- Totals & Metrics ----- */
  const totals = useMemo(() => {
    const totalBalance = debts.reduce((s, d) => s + (d.currentBalance || 0), 0);
    const totalOriginal = debts.reduce((s, d) => s + (d.originalAmount || 0), 0);
    const totalMonthly = debts.reduce((s, d) => s + (d.monthlyPayment || 0), 0);
    const totalPaid = totalOriginal - totalBalance;

    const dti = monthlyIncome > 0 ? totalMonthly / monthlyIncome : 0;

    const sDTI = scoreFromDTI(dti);
    const sProgress = scoreFromProgress(debts);
    const sConsistency = scoreFromConsistency(debts);
    const sCount = scoreFromDebtCount(debts.length);

    const healthScore = Math.round(
      0.40 * sDTI + 
      0.30 * sProgress + 
      0.20 * sConsistency + 
      0.10 * sCount
    );

    // Highest balance = priority
    const priorityDebt = debts.length
      ? debts.slice().sort((a, b) => b.currentBalance - a.currentBalance)[0]
      : null;

    return {
      totalBalance,
      totalOriginal,
      totalMonthly,
      totalPaid,
      dti,
      healthScore,
      subscores: { sDTI, sProgress, sConsistency, sCount },
      priorityDebt,
    };
  }, [debts, monthlyIncome]);

  /* ----- Actions (Firestore) ----- */
  const openAdd = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (d: Debt) => { setEditing(d); setEditorOpen(true); };

  const saveDebt = async (d: Debt) => {
    if (!userId) return Alert.alert("Not signed in", "Please sign in first.");
    try {
      await upsertDebt(userId, d);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Save failed", e?.message ?? "Could not save debt.");
    }
  };

  const deleteDebt = (id: string) => {
    Alert.alert("Delete debt", "This will remove the debt and all payment history.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDebtDeep(id);
          } catch (e: any) {
            console.error(e);
            Alert.alert("Delete failed", e?.message ?? "Could not delete debt.");
          }
        },
      },
    ]);
  };

  const openPaymentModal = (d: Debt) => {
    setPaymentDebt(d);
    setPaymentModalOpen(true);
  };

  const savePayment = (debtId: string, payment: Payment) => {
    (async () => {
      if (!userId) return Alert.alert("Not signed in", "Please sign in first.");
      try {
        await addDebtPayment(userId, debtId, {
          amount: payment.amount,
          dateISO: payment.dateISO,
          note: payment.note,
        });
        Alert.alert("Payment Recorded!", `Payment of ${fmtRM(payment.amount)} has been recorded.`);
      } catch (e: any) {
        console.error(e);
        Alert.alert("Payment failed", e?.message ?? "Could not record payment.");
      }
    })();
  };

  /* ----- Suggestions ----- */
  const suggestions = useMemo(() => {
    const s: string[] = [];
    if (totals.dti > 0.40) {
      s.push("Your debt-to-income ratio is high. Try to increase income or reduce monthly obligations.");
    }
    if (totals.healthScore < 60) {
      s.push("Focus on making consistent payments to improve your debt health score.");
    }
    if (debts.length > 0 && debts.some(d => d.payments.length === 0)) {
      s.push("Start recording payments to track your progress and stay motivated!");
    }
    if (totals.priorityDebt && totals.priorityDebt.monthlyPayment === 0) {
      s.push(`Set a monthly payment goal for "${totals.priorityDebt.name}" to see your payoff timeline.`);
    }
    if (monthlyIncome === 0) {
      s.push("No income records found for this month. Add income entries so your DTI is accurate.");
    }
    return s;
  }, [totals, monthlyIncome, debts]);

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <LinearGradient
          colors={BRAND_BG_GRADIENT}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading your debts…</Text>
        </View>
      </SafeAreaView>
    );
  }


  /* ----- UI ----- */
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient colors={BRAND_BG_GRADIENT} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Debt Tracker</Text>
        <TouchableOpacity onPress={openAdd} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Health Score Card */}
        <View style={styles.card}>
          <View style={styles.scoreRow}>
            <View style={[styles.scoreBadge, { 
              borderColor: totals.healthScore >= 80 ? BRAND_GREEN + "33" : 
                          totals.healthScore >= 60 ? ORANGE + "33" : RED + "33"
            }]}>
              <Text style={[styles.scoreNumber, {
                color: totals.healthScore >= 80 ? BRAND_GREEN : 
                       totals.healthScore >= 60 ? ORANGE : RED
              }]}>{totals.healthScore}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scoreLabel}>Debt Health Score</Text>
              <Text style={[styles.scoreTag, { 
                color: totals.healthScore >= 80 ? BRAND_GREEN : 
                       totals.healthScore >= 60 ? ORANGE : RED 
              }]}>
                {totals.healthScore >= 80 ? "Excellent" : 
                 totals.healthScore >= 60 ? "Good" : "Needs Attention"}
              </Text>
            </View>
          </View>

          {/* Key Metrics */}
          <View style={styles.metricsGrid}>
            <MetricCard
              icon="wallet"
              label="Total Debt"
              value={fmtRM(totals.totalBalance)}
              color={RED}
            />
            <MetricCard
              icon="trending-up"
              label="Total Paid"
              value={fmtRM(totals.totalPaid)}
              color={BRAND_GREEN}
            />
            <MetricCard
              icon="calendar"
              label="Monthly Payment"
              value={fmtRM(totals.totalMonthly)}
              color={BLUE}
            />
            <MetricCard
              icon="stats-chart"
              label="DTI Ratio"
              value={`${Math.round(totals.dti * 100)}%`}
              color={ORANGE}
            />
          </View>

          {/* Score Breakdown – collapsible */}
          <View style={styles.subscores}>
            <TouchableOpacity
              style={styles.subscoresHeaderRow}
              onPress={() => setShowBreakdown((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Text style={styles.subscoresTitle}>Score Breakdown</Text>

              {/* "arrow down score breakdown" label + icon */}
              <View style={styles.subscoresToggle}>
                <Text style={styles.subscoresToggleText}>
                  {showBreakdown ? "Hide" : "Show"}
                </Text>
                <Ionicons
                  name={showBreakdown ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={MUTED}
                />
              </View>
            </TouchableOpacity>

            {showBreakdown && (
              <>
                <Subscore label="Debt-to-Income (40%)" value={totals.subscores.sDTI} />
                <Subscore label="Repayment Progress (30%)" value={totals.subscores.sProgress} />
                <Subscore label="Payment Consistency (20%)" value={totals.subscores.sConsistency} />
                <Subscore label="Number of Debts (10%)" value={totals.subscores.sCount} />
              </>
            )}
          </View>
        </View>

        {/* Priority Focus */}
        {totals.priorityDebt && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="flag" size={18} color={RED} />
              <Text style={[styles.cardTitle, { color: RED }]}>Priority Focus</Text>
            </View>
            <View style={styles.priorityCard}>
              <Text style={styles.priorityName}>{totals.priorityDebt.name || totals.priorityDebt.type}</Text>
              <Text style={styles.priorityBalance}>{fmtRM(totals.priorityDebt.currentBalance)}</Text>
              <Text style={styles.priorityHint}>Highest balance • Focus here first</Text>
            </View>
          </View>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="bulb" size={18} color={ORANGE} />
              <Text style={[styles.cardTitle, { color: ORANGE }]}>Recommendations</Text>
            </View>
            {suggestions.map((t, i) => (
              <View key={i} style={styles.tipRow}>
                <Ionicons name="checkmark-circle" size={16} color={BRAND_GREEN} />
                <Text style={styles.tipText}>{t}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Debts List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Debts ({debts.length})</Text>
          </View>

          {debts.length === 0 ? (
            <View style={styles.card}>
              <View style={styles.empty}>
                <Ionicons name="checkmark-done-circle" size={56} color={BRAND_GREEN} />
                <Text style={styles.emptyTitle}>No debts tracked</Text>
                <Text style={styles.emptyText}>Tap the + button to add a debt you want to track</Text>
              </View>
            </View>
          ) : (
            debts.map((d) => (
              <DebtRow
                key={d.id}
                d={d}
                onEdit={() => openEdit(d)}
                onDelete={() => deleteDebt(d.id)}
                onAddPayment={() => openPaymentModal(d)}
              />
            ))
          )}
        </View>
      </ScrollView>

      <DebtEditor
        open={editorOpen}
        initial={editing}
        onClose={() => setEditorOpen(false)}
        onSave={saveDebt}
      />

      <PaymentModal
        open={paymentModalOpen}
        debt={paymentDebt}
        onClose={() => setPaymentModalOpen(false)}
        onSave={savePayment}
      />
    </SafeAreaView>
  );
}

/* ---------- Metric Card Component ---------- */
function MetricCard({ icon, label, value, color }: { 
  icon: keyof typeof Ionicons.glyphMap; 
  label: string; 
  value: string; 
  color: string;
}) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

/* ---------- Subscore Component ---------- */
function Subscore({ label, value }: { label: string; value: number }) {
  const color = value >= 80 ? BRAND_GREEN : value >= 60 ? ORANGE : RED;
  return (
    <View style={styles.subscore}>
      <View style={[styles.subscoreBar, { width: `${value}%`, backgroundColor: color }]} />
      <View style={styles.subscoreMeta}>
        <Text style={styles.subscoreLabel}>{label}</Text>
        <Text style={[styles.subscoreValue, { color }]}>{Math.round(value)}</Text>
      </View>
    </View>
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
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "800" },

  subscoresHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  subscoresToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  subscoresToggleText: {
    fontSize: 11,
    fontWeight: "700",
    color: MUTED,
  },

  card: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: CARD_BG,
    padding: 16,
    ...shadow(3, 0.08),
  },

  section: {
    marginTop: 16,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },

  cardHeader: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8, 
    marginBottom: 12 
  },
  cardTitle: { 
    fontSize: 16, 
    fontWeight: "800", 
    color: BRAND_DARK 
  },

  scoreRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 16, 
    gap: 12 
  },
  scoreBadge: {
    width: 80, 
    height: 80, 
    borderRadius: 40,
    backgroundColor: "#F7FAF9", 
    alignItems: "center", 
    justifyContent: "center",
    borderWidth: 5,
  },
  scoreNumber: { 
    fontSize: 32, 
    fontWeight: "900", 
    letterSpacing: -1 
  },
  scoreLabel: { 
    fontWeight: "800", 
    color: BRAND_DARK,
    fontSize: 15,
  },
  scoreTag: { 
    fontWeight: "800", 
    marginTop: 2,
    fontSize: 13,
  },

  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: "47%",
    backgroundColor: "#F7FAF9",
    borderRadius: 12,
    padding: 12,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: MUTED,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "900",
  },

  incomeRow: {
    marginVertical: 12,
    backgroundColor: "#F7FAF9",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  incomeLabel: { 
    color: BRAND_DARK, 
    fontWeight: "800",
    fontSize: 13,
  },
  incomeValue: {
    color: BRAND_DARK,
    fontWeight: "900",
    fontSize: 16,
  },

  subscores: { 
    marginTop: 12, 
    gap: 10 
  },
  subscoresTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: BRAND_DARK,
    marginBottom: 4,
  },
  subscore: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    overflow: "hidden",
    height: 36,
    justifyContent: "center",
  },
  subscoreBar: { 
    position: "absolute", 
    left: 0, 
    top: 0, 
    bottom: 0, 
    borderRadius: 12 
  },
  subscoreMeta: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    paddingHorizontal: 12 
  },
  subscoreLabel: { 
    color: BRAND_DARK, 
    fontWeight: "700",
    fontSize: 12,
  },
  subscoreValue: { 
    fontWeight: "900",
    fontSize: 12,
  },

  priorityCard: {
    backgroundColor: RED + "11",
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: RED + "22",
  },
  priorityName: {
    fontSize: 16,
    fontWeight: "900",
    color: BRAND_DARK,
    marginBottom: 4,
  },
  priorityBalance: {
    fontSize: 24,
    fontWeight: "900",
    color: RED,
    marginBottom: 4,
  },
  priorityHint: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED,
  },

  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#F7FAF9",
    borderRadius: 10,
    marginTop: 8,
  },
  tipText: {
    flex: 1,
    color: BRAND_DARK,
    fontWeight: "600",
    fontSize: 13,
    lineHeight: 18,
  },

  debtCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 14,
    ...shadow(2, 0.06),
  },
  debtHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  debtIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  debtName: {
    fontSize: 15,
    fontWeight: "900",
    color: BRAND_DARK,
  },
  debtType: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED,
    marginTop: 2,
  },
  debtActions: {
    flexDirection: "row",
    gap: 6,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#F7FAF9",
    borderRadius: 10,
  },

  progressSection: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "800",
    color: BRAND_DARK,
    textAlign: "right",
  },

  balanceSection: {
    flexDirection: "row",
    backgroundColor: "#F7FAF9",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  balanceItem: {
    flex: 1,
  },
  balanceDivider: {
    width: 1,
    backgroundColor: LINE_SOFT,
    marginHorizontal: 12,
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: MUTED,
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: "900",
    color: BRAND_DARK,
  },

  timelineSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#F7FAF9",
    borderRadius: 10,
    marginBottom: 10,
  },
  timelineText: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED,
    flex: 1,
  },

  paymentsSection: {
    backgroundColor: BRAND_GREEN + "11",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  paymentsTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: BRAND_DARK,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  paymentDate: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: MUTED,
  },
  paymentAmount: {
    fontSize: 12,
    fontWeight: "900",
    color: BRAND_GREEN,
  },
  paymentsMore: {
    fontSize: 11,
    fontWeight: "700",
    color: MUTED,
    marginTop: 4,
    textAlign: "center",
  },

  addPaymentBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: BRAND_DARK,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addPaymentText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },

  empty: { 
    alignItems: "center", 
    paddingVertical: 32, 
    gap: 8 
  },
  emptyTitle: { 
    color: BRAND_DARK, 
    fontWeight: "900", 
    fontSize: 16 
  },
  emptyText: { 
    color: MUTED, 
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 20,
  },

  modalWrap: { 
    flex: 1, 
    backgroundColor: "rgba(0,0,0,0.4)", 
    justifyContent: "flex-end" 
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20,
    padding: 16, 
    maxHeight: "85%",
  },
  modalHeader: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: { 
    fontWeight: "900", 
    color: BRAND_DARK, 
    fontSize: 17 
  },
  inputLabel: { 
    color: MUTED, 
    fontWeight: "700", 
    marginBottom: 6, 
    fontSize: 12 
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12, 
    borderWidth: 1, 
    borderColor: LINE_SOFT,
    paddingHorizontal: 12, 
    paddingVertical: 10,
    color: BRAND_DARK, 
    fontWeight: "800",
  },
  typeGrid: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    gap: 8 
  },
  typeChip: {
    flexDirection: "row", 
    alignItems: "center", 
    gap: 6,
    borderWidth: 1, 
    borderColor: LINE_SOFT, 
    borderRadius: 999,
    paddingHorizontal: 12, 
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  typeChipActive: { 
    backgroundColor: BRAND_DARK, 
    borderColor: BRAND_DARK 
  },
  typeChipText: { 
    color: BRAND_DARK, 
    fontWeight: "800", 
    fontSize: 12 
  },

  estimateBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    padding: 12,
    backgroundColor: BLUE + "11",
    borderRadius: 10,
  },
  estimateText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: BRAND_DARK,
  },

  paymentModalDebt: {
    backgroundColor: "#F7FAF9",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  paymentModalDebtName: {
    fontSize: 15,
    fontWeight: "900",
    color: BRAND_DARK,
    marginBottom: 4,
  },
  paymentModalBalance: {
    fontSize: 13,
    fontWeight: "700",
    color: MUTED,
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

  modalPrimary: {
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "center",
    gap: 8, 
    marginTop: 16,
    backgroundColor: BRAND_DARK, 
    paddingVertical: 12, 
    borderRadius: 12,
  },
  modalPrimaryText: { 
    color: "#fff", 
    fontWeight: "900" 
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
