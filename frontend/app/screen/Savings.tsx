// app/screen/Savings.tsx
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
import DateTimePickerModal from "react-native-modal-datetime-picker";

import {
  subscribeUserSavingsGoals,
  upsertSavingsGoal,
  addSavingsContribution,
  deleteSavingsGoalDeep,
  type SavingsGoal,
  type SavingsContribution,
} from "../utils/SavingsUtils";
import { auth } from "../../firebase";

/* ---------- Brand / UI ---------- */
const BRAND_BG_GRADIENT = ["#1E5449", "#154C42", "#0F3D35"] as const;
const BRAND_DARK = "#1E3932";
const BRAND_GREEN = "#22C55E";
const CARD_BG = "#FFFFFF";
const LINE_SOFT = "#E5E7EB";
const MUTED = "#6B7280";
const RED = "#EF4444";

const CATEGORY_OPTIONS = [
  "House",
  "Emergency",
  "Education",
  "Travel",
  "Vehicle",
  "Wedding",
  "Retirement",
  "Business",
  "Other",
];

const CATEGORY_COLORS: Record<string, string> = {
  House: "#8B5CF6",
  Emergency: "#EF4444",
  Education: "#06B6D4",
  Travel: "#F59E0B",
  Vehicle: "#3B82F6",
  Wedding: "#EC4899",
  Retirement: "#10B981",
  Business: "#6366F1",
  Other: "#6B7280",
};

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  House: "home",
  Emergency: "warning",
  Education: "school",
  Travel: "airplane",
  Vehicle: "car",
  Wedding: "heart",
  Retirement: "medal",
  Business: "business",
  Other: "ellipse",
};

