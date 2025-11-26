// app/screen/BudgetAllocationScreen.tsx
import { useRouter } from "expo-router";
import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import BottomNav from "../component/BottomNav";
import {
  getUserBudget,
  createUserBudget,
  calculateBudgetAllocation,
  validateBudgetPercentages,
  getComprehensiveRecommendedBudget,
  getAllBudgetCategories,
  getCurrentMonthKey,
  getBudgetProgress,
  type BudgetAllocation,
  type BudgetRecord,
} from "../utils/budgetUtils";

/* ---------------------------
   Local helpers (month nav)
--------------------------- */
const shiftMonthKey = (monthKey: string, delta: number) => {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  return `${Y}-${M}`;
};
const formatMonthKey = (monthKey: string) => {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString("en-US", { month: "short", year: "numeric" });
};
const cmpMonthKey = (a: string, b: string) => {
  // returns -1 if a<b, 0 if equal, 1 if a>b
  if (a === b) return 0;
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  if (ay !== by) return ay < by ? -1 : 1;
  return am < bm ? -1 : 1;
};

export default function BudgetAllocationScreen() {
  const router = useRouter();

  const todayKey = useMemo(() => getCurrentMonthKey(), []);
  const [monthKey, setMonthKey] = useState<string>(todayKey);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [totalBudget, setTotalBudget] = useState<string>("");
  const [percentages, setPercentages] = useState<Record<string, number>>({});
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});
  const [isEditable, setIsEditable] = useState(true);
  const [existingBudget, setExistingBudget] = useState<BudgetRecord | null>(null);

  // View mode: "plan" (set %) vs "track" (progress only)
  const [mode, setMode] = useState<"plan" | "track">("plan");

  // Progress & totals
  const [progress, setProgress] =
    useState<Record<string, { allocated: number; spent: number; ratio: number }>>({});
  const [totalSpent, setTotalSpent] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [utilizationPct, setUtilizationPct] = useState(0);

  // Colors & icons
  const categoryConfig: Record<string, { color: string; icon: string }> = {
    Food: { color: "#f59e0b", icon: "restaurant" },
    Transport: { color: "#ec4899", icon: "car" },
    Housing: { color: "#6366f1", icon: "home-city" },
    Shopping: { color: "#10b981", icon: "shopping-bag" },
    Bills: { color: "#3b82f6", icon: "home" },
    Entertainment: { color: "#8b5cf6", icon: "film" },
    Healthcare: { color: "#ef4444", icon: "medical" },
    Education: { color: "#06b6d4", icon: "school" },
    Savings: { color: "#10b981", icon: "bank" },
    Miscellaneous: { color: "#6b7280", icon: "dots-horizontal" },
  };

  useEffect(() => {
    loadForMonth(monthKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  useEffect(() => {
    if (!isEditable) return;
    const total = parseFloat(totalBudget) || 0;
    if (total > 0) {
      const newAllocations = calculateBudgetAllocation(total, percentages);
      setAllocations(newAllocations);
    }
  }, [totalBudget, percentages, isEditable]);

  const loadForMonth = async (mk: string) => {
    try {
      setLoading(true);

      const budgetRecord = await getUserBudget(mk);
      const progressRecord = await getBudgetProgress(mk);

      // Set base UI state from budget
      if (budgetRecord) {
        setExistingBudget(budgetRecord);
        setTotalBudget(budgetRecord.totalBudget.toString());
        setPercentages({ ...budgetRecord.percentages });
        setAllocations({ ...budgetRecord.allocations });
        setEditMode({});
      } else {
        setExistingBudget(null);
        setTotalBudget("");
        setPercentages({});
        setAllocations({});
        setEditMode({});
      }

      // Determine mode + editability by month selection
      const rel = cmpMonthKey(mk, todayKey);
      if (rel < 0) {
        // past month — track only, not editable
        setMode("track");
        setIsEditable(false);
      } else if (rel === 0) {
        // current month — track if saved, else plan/edit
        if (budgetRecord) {
          setMode("track");
          setIsEditable(false);
        } else {
          setMode("plan");
          setIsEditable(true);
        }
      } else {
        // future month — plan/edit
        setMode("plan");
        setIsEditable(true);
      }

      // Progress
      if (progressRecord) {
        setTotalSpent(progressRecord.totalSpent);
        setRemaining(progressRecord.remaining);
        setUtilizationPct(progressRecord.utilizationPct);
        setProgress(progressRecord.byCategory);
      } else {
        setTotalSpent(0);
        setRemaining(0);
        setUtilizationPct(0);
        setProgress({});
      }
    } catch (error) {
      console.error("Error loading month:", mk, error);
      Alert.alert("Error", "Failed to load month data");
    } finally {
      setLoading(false);
    }
  };

  const handleTotalBudgetChange = (value: string) => {
    if (!isEditable) return;
    const cleaned = value.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return;
    setTotalBudget(cleaned);

    const total = parseFloat(cleaned) || 0;
    if (total > 0) {
      const newAllocations = calculateBudgetAllocation(total, percentages);
      setAllocations(newAllocations);
    }
  };

  const handlePercentageChange = (category: string, value: string) => {
    if (!isEditable) return;
    const cleaned = value.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return;

    const newPercent = Math.min(Math.max(parseFloat(cleaned) || 0, 0), 100);
    if (newPercent < 0 || newPercent > 100) return;

    setPercentages((prev) => ({
      ...prev,
      [category]: Math.round(newPercent * 100) / 100,
    }));

    const total = parseFloat(totalBudget) || 0;
    if (total > 0) {
      setAllocations((prev) => ({
        ...prev,
        [category]: Math.round((total * newPercent) / 100 * 100) / 100,
      }));
    }
  };

  const handleAllocationChange = (category: string, value: string) => {
    if (!isEditable) return;
    const cleaned = value.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return;

    const newAmount = parseFloat(cleaned) || 0;
    const normalizedAmount = Math.round(newAmount * 100) / 100;
    const clampedAmount = Math.max(normalizedAmount, 0);
    const total = parseFloat(totalBudget) || 0;

    if (total > 0) {
      const newPercent = (clampedAmount / total) * 100;
      setPercentages((prev) => ({
        ...prev,
        [category]: Math.round(newPercent * 100) / 100,
      }));
    }

    setAllocations((prev) => ({
      ...prev,
      [category]: clampedAmount,
    }));
  };

  const applyRecommended = () => {
    if (!isEditable) return;
    const total = parseFloat(totalBudget);
    if (total <= 0) {
      Alert.alert("Error", "Please enter a valid total budget amount first");
      return;
    }
    const recommended = getComprehensiveRecommendedBudget(total);
    setPercentages(recommended.percentages);
    setAllocations(recommended.allocations);
    setEditMode({});
    Alert.alert(
      "Success",
      `Recommended budget allocation applied!\n\nAll ${Object.keys(recommended.percentages).length} categories have been allocated.`,
      [{ text: "OK" }]
    );
  };

  const handleSave = async () => {
    if (!isEditable) return;
    const total = parseFloat(totalBudget);
    if (!total || total <= 0) {
      Alert.alert("Error", "Please enter a valid total budget amount");
      return;
    }
    const validation = validateBudgetPercentages(percentages);
    if (!validation.isValid) {
      Alert.alert(
        "Warning",
        `Budget allocation totals ${validation.total.toFixed(2)}%. It should total 100%. Do you want to save anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Save", onPress: async () => await saveBudgetData(total) },
        ]
      );
      return;
    }
    await saveBudgetData(total);
  };

  const saveBudgetData = async (total: number) => {
    try {
      setSaving(true);
      const budget: BudgetAllocation = { totalBudget: total, allocations, percentages };
      const record = await createUserBudget(budget, monthKey);
      if (record) {
        setExistingBudget(record);
        setIsEditable(false);
        setMode("track");
        setEditMode({});
        setPercentages({ ...record.percentages });
        setAllocations({ ...record.allocations });
        Alert.alert("Success", "Budget allocation saved successfully!", [{ text: "OK" }]);
      } else {
        Alert.alert("Error", "Failed to save budget allocation. You might already have a budget for this month.");
      }
    } catch (error) {
      console.error("Error saving budget:", error);
      Alert.alert("Error", "Failed to save budget allocation");
    } finally {
      setSaving(false);
    }
  };

  const getTotalAllocated = () => {
    const total = Object.values(percentages).reduce((sum, pct) => sum + pct, 0);
    return Math.round(total * 100) / 100;
  };

  const getTotalAllocatedAmount = () => {
    const total = Object.values(allocations).reduce((sum, amt) => sum + amt, 0);
    return Math.round(total * 100) / 100;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1E3932" />
          <Text style={styles.loadingText}>Loading month…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const validation = validateBudgetPercentages(percentages);
  const totalAllocated = getTotalAllocated();
  const remainingPercent = Math.round((100 - totalAllocated) * 100) / 100;

  // Track mode: order categories by risk (over > high usage > others)
  const categories = getAllBudgetCategories();
  const orderedCategories =
    mode === "track"
      ? [...categories].sort((a, b) => {
          const ra = progress[a]?.ratio ?? 0;
          const rb = progress[b]?.ratio ?? 0;
          const oa = ra >= 1 ? 1 : 0;
          const ob = rb >= 1 ? 1 : 0;
          if (ob !== oa) return ob - oa;
          return rb - ra;
        })
      : categories;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.push("/screen/Home")}
          style={styles.closeBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#1E3932" />
        </TouchableOpacity>
        <Text style={styles.title}>Budget</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Month switcher */}
        <View style={styles.monthSwitch}>
          <TouchableOpacity
            style={styles.monthNavBtn}
            onPress={() => setMonthKey((mk) => shiftMonthKey(mk, -1))}
          >
            <Ionicons name="chevron-back" size={18} color="#1E3932" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{formatMonthKey(monthKey)}</Text>
          <TouchableOpacity
            style={styles.monthNavBtn}
            onPress={() => setMonthKey((mk) => shiftMonthKey(mk, +1))}
          >
            <Ionicons name="chevron-forward" size={18} color="#1E3932" />
          </TouchableOpacity>
        </View>

        {/* Mode switch */}
        <View style={styles.modeSwitch}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "plan" && styles.modeBtnActive]}
            onPress={() => setMode("plan")}
            disabled={cmpMonthKey(monthKey, todayKey) < 0} // past months are track-only
          >
            <Text style={[styles.modeBtnText, mode === "plan" && styles.modeBtnTextActive]}>
              Plan
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "track" && styles.modeBtnActive]}
            onPress={() => setMode("track")}
          >
            <Text style={[styles.modeBtnText, mode === "track" && styles.modeBtnTextActive]}>
              Track
            </Text>
          </TouchableOpacity>
        </View>

        {/* Total Budget Section */}
        <View style={styles.totalBudgetCard}>
          <View style={styles.totalBudgetHeader}>
            <Text style={styles.totalBudgetLabel}>Total Monthly Budget</Text>
            <Text style={styles.monthLabel}>Month: {monthKey}</Text>
          </View>
          <View style={styles.totalBudgetInputContainer}>
            <Text style={styles.currencySymbol}>RM</Text>
            <TextInput
              style={styles.totalBudgetInput}
              value={totalBudget}
              onChangeText={handleTotalBudgetChange}
              keyboardType="decimal-pad"
              placeholder="0000"
              placeholderTextColor="#9ca3af"
              editable={mode === "plan" && isEditable}
              selectTextOnFocus={mode === "plan" && isEditable}
            />
          </View>
          {mode === "plan" && (
            <TouchableOpacity
              style={[styles.recommendedButton, !isEditable && styles.disabledButton]}
              onPress={applyRecommended}
              disabled={!isEditable}
            >
              <Ionicons name="bulb-outline" size={16} color="#1E3932" />
              <Text style={styles.recommendedButtonText}>Apply AI Recommendation</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Summary */}
        <View style={styles.summaryCard}>
          {mode === "plan" && (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Allocated</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    { color: validation.isValid ? "#10b981" : "#ef4444" },
                  ]}
                >
                  {totalAllocated.toFixed(2)}%
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Amount</Text>
                <Text style={styles.summaryValue}>RM {getTotalAllocatedAmount().toFixed(2)}</Text>
              </View>
            </>
          )}

          {mode === "track" && (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Budget</Text>
                <Text style={styles.summaryValue}>RM {Number(totalBudget || "0").toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Spent</Text>
                <Text style={styles.summaryValue}>RM {totalSpent.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Remaining</Text>
                <Text style={styles.summaryValue}>
                  RM {remaining.toFixed(2)} ({utilizationPct.toFixed(1)}% used)
                </Text>
              </View>
            </>
          )}

          {mode === "plan" && !validation.isValid && (
            <View style={styles.warningBox}>
              <Ionicons name="warning-outline" size={16} color="#ef4444" />
              <Text style={styles.warningText}>
                {remainingPercent > 0
                  ? `${remainingPercent.toFixed(2)}% remaining to allocate`
                  : `${Math.abs(remainingPercent).toFixed(2)}% over-allocated`}
              </Text>
            </View>
          )}
        </View>

        {/* Info banner for locked months */}
        {!isEditable && mode === "plan" && (
          <View style={styles.infoBanner}>
            <Ionicons name="lock-closed-outline" size={16} color="#1E3932" />
            <Text style={styles.infoBannerText}>
              This month is not editable. Switch to <Text style={{ fontWeight: "800" }}>Track</Text> or navigate to a future month to plan.
            </Text>
          </View>
        )}

        {/* Category List */}
        <View style={styles.categoriesSection}>
          <Text style={styles.sectionTitle}>
            {mode === "plan" ? "Plan Allocation" : "Track Spending"}
          </Text>

          {orderedCategories.map((category) => {
            const config = categoryConfig[category] || { color: "#6b7280", icon: "ellipse" };
            const percentValue = Number(percentages[category] ?? 0);
            const amountValue = Number(allocations[category] ?? 0);
            const percent = Number.isFinite(percentValue) ? percentValue : 0;
            const amount = Number.isFinite(amountValue) ? amountValue : 0;
            const isEditing = !!editMode[category];

            // Track metrics
            const p = progress[category];
            const alloc = Number(allocations[category] ?? 0);
            const sp = p?.spent ?? 0;
            const ratio = p?.ratio ?? 0;
            const pctOfAllocated = Number.isFinite(ratio) ? Math.min(ratio * 100, 999) : 0;
            const over = ratio >= 1.0;
            const warn = ratio >= 0.8 && ratio < 1.0;

            return (
              <View key={category} style={styles.rowCard}>
                {/* Header row */}
                <View style={styles.rowHeader}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.rowIcon, { backgroundColor: `${config.color}20` }]}>
                      <MaterialCommunityIcons name={config.icon as any} size={18} color={config.color} />
                    </View>
                    <Text style={styles.rowName} numberOfLines={1}>{category}</Text>
                  </View>

                  <View style={styles.rowRight}>
                    {mode === "plan" && !isEditing && (
                      <>
                        <Text style={styles.rowPct}>{percent.toFixed(0)}%</Text>
                        <Text style={styles.rowAmt}>RM {amount.toFixed(0)}</Text>
                      </>
                    )}

                    {mode === "plan" && (
                      <TouchableOpacity
                        onPress={() => {
                          if (!isEditable) return;
                          setEditMode((prev) => ({ ...prev, [category]: !prev[category] }));
                        }}
                        style={[styles.rowEditBtn, !isEditable && styles.editButtonDisabled]}
                        disabled={!isEditable}
                      >
                        <Ionicons
                          name={isEditing ? "checkmark-circle" : "create-outline"}
                          size={20}
                          color={isEditing ? "#10b981" : config.color}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Plan: inline editor */}
                {mode === "plan" && isEditing && (
                  <View style={styles.rowEditor}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>%</Text>
                      <TextInput
                        style={[styles.inputField, !isEditable && styles.inputDisabled]}
                        value={percent.toFixed(2)}
                        onChangeText={(v) => handlePercentageChange(category, v)}
                        keyboardType="decimal-pad"
                        editable={isEditable}
                        selectTextOnFocus={isEditable}
                      />
                    </View>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>RM</Text>
                      <TextInput
                        style={[styles.inputField, !isEditable && styles.inputDisabled]}
                        value={amount.toFixed(2)}
                        onChangeText={(v) => handleAllocationChange(category, v)}
                        keyboardType="decimal-pad"
                        editable={isEditable}
                        selectTextOnFocus={isEditable}
                      />
                    </View>
                  </View>
                )}

                {/* Track: spend vs allocation */}
                {mode === "track" && (
                  <>
                    <View style={styles.spendRow}>
                      <Text style={styles.spendText}>
                        Spent RM {Math.max(0, sp).toFixed(0)} / RM {Math.max(0, alloc).toFixed(0)}
                      </Text>

                      <View style={styles.remainChip}>
                        <Ionicons name="wallet-outline" size={12} color="#1E3932" />
                        <Text style={styles.remainChipText}>
                          Remaining RM {Math.max(0, alloc - sp).toFixed(0)}
                        </Text>
                      </View>

                      {over && (
                        <View style={[styles.badge, styles.badgeDanger]}>
                          <Ionicons name="alert-circle" size={12} color="#fff" />
                          <Text style={styles.badgeText}>Exceeded</Text>
                        </View>
                      )}
                      {!over && warn && (
                        <View style={[styles.badge, styles.badgeWarn]}>
                          <Ionicons name="time-outline" size={12} color="#fff" />
                          <Text style={styles.badgeText}>80%+ used</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.spendBarTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${Math.min(Math.max(pctOfAllocated, 0), 100)}%` },
                          over ? styles.spendBarFillDanger : warn ? styles.spendBarFillWarn : { backgroundColor: config.color },
                        ]}
                      />
                    </View>
                  </>
                )}

                {/* Plan: tiny allocation share bar */}
                {mode === "plan" && (
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.min(percent, 100)}%`, backgroundColor: config.color },
                      ]}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Save Button (Plan only) */}
        {mode === "plan" && (
          <TouchableOpacity
            style={[styles.saveButton, (!isEditable || saving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!isEditable || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save Budget Allocation</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E4F2ED" },
  header: {
    width: "100%",
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#E4F2ED",
  },
  closeBtn: { width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", color: "#1E3932", flex: 1, textAlign: "center", marginRight: 40 },
  headerSpacer: { width: 40 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: "#6b7280", fontSize: 14 },
  scrollContent: { padding: 20, paddingBottom: 100 },

  // Month switcher
  monthSwitch: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 8,
  },
  monthNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#DCEFE7",
    alignItems: "center",
    justifyContent: "center",
  },
  monthTitle: { fontWeight: "800", color: "#1E3932", fontSize: 16 },

  // Mode switch
  modeSwitch: {
    flexDirection: "row",
    backgroundColor: "#C9EAD6",
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  modeBtnActive: { backgroundColor: "#1E3932" },
  modeBtnText: { fontWeight: "800", color: "#1E3932" },
  modeBtnTextActive: { color: "#fff" },

  totalBudgetCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginTop: 10,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  totalBudgetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  totalBudgetLabel: { fontSize: 15, color: "#1E3932", fontWeight: "700" },
  monthLabel: { fontSize: 13, color: "#1E3932", fontWeight: "600" },
  totalBudgetInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#1E3932",
    paddingBottom: 8,
    marginBottom: 12,
  },
  currencySymbol: { fontSize: 24, fontWeight: "700", color: "#1E3932", marginRight: 8 },
  totalBudgetInput: { flex: 1, fontSize: 32, fontWeight: "700", color: "#1E3932" },
  recommendedButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#C9EAD6",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  disabledButton: { opacity: 0.5 },
  recommendedButtonText: { color: "#1E3932", fontWeight: "600", fontSize: 14 },

  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: "#6b7280", fontWeight: "600" },
  summaryValue: { fontSize: 16, fontWeight: "700", color: "#1E3932" },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  warningText: { color: "#DC2626", fontSize: 12, fontWeight: "600" },

  categoriesSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#1E3932", marginBottom: 16 },

  rowCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  rowHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  rowIcon: { width: 30, height: 30, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  rowName: { fontSize: 14, fontWeight: "700", color: "#1E3932", flexShrink: 1 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowPct: { width: 42, textAlign: "right", fontSize: 13, fontWeight: "800", color: "#1E3932" },
  rowAmt: { width: 80, textAlign: "right", fontSize: 13, fontWeight: "800", color: "#1E3932" },
  rowEditBtn: { padding: 4 },

  rowEditor: { marginTop: 10, flexDirection: "row", gap: 8 },
  inputGroup: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F6FAF8",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  inputLabel: { color: "#6b7280", fontWeight: "700", width: 22, textAlign: "center" },
  inputField: { flex: 1, color: "#1E3932", fontWeight: "800", fontSize: 14, textAlign: "right" },
  inputDisabled: { opacity: 0.5 },

  // Plan: allocation share bar
  barTrack: {
    height: 4,
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 8,
  },
  barFill: { height: "100%", borderRadius: 999 },

  // Track: spend vs allocated
  spendRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  spendText: { color: "#1E3932", fontSize: 12, fontWeight: "600" },
  remainChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#E6F4EE",
  },
  remainChipText: { color: "#1E3932", fontWeight: "800", fontSize: 11 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  badgeWarn: { backgroundColor: "#f59e0b" },
  badgeDanger: { backgroundColor: "#ef4444" },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  spendBarTrack: {
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 6,
    marginBottom: 4,
  },
  spendBarFillWarn: { backgroundColor: "#f59e0b" },
  spendBarFillDanger: { backgroundColor: "#ef4444" },
  editButtonDisabled: { opacity: 0.4 },

  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 8,
  },
  infoBannerText: { color: "#1E3932", fontSize: 12, fontWeight: "600", flex: 1 },

  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1E3932",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