/* ---------- Helpers ---------- */
const fmtRM = (n: number) =>
  `RM ${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const parseNum = (s: string) => {
  const n = Number(String(s).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const formatDate = (date: Date | null) => {
  if (!date) return "";
  return date.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
};

const getMonthsRemaining = (targetAmount: number, currentAmount: number, monthlyTarget: number | null) => {
  if (!monthlyTarget || monthlyTarget <= 0) return null;
  const remaining = targetAmount - currentAmount;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / monthlyTarget);
};

const getDaysOverdue = (deadline: Date | null) => {
  if (!deadline) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);
  const diff = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff < 0 ? Math.abs(diff) : null;
};

/* ---------- Goal Row Component ---------- */
function GoalRow({
  goal,
  onEdit,
  onDelete,
  onAddContribution,
}: {
  goal: SavingsGoal;
  onEdit: () => void;
  onDelete: () => void;
  onAddContribution: () => void;
}) {
  const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
  const monthsLeft = getMonthsRemaining(goal.targetAmount, goal.currentAmount, goal.monthlyTarget || null);
  const daysOverdue = getDaysOverdue(goal.deadline || null);
  const category = goal.category || "Other";
  const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.Other;
  const icon = CATEGORY_ICONS[category] || CATEGORY_ICONS.Other;

  return (
    <View style={styles.goalCard}>
      {/* Header */}
      <View style={styles.goalHeader}>
        <View style={[styles.goalIcon, { backgroundColor: color + "22" }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.goalName}>{goal.name}</Text>
          {category && <Text style={styles.goalCategory}>{category}</Text>}
        </View>
        <View style={styles.goalActions}>
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
        <Text style={styles.progressText}>
          {fmtRM(goal.currentAmount)} / {fmtRM(goal.targetAmount)} ({Math.round(progress)}%)
        </Text>
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Remaining</Text>
          <Text style={[styles.infoValue, { color }]}>
            {fmtRM(Math.max(0, goal.targetAmount - goal.currentAmount))}
          </Text>
        </View>
        {goal.monthlyTarget && goal.monthlyTarget > 0 && (
          <>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Monthly Target</Text>
              <Text style={styles.infoValue}>{fmtRM(goal.monthlyTarget)}</Text>
            </View>
          </>
        )}
      </View>

      {/* Timeline */}
      {(monthsLeft !== null || daysOverdue !== null || goal.deadline) && (
        <View style={styles.timelineSection}>
          {daysOverdue !== null ? (
            <>
              <Ionicons name="alert-circle" size={16} color={RED} />
              <Text style={[styles.timelineText, { color: RED }]}>
                Overdue by {daysOverdue} day{daysOverdue !== 1 ? "s" : ""}
              </Text>
            </>
          ) : monthsLeft !== null ? (
            <>
              <Ionicons name="time-outline" size={16} color={MUTED} />
              <Text style={styles.timelineText}>
                {monthsLeft} month{monthsLeft !== 1 ? "s" : ""} remaining
                {monthsLeft <= 12 && <Text style={{ color: BRAND_GREEN }}> • On track!</Text>}
              </Text>
            </>
          ) : goal.deadline ? (
            <>
              <Ionicons name="calendar-outline" size={16} color={MUTED} />
              <Text style={styles.timelineText}>Deadline: {formatDate(goal.deadline)}</Text>
            </>
          ) : null}
        </View>
      )}

      {/* Add Contribution Button */}
      <TouchableOpacity onPress={onAddContribution} style={styles.addContributionBtn}>
        <Ionicons name="add-circle" size={18} color={BRAND_DARK} />
        <Text style={styles.addContributionText}>Add Contribution</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ---------- Add/Edit Goal Modal ---------- */
function GoalEditor({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: SavingsGoal | null;
  onClose: () => void;
  onSave: (goal: SavingsGoal) => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [targetAmount, setTargetAmount] = useState(String(initial?.targetAmount ?? ""));
  const [currentAmount, setCurrentAmount] = useState(String(initial?.currentAmount ?? "0"));
  const [monthlyTarget, setMonthlyTarget] = useState(String(initial?.monthlyTarget ?? ""));
  const [category, setCategory] = useState(initial?.category || "Other");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [deadline, setDeadline] = useState<Date | null>(initial?.deadline || null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name || "");
    setTargetAmount(String(initial?.targetAmount ?? ""));
    setCurrentAmount(String(initial?.currentAmount ?? "0"));
    setMonthlyTarget(String(initial?.monthlyTarget ?? ""));
    setCategory(initial?.category || "Other");
    setNotes(initial?.notes || "");
    setDeadline(initial?.deadline || null);
  }, [open, initial]);

  const save = () => {
    const target = parseNum(targetAmount);
    const current = parseNum(currentAmount);
    const monthly = monthlyTarget.trim() ? parseNum(monthlyTarget) : null;

    if (!name.trim()) {
      Alert.alert("Missing info", "Please enter a goal name.");
      return;
    }
    if (!target || target <= 0) {
      Alert.alert("Missing info", "Please enter a valid target amount.");
      return;
    }
    if (current < 0) {
      Alert.alert("Invalid amount", "Current amount cannot be negative.");
      return;
    }
    if (current > target) {
      Alert.alert("Invalid amount", "Current amount cannot exceed target amount.");
      return;
    }

    const goal: SavingsGoal = {
      id: initial?.id || String(Date.now()),
      userId: initial?.userId || "",
      name: name.trim(),
      targetAmount: target,
      currentAmount: current,
      monthlyTarget: monthly && monthly > 0 ? monthly : null,
      deadline: deadline || null,
      category: category || undefined,
      notes: notes.trim() || undefined,
      createdAt: initial?.createdAt || new Date(),
      updatedAt: new Date(),
    };

    onSave(goal);
    onClose();
  };

  return (
    <>
      <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{initial ? "Edit Goal" : "Add Goal"}</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={22} color={BRAND_DARK} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
              <LabeledInput
                label="Goal Name *"
                value={name}
                onChangeText={setName}
                placeholder="e.g., House downpayment"
              />

              <View style={{ marginTop: 12 }}>
                <Text style={styles.inputLabel}>Category</Text>
                <TouchableOpacity
                  onPress={() => setShowCategoryPicker(true)}
                  style={[styles.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={[styles.categoryIcon, { backgroundColor: CATEGORY_COLORS[category] + "22" }]}>
                      <Ionicons name={CATEGORY_ICONS[category]} size={16} color={CATEGORY_COLORS[category]} />
                    </View>
                    <Text style={{ color: BRAND_DARK, fontWeight: "800" }}>{category}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={MUTED} />
                </TouchableOpacity>
              </View>

              <LabeledInput
                label="Target Amount (MYR) *"
                value={targetAmount}
                onChangeText={setTargetAmount}
                keyboardType="numeric"
                placeholder="e.g., 50000"
              />

              <LabeledInput
                label="Current Amount (MYR)"
                value={currentAmount}
                onChangeText={setCurrentAmount}
                keyboardType="numeric"
                placeholder="e.g., 10000"
              />

              <LabeledInput
                label="Monthly Target (MYR) (Optional)"
                value={monthlyTarget}
                onChangeText={setMonthlyTarget}
                keyboardType="numeric"
                placeholder="e.g., 1000"
              />

              <View style={{ marginTop: 12 }}>
                <Text style={styles.inputLabel}>Deadline (Optional)</Text>
                <TouchableOpacity
                  onPress={() => setShowDatePicker(true)}
                  style={[styles.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
                >
                  <Text style={{ color: deadline ? BRAND_DARK : MUTED, fontWeight: "800" }}>
                    {deadline ? formatDate(deadline) : "Select date"}
                  </Text>
                  <Ionicons name="calendar-outline" size={18} color={MUTED} />
                </TouchableOpacity>
                {deadline && (
                  <TouchableOpacity
                    onPress={() => setDeadline(null)}
                    style={{ marginTop: 6, alignSelf: "flex-start" }}
                  >
                    <Text style={{ color: RED, fontSize: 12, fontWeight: "700" }}>Clear deadline</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={{ marginTop: 12 }}>
                <Text style={styles.inputLabel}>Notes (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add notes about this goal..."
                  placeholderTextColor={MUTED}
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            <TouchableOpacity onPress={save} style={styles.modalPrimary}>
              <Ionicons name="save" size={18} color="#fff" />
              <Text style={styles.modalPrimaryText}>Save</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <DateTimePickerModal
        isVisible={showDatePicker}
        mode="date"
        date={deadline || new Date()}
        onConfirm={(date) => {
          setDeadline(date);
          setShowDatePicker(false);
        }}
        onCancel={() => setShowDatePicker(false)}
      />

      <Modal visible={showCategoryPicker} transparent animationType="slide" onRequestClose={() => setShowCategoryPicker(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Ionicons name="close" size={22} color={BRAND_DARK} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {CATEGORY_OPTIONS.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => {
                    setCategory(cat);
                    setShowCategoryPicker(false);
                  }}
                  style={[styles.categoryOption, category === cat && styles.categoryOptionActive]}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: CATEGORY_COLORS[cat] + "22" }]}>
                    <Ionicons name={CATEGORY_ICONS[cat]} size={18} color={CATEGORY_COLORS[cat]} />
                  </View>
                  <Text style={[styles.categoryOptionText, category === cat && styles.categoryOptionTextActive]}>
                    {cat}
                  </Text>
                  {category === cat && <Ionicons name="checkmark-circle" size={20} color={BRAND_GREEN} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

/* ---------- Contribution Modal ---------- */
function ContributionModal({
  open,
  goal,
  onClose,
  onSave,
}: {
  open: boolean;
  goal: SavingsGoal | null;
  onClose: () => void;
  onSave: (goalId: string, contribution: SavingsContribution) => void;
}) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date());
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (open && goal) {
      setAmount(goal.monthlyTarget ? String(goal.monthlyTarget) : "");
      setDate(new Date());
      setSource("");
      setNote("");
    }
  }, [open, goal]);

  const save = () => {
    if (!goal) return;
    const amt = parseNum(amount);
    if (!amt || amt <= 0) {
      Alert.alert("Invalid amount", "Please enter a valid contribution amount.");
      return;
    }

    const contribution: SavingsContribution = {
      id: String(Date.now()),
      goalId: goal.id,
      amount: amt,
      date,
      source: source.trim() || undefined,
      note: note.trim() || undefined,
    };

    onSave(goal.id, contribution);
    onClose();
  };

  if (!goal) return null;

  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

  return (
    <>
      <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Contribution</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={22} color={BRAND_DARK} />
              </TouchableOpacity>
            </View>

            <View style={styles.contributionModalGoal}>
              <Text style={styles.contributionModalGoalName}>{goal.name}</Text>
              <Text style={styles.contributionModalRemaining}>
                Remaining: {fmtRM(remaining)} / {fmtRM(goal.targetAmount)}
              </Text>
            </View>

            <LabeledInput
              label="Amount (MYR) *"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="e.g., 1000"
            />

            <View style={{ marginTop: 12 }}>
              <Text style={styles.inputLabel}>Date *</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={[styles.input, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
              >
                <Text style={{ color: BRAND_DARK, fontWeight: "800" }}>{formatDate(date)}</Text>
                <Ionicons name="calendar-outline" size={18} color={MUTED} />
              </TouchableOpacity>
            </View>

            <LabeledInput
              label="Source (Optional)"
              value={source}
              onChangeText={setSource}
              placeholder="e.g., Salary, Bonus"
            />

            <LabeledInput label="Note (Optional)" value={note} onChangeText={setNote} placeholder="e.g., Monthly savings" />

            <TouchableOpacity onPress={save} style={styles.modalPrimary}>
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.modalPrimaryText}>Add Contribution</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <DateTimePickerModal
        isVisible={showDatePicker}
        mode="date"
        date={date}
        onConfirm={(selectedDate) => {
          setDate(selectedDate);
          setShowDatePicker(false);
        }}
        onCancel={() => setShowDatePicker(false)}
      />
    </>
  );
}

/* ---------- Labeled Input Component ---------- */
function LabeledInput(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput {...rest} style={[styles.input, style]} placeholderTextColor={MUTED} />
    </View>
  );
}

/* ---------- Main Screen ---------- */
export default function Savings() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsGoal | null>(null);

  const [contributionModalOpen, setContributionModalOpen] = useState(false);
  const [contributionGoal, setContributionGoal] = useState<SavingsGoal | null>(null);

  // Resolve user id and subscribe to goals
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("userId");
        const uid = stored || auth.currentUser?.uid || null;
        if (uid && !stored) await AsyncStorage.setItem("userId", uid);
        setUserId(uid);

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

    const unsub = subscribeUserSavingsGoals(userId, (rows) => {
      setGoals(rows);
      setLoading(false);
    });

    return () => unsub?.();
  }, [userId]);

  // Derived stats
  const stats = useMemo(() => {
    const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
    const totalCurrent = goals.reduce((sum, g) => sum + g.currentAmount, 0);
    const totalRemaining = totalTarget - totalCurrent;
    const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

    return {
      totalTarget,
      totalCurrent,
      totalRemaining,
      overallProgress,
    };
  }, [goals]);

  // Actions
  const openAdd = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (goal: SavingsGoal) => {
    setEditing(goal);
    setEditorOpen(true);
  };

  const saveGoal = async (goal: SavingsGoal) => {
    if (!userId) return Alert.alert("Not signed in", "Please sign in first.");
    try {
      await upsertSavingsGoal(userId, goal);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Save failed", e?.message ?? "Could not save goal.");
    }
  };

  const deleteGoal = (id: string) => {
    Alert.alert("Delete goal", "This will remove the goal and all contribution history.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (!userId) return;
          try {
            await deleteSavingsGoalDeep(userId, id);
          } catch (e: any) {
            console.error(e);
            Alert.alert("Delete failed", e?.message ?? "Could not delete goal.");
          }
        },
      },
    ]);
  };

  const openContributionModal = (goal: SavingsGoal) => {
    setContributionGoal(goal);
    setContributionModalOpen(true);
  };

  const saveContribution = async (goalId: string, contribution: SavingsContribution) => {
    if (!userId) return Alert.alert("Not signed in", "Please sign in first.");
    try {
      await addSavingsContribution(userId, goalId, {
        amount: contribution.amount,
        date: contribution.date,
        source: contribution.source,
        note: contribution.note,
      });
      Alert.alert("Contribution Added!", `Contribution of ${fmtRM(contribution.amount)} has been recorded.`);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Contribution failed", e?.message ?? "Could not record contribution.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <LinearGradient colors={BRAND_BG_GRADIENT} style={StyleSheet.absoluteFill} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.loadingText}>Loading your savings goals…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient colors={BRAND_BG_GRADIENT} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>Savings & Goals</Text>
          <Text style={styles.subtitle}>Track your progress</Text>
        </View>
        <TouchableOpacity onPress={openAdd} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Summary Card */}
        <View style={styles.card}>
          <View style={styles.summaryHeader}>
            <Ionicons name="wallet" size={24} color={BRAND_DARK} />
            <Text style={styles.summaryTitle}>Total Savings</Text>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Saved</Text>
              <Text style={[styles.summaryValue, { color: BRAND_GREEN }]}>{fmtRM(stats.totalCurrent)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Target</Text>
              <Text style={styles.summaryValue}>{fmtRM(stats.totalTarget)}</Text>
            </View>
          </View>

          {stats.totalTarget > 0 && (
            <>
              <View style={styles.summaryProgressBar}>
                <View
                  style={[
                    styles.summaryProgressFill,
                    { width: `${Math.min(stats.overallProgress, 100)}%`, backgroundColor: BRAND_GREEN },
                  ]}
                />
              </View>
              <Text style={styles.summaryProgressText}>
                {Math.round(stats.overallProgress)}% complete • {fmtRM(stats.totalRemaining)} remaining
              </Text>
            </>
          )}
        </View>

        {/* Goals List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Goals ({goals.length})</Text>
          </View>

          {goals.length === 0 ? (
            <View style={styles.card}>
              <View style={styles.empty}>
                <Ionicons name="trophy-outline" size={56} color={BRAND_GREEN} />
                <Text style={styles.emptyTitle}>No savings goals yet</Text>
                <Text style={styles.emptyText}>Tap the + button to create your first savings goal</Text>
              </View>
            </View>
          ) : (
            goals.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                onEdit={() => openEdit(goal)}
                onDelete={() => deleteGoal(goal.id)}
                onAddContribution={() => openContributionModal(goal)}
              />
            ))
          )}
        </View>
      </ScrollView>

      <GoalEditor
        open={editorOpen}
        initial={editing}
        onClose={() => setEditorOpen(false)}
        onSave={saveGoal}
      />

      <ContributionModal
        open={contributionModalOpen}
        goal={contributionGoal}
        onClose={() => setContributionModalOpen(false)}
        onSave={saveContribution}
      />
    </SafeAreaView>
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
  subtitle: { color: "rgba(255,255,255,0.8)", fontSize: 12, marginTop: 2 },

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

  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  summaryTitle: {
    fontWeight: "800",
    color: BRAND_DARK,
    fontSize: 15,
  },
  summaryRow: {
    flexDirection: "row",
    backgroundColor: "#F7FAF9",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  summaryItem: {
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: LINE_SOFT,
    marginHorizontal: 12,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: MUTED,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "900",
    color: BRAND_DARK,
  },
  summaryProgressBar: {
    height: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 6,
  },
  summaryProgressFill: {
    height: "100%",
    borderRadius: 4,
  },
  summaryProgressText: {
    fontSize: 12,
    fontWeight: "800",
    color: BRAND_DARK,
    textAlign: "center",
  },

  goalCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 14,
    ...shadow(2, 0.06),
  },
  goalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  goalIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  goalName: {
    fontSize: 15,
    fontWeight: "900",
    color: BRAND_DARK,
  },
  goalCategory: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED,
    marginTop: 2,
  },
  goalActions: {
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

  infoSection: {
    flexDirection: "row",
    backgroundColor: "#F7FAF9",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  infoItem: {
    flex: 1,
  },
  infoDivider: {
    width: 1,
    backgroundColor: LINE_SOFT,
    marginHorizontal: 12,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: MUTED,
    marginBottom: 4,
  },
  infoValue: {
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

  addContributionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: BRAND_DARK,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addContributionText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },

  empty: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  emptyTitle: {
    color: BRAND_DARK,
    fontWeight: "900",
    fontSize: 16,
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
    justifyContent: "flex-end",
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
    fontSize: 17,
  },
  inputLabel: {
    color: MUTED,
    fontWeight: "700",
    marginBottom: 6,
    fontSize: 12,
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
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },

  categoryIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "#F7FAF9",
  },
  categoryOptionActive: {
    backgroundColor: BRAND_DARK + "11",
  },
  categoryOptionText: {
    flex: 1,
    color: BRAND_DARK,
    fontWeight: "800",
    fontSize: 14,
  },
  categoryOptionTextActive: {
    color: BRAND_DARK,
  },

  contributionModalGoal: {
    backgroundColor: "#F7FAF9",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  contributionModalGoalName: {
    fontSize: 15,
    fontWeight: "900",
    color: BRAND_DARK,
    marginBottom: 4,
  },
  contributionModalRemaining: {
    fontSize: 13,
    fontWeight: "700",
    color: MUTED,
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
    fontWeight: "900",
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

