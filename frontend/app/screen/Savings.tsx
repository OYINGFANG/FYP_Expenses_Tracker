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
  subscribeUserSavingsBadges,
  subscribeGoalContributions,
  upsertSavingsGoal,
  addSavingsContribution,
  deleteSavingsGoalDeep,
  checkAndAwardSavingsBadges,
  BADGE_DEFINITIONS,
  type SavingsGoal,
  type SavingsContribution,
  type SavingsBadge,
} from "../utils/SavingsUtils";
import { auth } from "../../firebase";
import { syncSavingsReminderForGoal, cancelSavingsReminder } from "../utils/savingsNotificationUtils";
import { formatCurrency, subscribeUserCurrency, type Currency } from "../utils/currencyUtils";

/* ---------- Brand / UI ---------- */
const BRAND_DARK = "#1E3932";
const BRAND_GREEN = "#22C55E";
const CARD_BG = "#FFFFFF";
const LINE_SOFT = "#E5E7EB";
const MUTED = "#6B7280";
const RED = "#EF4444";


/* ---------- Helpers ---------- */

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
  onViewDetails,
  currency,
  contributions,
}: {
  goal: SavingsGoal;
  onEdit: () => void;
  onDelete: () => void;
  onAddContribution: () => void;
  onViewDetails: () => void;
  currency: Currency;
  contributions: SavingsContribution[];
}) {
  const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
  const isCompleted = progress >= 100;
  const monthsLeft = getMonthsRemaining(goal.targetAmount, goal.currentAmount, goal.monthlyTarget || null);
  const daysOverdue = getDaysOverdue(goal.deadline || null);
  
  return (
    <View style={[styles.goalCard, isCompleted && styles.goalCardCompleted]}>
      {/* Header */}
      <View style={styles.goalHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.goalName}>{goal.name}</Text>
          {isCompleted && (
            <View style={styles.completedChip}>
              <Ionicons name="trophy" size={12} color="#15803D" />
              <Text style={styles.completedChipText}>Completed</Text>
            </View>
          )}
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
          <View
            style={[
              styles.progressFill,
              {
                width: `${Math.min(progress, 100)}%`,
                backgroundColor: isCompleted ? "#16A34A" : BRAND_GREEN,
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {formatCurrency(goal.currentAmount, currency)} / {formatCurrency(goal.targetAmount, currency)} ({Math.round(progress)}%)
        </Text>
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>{isCompleted ? "Extra Saved" : "Remaining"}</Text>
          <Text style={styles.infoValue}>
            {isCompleted
              ? formatCurrency(Math.max(0, goal.currentAmount - goal.targetAmount), currency)
              : formatCurrency(Math.max(0, goal.targetAmount - goal.currentAmount), currency)}
          </Text>
        </View>
        {goal.monthlyTarget && goal.monthlyTarget > 0 && (
          <>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Monthly Target</Text>
              <Text style={styles.infoValue}>{formatCurrency(goal.monthlyTarget, currency)}</Text>
            </View>
          </>
        )}
      </View>

      {/* Timeline */}
      {isCompleted ? (
        <View style={styles.timelineSection}>
          <Ionicons name="checkmark-circle" size={16} color={BRAND_GREEN} />
          <Text style={[styles.timelineText, { color: BRAND_GREEN }]}>Goal completed 🎉</Text>
        </View>
      ) : (
        (monthsLeft !== null || daysOverdue !== null || goal.deadline) && (
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
        )
      )}

      {/* Recent Contributions */}
      {contributions.length > 0 && (
        <View style={styles.contributionsSection}>
          <View style={styles.contributionsHeader}>
            <Text style={styles.contributionsTitle}>Recent Contributions</Text>
            <TouchableOpacity onPress={onViewDetails} style={styles.viewDetailsBtn}>
              <Text style={styles.viewDetailsText}>View All</Text>
              <Ionicons name="chevron-forward" size={14} color={BRAND_DARK} />
            </TouchableOpacity>
          </View>
          {contributions.slice(0, 3).map((c) => (
            <View key={c.id} style={styles.contributionRow}>
              <Ionicons name="checkmark-circle" size={14} color={BRAND_GREEN} />
              <Text style={styles.contributionDate}>{formatDate(c.date)}</Text>
              <Text style={styles.contributionAmount}>{formatCurrency(c.amount, currency)}</Text>
            </View>
          ))}
          {contributions.length > 3 && (
            <Text style={styles.contributionsMore}>+{contributions.length - 3} more</Text>
          )}
        </View>
      )}

      {/* Add Contribution Button */}
      {!isCompleted && (
      <TouchableOpacity onPress={onAddContribution} style={styles.addContributionBtn}>
        <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
        <Text style={styles.addContributionText}>Add Contribution</Text>
      </TouchableOpacity>
      )}
    </View>
  );
}

/* ---------- Contribution Details Modal ---------- */
function ContributionDetailsModal({
  open,
  goal,
  contributions,
  onClose,
  currency,
}: {
  open: boolean;
  goal: SavingsGoal | null;
  contributions: SavingsContribution[];
  onClose: () => void;
  currency: Currency;
}) {
  if (!goal) return null;

  const sortedContributions = [...contributions].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Contribution History</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={BRAND_DARK} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
            {/* Goal Info */}
            <View style={styles.detailsGoalInfo}>
              <Text style={styles.detailsGoalName}>{goal.name}</Text>
              <View style={styles.detailsGoalStats}>
                <View style={styles.detailsStatItem}>
                  <Text style={styles.detailsStatLabel}>Target Amount</Text>
                  <Text style={styles.detailsStatValue}>{formatCurrency(goal.targetAmount, currency)}</Text>
                </View>
                <View style={styles.detailsStatDivider} />
                <View style={styles.detailsStatItem}>
                  <Text style={styles.detailsStatLabel}>Total Contributed</Text>
                  <Text style={[styles.detailsStatValue, { color: BRAND_GREEN }]}>
                    {formatCurrency(goal.currentAmount, currency)}
                  </Text>
                </View>
                <View style={styles.detailsStatDivider} />
                <View style={styles.detailsStatItem}>
                  <Text style={styles.detailsStatLabel}>Remaining</Text>
                  <Text style={styles.detailsStatValue}>
                    {formatCurrency(Math.max(0, goal.targetAmount - goal.currentAmount), currency)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Contribution History */}
            <View style={styles.detailsSection}>
              <Text style={styles.detailsSectionTitle}>
                Contribution History ({sortedContributions.length})
              </Text>
              {sortedContributions.length === 0 ? (
                <View style={styles.detailsEmpty}>
                  <Ionicons name="receipt-outline" size={32} color={MUTED} />
                  <Text style={styles.detailsEmptyText}>No contributions recorded yet</Text>
                </View>
              ) : (
                sortedContributions.map((contribution) => (
                  <View key={contribution.id} style={styles.detailsContributionRow}>
                    <View style={styles.detailsContributionLeft}>
                      <Ionicons name="checkmark-circle" size={18} color={BRAND_GREEN} />
                      <View style={styles.detailsContributionInfo}>
                        <Text style={styles.detailsContributionDate}>{formatDate(contribution.date)}</Text>
                        {contribution.note && (
                          <Text style={styles.detailsContributionNote}>{contribution.note}</Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.detailsContributionAmount}>{formatCurrency(contribution.amount, currency)}</Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>

          <TouchableOpacity onPress={onClose} style={styles.modalPrimary}>
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.modalPrimaryText}>Close</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  const [notes, setNotes] = useState(initial?.notes || "");
  const [deadline, setDeadline] = useState<Date | null>(initial?.deadline || null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowDatePicker(false);
      return;
    }
    setName(initial?.name || "");
    setTargetAmount(String(initial?.targetAmount ?? ""));
    setCurrentAmount(String(initial?.currentAmount ?? "0"));
    setMonthlyTarget(String(initial?.monthlyTarget ?? ""));
    setNotes(initial?.notes || "");
    setDeadline(initial?.deadline || null);
    setShowDatePicker(false);
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
                  activeOpacity={0.7}
                  style={styles.datePickerButton}
                >
                  <Ionicons name="calendar-outline" size={18} color={BRAND_DARK} />
                  <Text style={[
                    styles.datePickerText,
                    !deadline && styles.datePickerPlaceholder
                  ]}>
                    {deadline 
                      ? deadline.toLocaleDateString("en-MY", { 
                          day: "2-digit", 
                          month: "short", 
                          year: "numeric" 
                        })
                      : "Select date"}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={MUTED} />
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

        <DateTimePickerModal
          isVisible={showDatePicker}
          mode="date"
          date={deadline || new Date()}
          onConfirm={(date) => {
            setDeadline(date);
            setShowDatePicker(false);
          }}
          onCancel={() => setShowDatePicker(false)}
          minimumDate={new Date()}
        />
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
  currency,
}: {
  open: boolean;
  goal: SavingsGoal | null;
  onClose: () => void;
  onSave: (goalId: string, contribution: SavingsContribution) => void;
  currency: Currency;
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
                Remaining: {formatCurrency(remaining, currency)} / {formatCurrency(goal.targetAmount, currency)}
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
                activeOpacity={0.7}
                style={styles.datePickerButton}
              >
                <Ionicons name="calendar-outline" size={18} color={BRAND_DARK} />
                <Text style={styles.datePickerText}>
                  {date.toLocaleDateString("en-MY", { 
                    day: "2-digit", 
                    month: "short", 
                    year: "numeric" 
                  })}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={MUTED} />
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

        <DateTimePickerModal
          isVisible={showDatePicker}
          mode="date"
          date={date}
          onConfirm={(selectedDate) => {
            setDate(selectedDate);
            setShowDatePicker(false);
          }}
          onCancel={() => setShowDatePicker(false)}
          maximumDate={new Date()}
        />
      </Modal>
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

/* ---------- Badge Card Component ---------- */
function BadgeCard({ badge, earned, onPress }: { badge: Omit<SavingsBadge, "earnedAt">; earned: boolean; onPress: () => void }) {
  // Cycle through colors for earned badges
  const badgeColors: { bg: readonly [string, string]; border: string; icon: string }[] = [
    { bg: ["#D1FAE5", "#A7F3D0"] as const, border: "#10B981", icon: "#059669" }, // Green
    { bg: ["#DBEAFE", "#BFDBFE"] as const, border: "#3B82F6", icon: "#2563EB" }, // Blue
    { bg: ["#F3E8FF", "#E9D5FF"] as const, border: "#8B5CF6", icon: "#7C3AED" }, // Purple
    { bg: ["#FEF3C7", "#FDE68A"] as const, border: "#F59E0B", icon: "#D97706" }, // Amber
    { bg: ["#FED7AA", "#FDBA74"] as const, border: "#F97316", icon: "#EA580C" }, // Orange
  ];
  const badgeList = Object.values(BADGE_DEFINITIONS);
  const colorIndex = badgeList.findIndex((b: any) => b.id === badge.id) % badgeColors.length;
  const badgeColor = earned ? badgeColors[colorIndex] : { bg: ["#F3F4F6", "#E5E7EB"] as const, border: "#D1D5DB", icon: MUTED };

  return (
    <TouchableOpacity 
      style={[styles.badgeCard, !earned && styles.badgeCardLocked]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      {earned ? (
        <LinearGradient
          colors={badgeColor.bg}
          style={styles.badgeIconContainer}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={[styles.badgeIconInner, { borderColor: badgeColor.border }]}>
            <Ionicons name={badge.icon as any} size={36} color={badgeColor.icon} />
          </View>
          {/* Sparkle effect for earned badges */}
          <View style={styles.badgeSparkle}>
            <Ionicons name="sparkles" size={16} color={badgeColor.icon} />
          </View>
        </LinearGradient>
      ) : (
        <View style={[styles.badgeIconContainer, styles.badgeIconContainerLocked]}>
          <Ionicons name={badge.icon as any} size={32} color={MUTED} />
          <View style={styles.badgeLockOverlay}>
            <Ionicons name="lock-closed" size={16} color="#fff" />
          </View>
        </View>
      )}
      <Text style={[styles.badgeTitle, !earned && styles.badgeTitleLocked]} numberOfLines={2}>
        {badge.title}
      </Text>
      {earned && (
        <View style={styles.badgeRibbon}>
          <Ionicons name="checkmark-circle" size={12} color={badgeColor.icon} />
        </View>
      )}
    </TouchableOpacity>
  );
}

/* ---------- Badge Details Modal Component ---------- */
function BadgeDetailsModal({
  open,
  badge,
  earned,
  goals,
  onClose,
  currency,
}: {
  open: boolean;
  badge: Omit<SavingsBadge, "earnedAt"> | null;
  earned: boolean;
  goals: SavingsGoal[];
  onClose: () => void;
  currency: Currency;
}) {
  if (!badge) return null;

  // Calculate progress based on badge type
  const getBadgeProgress = () => {
    const completedGoals = goals.filter((g) => g.currentAmount >= g.targetAmount && g.targetAmount > 0);
    
    switch (badge.id) {
      case "first_goal_completed": {
        const current = completedGoals.length;
        const target = 1;
        return { current, target, progress: Math.min((current / target) * 100, 100) };
      }
      case "three_goals_completed": {
        const current = completedGoals.length;
        const target = 3;
        return { current, target, progress: Math.min((current / target) * 100, 100) };
      }
      case "five_goals_completed": {
        const current = completedGoals.length;
        const target = 5;
        return { current, target, progress: Math.min((current / target) * 100, 100) };
      }
      case "big_goal_completed": {
        const bigCompletedGoals = goals.filter(
          (g) => g.currentAmount >= g.targetAmount && g.targetAmount >= 5000
        );
        const current = bigCompletedGoals.length;
        const target = 1;
        return { current, target, progress: Math.min((current / target) * 100, 100) };
      }
      case "streak_3_months": {
        // This would require contributions data, for now return 0
        return { current: 0, target: 3, progress: 0, note: "Requires contributions in 3 consecutive months" };
      }
      default:
        return { current: 0, target: 1, progress: 0 };
    }
  };

  const progress = getBadgeProgress();
  const badgeColors: { bg: readonly [string, string]; border: string; icon: string; gradient: readonly [string, string] }[] = [
    { bg: ["#D1FAE5", "#A7F3D0"] as const, border: "#10B981", icon: "#059669", gradient: ["#ECFDF5", "#D1FAE5"] as const },
    { bg: ["#DBEAFE", "#BFDBFE"] as const, border: "#3B82F6", icon: "#2563EB", gradient: ["#EFF6FF", "#DBEAFE"] as const },
    { bg: ["#F3E8FF", "#E9D5FF"] as const, border: "#8B5CF6", icon: "#7C3AED", gradient: ["#F5F3FF", "#F3E8FF"] as const },
    { bg: ["#FEF3C7", "#FDE68A"] as const, border: "#F59E0B", icon: "#D97706", gradient: ["#FFFBEB", "#FEF3C7"] as const },
    { bg: ["#FED7AA", "#FDBA74"] as const, border: "#F97316", icon: "#EA580C", gradient: ["#FFF7ED", "#FED7AA"] as const },
  ];
  const badgeList = Object.values(BADGE_DEFINITIONS);
  const colorIndex = badgeList.findIndex((b: any) => b.id === badge.id) % badgeColors.length;
  const badgeColor = earned ? badgeColors[colorIndex] : { bg: ["#F3F4F6", "#E5E7EB"] as const, border: "#D1D5DB", icon: MUTED, gradient: ["#F9FAFB", "#F3F4F6"] as const };

  const getRequirementText = () => {
    switch (badge.id) {
      case "first_goal_completed":
        return "Complete your first savings goal";
      case "three_goals_completed":
        return "Complete 3 savings goals";
      case "five_goals_completed":
        return "Complete 5 savings goals";
      case "big_goal_completed":
        return "Complete a savings goal worth RM 5,000 or more";
      case "streak_3_months":
        return "Make contributions in 3 consecutive months";
      default:
        return badge.description;
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.badgeDetailsModalOverlay}>
        <TouchableOpacity 
          style={styles.badgeDetailsModalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.badgeDetailsModalCard}>
          <LinearGradient
            colors={badgeColor.gradient}
            style={styles.badgeDetailsModalGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Close button */}
            <TouchableOpacity onPress={onClose} style={styles.badgeDetailsModalClose}>
              <Ionicons name="close" size={24} color={BRAND_DARK} />
            </TouchableOpacity>

            {/* Badge Icon */}
            <View style={[styles.badgeDetailsIconContainer, !earned && styles.badgeDetailsIconContainerLocked]}>
              {earned ? (
                <LinearGradient
                  colors={badgeColor.bg}
                  style={styles.badgeDetailsIconGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name={badge.icon as any} size={64} color={badgeColor.icon} />
                </LinearGradient>
              ) : (
                <View style={styles.badgeDetailsIconLocked}>
                  <Ionicons name={badge.icon as any} size={64} color={MUTED} />
                  <View style={styles.badgeDetailsLockOverlay}>
                    <Ionicons name="lock-closed" size={32} color="#fff" />
                  </View>
                </View>
              )}
            </View>

            {/* Badge Title */}
            <Text style={styles.badgeDetailsTitle}>{badge.title}</Text>

            {/* Earned Status */}
            {earned ? (
              <View style={styles.badgeDetailsEarnedBadge}>
                <Ionicons name="checkmark-circle" size={16} color={badgeColor.icon} />
                <Text style={[styles.badgeDetailsEarnedText, { color: badgeColor.icon }]}>Earned</Text>
              </View>
            ) : (
              <Text style={styles.badgeDetailsLockedText}>Locked</Text>
            )}

            {/* Description */}
            <Text style={styles.badgeDetailsDescription}>{badge.description}</Text>

            {/* Requirement */}
            <View style={styles.badgeDetailsRequirement}>
              <Ionicons name="information-circle" size={18} color={MUTED} />
              <Text style={styles.badgeDetailsRequirementText}>{getRequirementText()}</Text>
            </View>

            {/* Progress Section */}
            {!earned && (
              <View style={styles.badgeDetailsProgressSection}>
                <View style={styles.badgeDetailsProgressHeader}>
                  <Text style={styles.badgeDetailsProgressLabel}>Progress</Text>
                  <Text style={styles.badgeDetailsProgressValue}>
                    {progress.current} / {progress.target}
                  </Text>
                </View>
                <View style={styles.badgeDetailsProgressBar}>
                  <View 
                    style={[
                      styles.badgeDetailsProgressFill, 
                      { width: `${progress.progress}%`, backgroundColor: badgeColor.icon }
                    ]} 
                  />
                </View>
                {progress.note && (
                  <Text style={styles.badgeDetailsProgressNote}>{progress.note}</Text>
                )}
              </View>
            )}

            {/* Close Button */}
            <TouchableOpacity 
              onPress={onClose} 
              style={[styles.badgeDetailsModalButton, { backgroundColor: earned ? badgeColor.icon : MUTED }]}
              activeOpacity={0.8}
            >
              <Text style={styles.badgeDetailsModalButtonText}>
                {earned ? "Got it!" : "Close"}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- Achievement Modal Component ---------- */
function AchievementModal({
  open,
  badge,
  onClose,
}: {
  open: boolean;
  badge: SavingsBadge | null;
  onClose: () => void;
}) {
  if (!badge) return null;

  // Get badge color
  const badgeColors: { bg: readonly [string, string]; border: string; icon: string; gradient: readonly [string, string] }[] = [
    { bg: ["#D1FAE5", "#A7F3D0"] as const, border: "#10B981", icon: "#059669", gradient: ["#ECFDF5", "#D1FAE5"] as const },
    { bg: ["#DBEAFE", "#BFDBFE"] as const, border: "#3B82F6", icon: "#2563EB", gradient: ["#EFF6FF", "#DBEAFE"] as const },
    { bg: ["#F3E8FF", "#E9D5FF"] as const, border: "#8B5CF6", icon: "#7C3AED", gradient: ["#F5F3FF", "#F3E8FF"] as const },
    { bg: ["#FEF3C7", "#FDE68A"] as const, border: "#F59E0B", icon: "#D97706", gradient: ["#FFFBEB", "#FEF3C7"] as const },
    { bg: ["#FED7AA", "#FDBA74"] as const, border: "#F97316", icon: "#EA580C", gradient: ["#FFF7ED", "#FED7AA"] as const },
  ];
  const badgeList = Object.values(BADGE_DEFINITIONS);
  const colorIndex = badgeList.findIndex((b: any) => b.id === badge.id) % badgeColors.length;
  const badgeColor = badgeColors[colorIndex];

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.achievementModalOverlay}>
        <TouchableOpacity 
          style={styles.achievementModalBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.achievementModalCard}>
          <LinearGradient
            colors={badgeColor.gradient}
            style={styles.achievementModalGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Celebration icons */}
            <View style={styles.celebrationIcons}>
              <Ionicons name="sparkles" size={24} color={badgeColor.icon} style={{ opacity: 0.6 }} />
            </View>
            
            <LinearGradient
              colors={badgeColor.bg}
              style={styles.achievementModalIconContainer}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={[styles.achievementModalIconInner, { borderColor: badgeColor.border }]}>
                <Ionicons name={badge.icon as any} size={72} color={badgeColor.icon} />
              </View>
            </LinearGradient>
            
            <Text style={styles.achievementModalTitle}>🎉 New Achievement!</Text>
            <Text style={[styles.achievementModalBadgeTitle, { color: badgeColor.icon }]}>{badge.title}</Text>
            <Text style={styles.achievementModalDescription}>{badge.description}</Text>
            
            <TouchableOpacity 
              onPress={onClose} 
              style={[styles.achievementModalButton, { backgroundColor: badgeColor.icon }]}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.achievementModalButtonText}>Got it!</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
}

/* ---------- Main Screen ---------- */
export default function Savings() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [badges, setBadges] = useState<SavingsBadge[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>("MYR");
  const [contributionsMap, setContributionsMap] = useState<Record<string, SavingsContribution[]>>({});

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsGoal | null>(null);

  const [contributionModalOpen, setContributionModalOpen] = useState(false);
  const [contributionGoal, setContributionGoal] = useState<SavingsGoal | null>(null);

  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);

  const [newBadgeModalOpen, setNewBadgeModalOpen] = useState(false);
  const [newBadge, setNewBadge] = useState<SavingsBadge | null>(null);
  const [showCompletedGoals, setShowCompletedGoals] = useState(true);
  
  // Badge details modal state
  const [badgeDetailsModalOpen, setBadgeDetailsModalOpen] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<Omit<SavingsBadge, "earnedAt"> | null>(null);
  const [selectedBadgeEarned, setSelectedBadgeEarned] = useState(false);

  // Filter states
  const [filterStatus, setFilterStatus] = useState<"All" | "Active" | "Completed" | "Overdue" | "Not Completed">("All");
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Resolve user id and subscribe to goals
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem("userId");
        const uid = stored || auth.currentUser?.uid || null;
        if (uid && !stored) await AsyncStorage.setItem("userId", uid);
        setUserId(uid);

        // Load showCompletedGoals preference
        const showCompleted = await AsyncStorage.getItem("showCompletedSavingsGoals");
        if (showCompleted !== null) {
          setShowCompletedGoals(showCompleted === "true");
        }

        if (!uid) {
          setLoading(false);
        }
      } catch (e) {
        console.error("Failed to resolve userId", e);
        setLoading(false);
      }
    })();
  }, []);

  // Save showCompletedGoals preference when it changes
  useEffect(() => {
    AsyncStorage.setItem("showCompletedSavingsGoals", String(showCompletedGoals)).catch((e) => {
      console.error("Failed to save showCompletedGoals preference", e);
    });
  }, [showCompletedGoals]);

  // Subscribe to currency
  useEffect(() => {
    if (!userId) return;
    const unsubCurrency = subscribeUserCurrency(userId, (curr) => {
      setCurrency(curr);
    });
    return () => {
      if (unsubCurrency) unsubCurrency();
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const unsubGoals = subscribeUserSavingsGoals(userId, (rows) => {
      setGoals(rows);
      setLoading(false);
      // Sync reminders for all goals (idempotent, so safe to call multiple times)
      rows.forEach((goal) => {
        syncSavingsReminderForGoal(goal).catch((e) => {
          console.error("Error syncing savings reminder for goal:", goal.id, e);
        });
      });
    });

    const unsubBadges = subscribeUserSavingsBadges(userId, (badgesList) => {
      setBadges(badgesList);
    });

    return () => {
      unsubGoals?.();
      unsubBadges?.();
    };
  }, [userId]);

  // Subscribe to contributions for each goal
  useEffect(() => {
    if (goals.length === 0) {
      setContributionsMap({});
      return;
    }

    const unsubscribers: (() => void)[] = [];

    goals.forEach((goal) => {
      const unsub = subscribeGoalContributions(goal.id, (contribs) => {
        setContributionsMap((prev) => ({
          ...prev,
          [goal.id]: contribs,
        }));
      });
      unsubscribers.push(unsub);
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [goals]);

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

  // Split goals into active and completed, with overdue goals prioritized first
  const activeGoals = useMemo(() => {
    const active = goals.filter((g) => g.targetAmount > 0 && g.currentAmount < g.targetAmount);
    
    // Sort: overdue goals first (by most overdue), then non-overdue goals
    return active.sort((a, b) => {
      const aOverdue = getDaysOverdue(a.deadline || null);
      const bOverdue = getDaysOverdue(b.deadline || null);
      
      // If both are overdue, sort by most overdue first (highest days overdue)
      if (aOverdue !== null && bOverdue !== null) {
        return bOverdue - aOverdue; // Descending: most overdue first
      }
      
      // If only one is overdue, it comes first
      if (aOverdue !== null && bOverdue === null) return -1;
      if (aOverdue === null && bOverdue !== null) return 1;
      
      // If neither is overdue, maintain original order
      return 0;
    });
  }, [goals]);

  const completedGoals = useMemo(
    () => goals.filter((g) => g.targetAmount > 0 && g.currentAmount >= g.targetAmount),
    [goals]
  );

  // Filter goals based on selected filter
  const filteredActiveGoals = useMemo(() => {
    if (filterStatus === "Completed") {
      return []; // Hide active goals when showing only completed
    }
    if (filterStatus === "All") return activeGoals;
    if (filterStatus === "Active") {
      return activeGoals.filter((g) => {
        const overdue = getDaysOverdue(g.deadline || null);
        return overdue === null; // Not overdue
      });
    }
    if (filterStatus === "Overdue") {
      return activeGoals.filter((g) => {
        const overdue = getDaysOverdue(g.deadline || null);
        return overdue !== null; // Is overdue
      });
    }
    if (filterStatus === "Not Completed") {
      return activeGoals; // All active (not completed) goals
    }
    return activeGoals;
  }, [activeGoals, filterStatus]);

  // Filter completed goals based on selected filter
  const filteredCompletedGoals = useMemo(() => {
    if (filterStatus === "All" || filterStatus === "Completed") {
      return completedGoals;
    }
    return []; // Hide completed goals for other filters
  }, [completedGoals, filterStatus]);

  // Sort badges: earned badges first, then unearned
  const sortedBadges = useMemo(() => {
    const badgeList = Object.values(BADGE_DEFINITIONS);
    const earnedBadgeIds = new Set(badges.map((b) => b.id));
    
    return badgeList.sort((a, b) => {
      const aEarned = earnedBadgeIds.has(a.id);
      const bEarned = earnedBadgeIds.has(b.id);
      
      // Earned badges come first (return -1 if a is earned and b is not)
      if (aEarned && !bEarned) return -1;
      if (!aEarned && bEarned) return 1;
      
      // If both earned or both unearned, maintain original order
      return 0;
    });
  }, [badges]);

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
      const newlyEarned = await upsertSavingsGoal(userId, goal);
      // Sync reminder notification for this goal
      await syncSavingsReminderForGoal(goal);
      // Show badge modal if any new badges were earned
      if (newlyEarned.length > 0) {
        setNewBadge(newlyEarned[0]); // Show first badge
        setNewBadgeModalOpen(true);
      }
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
            // Cancel reminder notification for this goal
            await cancelSavingsReminder(id);
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
      const newlyEarned = await addSavingsContribution(userId, goalId, {
        amount: contribution.amount,
        date: contribution.date,
        source: contribution.source,
        note: contribution.note,
      });
      Alert.alert("Contribution Added!", `Contribution of ${formatCurrency(contribution.amount, currency)} has been recorded.`);
      // Show badge modal if any new badges were earned
      if (newlyEarned.length > 0) {
        setNewBadge(newlyEarned[0]); // Show first badge
        setNewBadgeModalOpen(true);
      }
    } catch (e: any) {
      console.error(e);
      Alert.alert("Contribution failed", e?.message ?? "Could not record contribution.");
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: "#E4F2ED" }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={BRAND_DARK} />
          <Text style={styles.loadingText}>Loading your savings goals…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: "#E4F2ED" }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={BRAND_DARK} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Savings & Goals</Text>
          <Text style={styles.subtitle}>Track your progress</Text>
        </View>
        <TouchableOpacity onPress={openAdd} style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="add" size={22} color={BRAND_DARK} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Summary Card */}
        <View style={styles.summaryCardContainer}>
          <LinearGradient
            colors={["#115D59", "#0D4A46", "#0A3D39"]}
            style={styles.summaryCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.summaryHeader}>
              <Ionicons name="wallet" size={24} color="#FFFFFF" />
              <Text style={styles.summaryTitle}>Total Savings</Text>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Saved</Text>
                <Text style={styles.summaryValueWhite}>{formatCurrency(stats.totalCurrent, currency)}</Text>
              </View>
              <View style={styles.summaryDividerWhite} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Target</Text>
                <Text style={styles.summaryValueWhite}>{formatCurrency(stats.totalTarget, currency)}</Text>
              </View>
            </View>

            {stats.totalTarget > 0 && (
              <>
                <View style={styles.summaryProgressBar}>
                  <View
                    style={[
                      styles.summaryProgressFill,
                      { width: `${Math.min(stats.overallProgress, 100)}%`, backgroundColor: "#C9EAD6" },
                    ]}
                  />
                </View>
                <Text style={styles.summaryProgressTextWhite}>
                  {Math.round(stats.overallProgress)}% complete • {formatCurrency(stats.totalRemaining, currency)} remaining
                </Text>
              </>
            )}
          </LinearGradient>
        </View>

        {/* Achievements Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <TouchableOpacity
              onPress={async () => {
                if (!userId) return Alert.alert("Not signed in", "Please sign in first.");
                try {
                  const newlyEarned = await checkAndAwardSavingsBadges(userId);
                  if (newlyEarned.length > 0) {
                    setNewBadge(newlyEarned[0]);
                    setNewBadgeModalOpen(true);
                    Alert.alert("Success!", `Earned ${newlyEarned.length} new badge(s)!`);
                  } else {
                    Alert.alert("Badge Check", "No new badges earned. Check the console logs for details about your goals.");
                  }
                } catch (e: any) {
                  console.error("Manual badge check error:", e);
                  Alert.alert("Error", "Failed to check badges. See console for details.");
                }
              }}
              style={styles.refreshBadgeButton}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={18} color={BRAND_DARK} />
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgesContainer}
          >
            {sortedBadges.map((badgeDef) => {
              const earned = badges.some((b) => b.id === badgeDef.id);
              return (
                <BadgeCard 
                  key={badgeDef.id} 
                  badge={badgeDef} 
                  earned={earned}
                  onPress={() => {
                    setSelectedBadge(badgeDef);
                    setSelectedBadgeEarned(earned);
                    setBadgeDetailsModalOpen(true);
                  }}
                />
              );
            })}
          </ScrollView>
          </View>

        {/* Active Goals List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Goals ({filteredActiveGoals.length})</Text>
            <TouchableOpacity
              onPress={() => setShowFilterModal(true)}
              style={styles.filterButton}
              activeOpacity={0.7}
            >
              <Ionicons name="filter" size={18} color={BRAND_DARK} />
              <Text style={styles.filterButtonText}>Filter</Text>
            </TouchableOpacity>
          </View>

          {/* Active Filters Display */}
          {filterStatus !== "All" && (
            <View style={styles.activeFiltersContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
                <View style={styles.activeFilterChip}>
                  <Text style={styles.activeFilterText}>Status: {filterStatus}</Text>
                  <TouchableOpacity onPress={() => setFilterStatus("All")}>
                    <Ionicons name="close-circle" size={16} color={MUTED} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => setFilterStatus("All")}
                  style={styles.clearAllButton}
                >
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          {activeGoals.length === 0 ? (
            <View style={styles.card}>
              <View style={styles.empty}>
                <Ionicons name="trophy-outline" size={56} color={BRAND_GREEN} />
                <Text style={styles.emptyTitle}>No active savings goals</Text>
                <Text style={styles.emptyText}>Tap the + button to create your first savings goal</Text>
              </View>
            </View>
          ) : filteredActiveGoals.length === 0 ? (
            <View style={styles.card}>
              <View style={styles.empty}>
                <Ionicons name="search-outline" size={56} color={MUTED} />
                <Text style={styles.emptyTitle}>No goals match your filters</Text>
                <Text style={styles.emptyText}>Try adjusting your filter options</Text>
              </View>
            </View>
          ) : (
            filteredActiveGoals.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                onEdit={() => openEdit(goal)}
                onDelete={() => deleteGoal(goal.id)}
                onAddContribution={() => openContributionModal(goal)}
                onViewDetails={() => {
                  setSelectedGoal(goal);
                  setDetailsModalOpen(true);
                }}
                currency={currency}
                contributions={contributionsMap[goal.id] || []}
              />
            ))
          )}
        </View>

        {/* Completed Goals List */}
        {(filterStatus === "All" || filterStatus === "Completed") && completedGoals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Completed Goals ({filteredCompletedGoals.length})</Text>
              <TouchableOpacity
                onPress={() => setShowCompletedGoals(!showCompletedGoals)}
                style={styles.toggleButton}
              >
                <Text style={styles.toggleButtonText}>{showCompletedGoals ? "Hide" : "Show"}</Text>
              </TouchableOpacity>
            </View>

            {showCompletedGoals &&
              filteredCompletedGoals.map((goal) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  onEdit={() => openEdit(goal)}
                  onDelete={() => deleteGoal(goal.id)}
                  onAddContribution={() => {}} // No-op since button is hidden for completed goals
                  onViewDetails={() => {
                    setSelectedGoal(goal);
                    setDetailsModalOpen(true);
                  }}
                  currency={currency}
                  contributions={contributionsMap[goal.id] || []}
                />
              ))}
          </View>
        )}
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
        currency={currency}
      />

      <ContributionDetailsModal
        open={detailsModalOpen}
        goal={selectedGoal}
        contributions={selectedGoal ? (contributionsMap[selectedGoal.id] || []) : []}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedGoal(null);
        }}
        currency={currency}
      />

      <AchievementModal
        open={newBadgeModalOpen}
        badge={newBadge}
        onClose={() => {
          setNewBadgeModalOpen(false);
          setNewBadge(null);
        }}
      />

      <BadgeDetailsModal
        open={badgeDetailsModalOpen}
        badge={selectedBadge}
        earned={selectedBadgeEarned}
        goals={goals}
        onClose={() => setBadgeDetailsModalOpen(false)}
        currency={currency}
      />

      {/* Filter Modal */}
      <Modal visible={showFilterModal} transparent animationType="slide" onRequestClose={() => setShowFilterModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                <Ionicons name="close" size={22} color={BRAND_DARK} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 8 }}>
              {/* Filter by Status */}
              <View style={{ marginTop: 12 }}>
                <Text style={styles.inputLabel}>Filter by Status</Text>
                <View style={styles.filterOptionRow}>
                  {(["All", "Active", "Overdue"] as const).map((status) => {
                    const active = filterStatus === status;
                    return (
                      <TouchableOpacity
                        key={status}
                        onPress={() => setFilterStatus(status)}
                        style={[styles.filterOption, active && styles.filterOptionActive]}
                      >
                        {status === "Active" && <Ionicons name="checkmark-circle" size={16} color={active ? "#fff" : BRAND_GREEN} />}
                        {status === "Overdue" && <Ionicons name="alert-circle" size={16} color={active ? "#fff" : RED} />}
                        <Text style={[styles.filterOptionText, active && { color: "#fff" }]}>{status}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Filter by Completion Status */}
              <View style={{ marginTop: 20 }}>
                <Text style={styles.inputLabel}>Filter by Completion</Text>
                <View style={styles.filterOptionRow}>
                  {(["Not Completed", "Completed"] as const).map((status) => {
                    const active = filterStatus === status;
                    return (
                      <TouchableOpacity
                        key={status}
                        onPress={() => setFilterStatus(status)}
                        style={[styles.filterOption, active && styles.filterOptionActive]}
                      >
                        {status === "Completed" && <Ionicons name="trophy" size={16} color={active ? "#fff" : BRAND_GREEN} />}
                        {status === "Not Completed" && <Ionicons name="hourglass-outline" size={16} color={active ? "#fff" : MUTED} />}
                        <Text style={[styles.filterOptionText, active && { color: "#fff" }]}>{status}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={() => setShowFilterModal(false)}
              style={styles.modalPrimary}
            >
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.modalPrimaryText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
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
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: BRAND_DARK, fontSize: 18, fontWeight: "800" },
  subtitle: { color: MUTED, fontSize: 12, marginTop: 2, textAlign: "center" },

  card: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    padding: 20,
    ...shadow(3, 0.12),
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  section: {
    marginTop: 10,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: BRAND_DARK,
    fontSize: 18,
    fontWeight: "800",
  },
  refreshBadgeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  toggleButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  toggleButtonText: {
    color: BRAND_DARK,
    fontSize: 13,
    fontWeight: "700",
  },

  summaryCardContainer: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    overflow: "hidden",
    ...shadow(4, 0.15),
  },
  summaryCard: {
    padding: 20,
    borderRadius: 20,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
  },
  summaryTitle: {
    fontWeight: "800",
    color: "#C9EAD6",
    fontSize: 16,
  },
  summaryRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  summaryItem: {
    flex: 1,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: LINE_SOFT,
    marginHorizontal: 12,
  },
  summaryDividerWhite: {
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginHorizontal: 12,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#C9EAD6",
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "900",
    color: BRAND_DARK,
  },
  summaryValueWhite: {
    fontSize: 20,
    fontWeight: "900",
    color: "#E8F5E9",
  },
  summaryProgressBar: {
    height: 10,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 8,
  },
  summaryProgressFill: {
    height: "100%",
    borderRadius: 5,
  },
  summaryProgressText: {
    fontSize: 12,
    fontWeight: "800",
    color: BRAND_DARK,
    textAlign: "center",
  },
  summaryProgressTextWhite: {
    fontSize: 13,
    fontWeight: "800",
    color: "#C9EAD6",
    textAlign: "center",
  },

  goalCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: CARD_BG,
    borderRadius: 18,
    padding: 18,
    ...shadow(3, 0.1),
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  goalCardCompleted: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1.5,
    borderColor: "#86EFAC",
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
  completedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 6,
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedChipText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#15803D",
  },
  goalActions: {
    flexDirection: "row",
    gap: 6,
  },
  actionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F0FDF4",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },

  progressSection: {
    marginBottom: 12,
  },
  progressBar: {
    height: 10,
    backgroundColor: "#E5E7EB",
    borderRadius: 5,
    overflow: "hidden",
    marginBottom: 8,
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
    backgroundColor: "#F0FDF4",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#D1FAE5",
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
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
    paddingVertical: 12,
    borderRadius: 12,
    ...shadow(2, 0.15),
  },
  addContributionText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 13,
  },

  contributionsSection: {
    backgroundColor: BRAND_GREEN + "11",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  contributionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  contributionsTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: BRAND_DARK,
    textTransform: "uppercase",
  },
  viewDetailsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 11,
    fontWeight: "700",
    color: BRAND_DARK,
  },
  contributionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  contributionDate: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: MUTED,
  },
  contributionAmount: {
    fontSize: 12,
    fontWeight: "900",
    color: BRAND_GREEN,
  },
  contributionsMore: {
    fontSize: 11,
    fontWeight: "700",
    color: MUTED,
    marginTop: 4,
    textAlign: "center",
  },

  empty: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyTitle: {
    color: BRAND_DARK,
    fontWeight: "900",
    fontSize: 18,
  },
  emptyText: {
    color: MUTED,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 20,
    fontSize: 14,
  },

  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
    zIndex: 1000,
  },
  modalCard: {
    backgroundColor: "#E4F2ED",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
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
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE_SOFT,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  datePickerText: {
    flex: 1,
    color: BRAND_DARK,
    fontWeight: "800",
    fontSize: 14,
  },
  datePickerPlaceholder: {
    color: MUTED,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    color: BRAND_DARK,
    fontSize: 14,
    fontWeight: "600",
  },

  badgesContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  badgeCard: {
    width: 110,
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 16,
    marginRight: 10,
    ...shadow(4, 0.15),
    borderWidth: 2,
    borderColor: "#E5E7EB",
    position: "relative",
  },
  badgeCardLocked: {
    opacity: 0.5,
    backgroundColor: "#F9FAFB",
    borderColor: "#D1D5DB",
  },
  badgeIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    position: "relative",
    borderWidth: 3,
    overflow: "visible",
  },
  badgeIconInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    ...shadow(2, 0.2),
  },
  badgeIconContainerLocked: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
    borderWidth: 2,
  },
  badgeSparkle: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    ...shadow(2, 0.3),
  },
  badgeLockOverlay: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BRAND_DARK,
    alignItems: "center",
    justifyContent: "center",
    ...shadow(3, 0.3),
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: BRAND_DARK,
    textAlign: "center",
    lineHeight: 16,
  },
  badgeTitleLocked: {
    color: MUTED,
  },
  badgeRibbon: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    ...shadow(1, 0.2),
  },

  achievementModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  achievementModalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  achievementModalCard: {
    backgroundColor: CARD_BG,
    borderRadius: 28,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    overflow: "hidden",
    ...shadow(12, 0.3),
    borderWidth: 3,
    borderColor: "#FCD34D",
  },
  achievementModalGradient: {
    width: "100%",
    padding: 28,
    alignItems: "center",
    position: "relative",
  },
  celebrationIcons: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  achievementModalIconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 4,
    overflow: "visible",
  },
  achievementModalIconInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    ...shadow(4, 0.3),
  },
  achievementModalTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: BRAND_DARK,
    marginBottom: 12,
    textAlign: "center",
  },
  achievementModalBadgeTitle: {
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 12,
    textAlign: "center",
  },
  achievementModalDescription: {
    fontSize: 15,
    fontWeight: "600",
    color: MUTED,
    textAlign: "center",
    marginBottom: 28,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  achievementModalButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
    width: "100%",
    justifyContent: "center",
    ...shadow(4, 0.3),
  },
  achievementModalButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
  },

  // Badge Details Modal Styles
  badgeDetailsModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  badgeDetailsModalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  badgeDetailsModalCard: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    overflow: "hidden",
    ...shadow(12, 0.3),
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  badgeDetailsModalGradient: {
    width: "100%",
    padding: 24,
    alignItems: "center",
    position: "relative",
  },
  badgeDetailsModalClose: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    ...shadow(2, 0.2),
  },
  badgeDetailsIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    position: "relative",
  },
  badgeDetailsIconContainerLocked: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
  },
  badgeDetailsIconGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
  },
  badgeDetailsIconLocked: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#E5E7EB",
    position: "relative",
  },
  badgeDetailsLockOverlay: {
    position: "absolute",
    bottom: -8,
    right: -8,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BRAND_DARK,
    alignItems: "center",
    justifyContent: "center",
    ...shadow(3, 0.3),
    borderWidth: 3,
    borderColor: "#fff",
  },
  badgeDetailsTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: BRAND_DARK,
    marginBottom: 8,
    textAlign: "center",
  },
  badgeDetailsEarnedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
    ...shadow(1, 0.1),
  },
  badgeDetailsEarnedText: {
    fontSize: 14,
    fontWeight: "800",
  },
  badgeDetailsLockedText: {
    fontSize: 14,
    fontWeight: "800",
    color: MUTED,
    marginBottom: 12,
  },
  badgeDetailsDescription: {
    fontSize: 15,
    fontWeight: "600",
    color: BRAND_DARK,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 22,
  },
  badgeDetailsRequirement: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    width: "100%",
  },
  badgeDetailsRequirementText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: MUTED,
    lineHeight: 18,
  },
  badgeDetailsProgressSection: {
    width: "100%",
    marginBottom: 20,
  },
  badgeDetailsProgressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badgeDetailsProgressLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: BRAND_DARK,
  },
  badgeDetailsProgressValue: {
    fontSize: 14,
    fontWeight: "800",
    color: BRAND_DARK,
  },
  badgeDetailsProgressBar: {
    height: 12,
    backgroundColor: "#E5E7EB",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 8,
  },
  badgeDetailsProgressFill: {
    height: "100%",
    borderRadius: 6,
  },
  badgeDetailsProgressNote: {
    fontSize: 12,
    fontWeight: "600",
    color: MUTED,
    textAlign: "center",
    fontStyle: "italic",
  },
  badgeDetailsModalButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    ...shadow(4, 0.3),
  },
  badgeDetailsModalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
  },

  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  filterButtonText: {
    color: BRAND_DARK,
    fontSize: 13,
    fontWeight: "700",
  },
  activeFiltersContainer: {
    marginTop: 10,
    marginBottom: 8,
  },
  activeFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: CARD_BG,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    ...shadow(1, 0.05),
  },
  activeFilterText: {
    color: BRAND_DARK,
    fontSize: 12,
    fontWeight: "700",
  },
  clearAllButton: {
    backgroundColor: RED + "22",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: RED + "44",
  },
  clearAllText: {
    color: RED,
    fontSize: 12,
    fontWeight: "700",
  },
  // Contribution Details Modal Styles
  detailsGoalInfo: {
    backgroundColor: "#F7FAF9",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  detailsGoalName: {
    fontSize: 16,
    fontWeight: "900",
    color: BRAND_DARK,
    marginBottom: 12,
  },
  detailsGoalStats: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailsStatItem: {
    flex: 1,
  },
  detailsStatDivider: {
    width: 1,
    backgroundColor: LINE_SOFT,
    marginHorizontal: 10,
  },
  detailsStatLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: MUTED,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  detailsStatValue: {
    fontSize: 14,
    fontWeight: "900",
    color: BRAND_DARK,
  },
  detailsSection: {
    marginTop: 8,
  },
  detailsSectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: BRAND_DARK,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  detailsEmpty: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 8,
  },
  detailsEmptyText: {
    fontSize: 13,
    fontWeight: "600",
    color: MUTED,
  },
  detailsContributionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 8,
    ...shadow(1, 0.05),
  },
  detailsContributionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  detailsContributionInfo: {
    flex: 1,
  },
  detailsContributionDate: {
    fontSize: 13,
    fontWeight: "700",
    color: BRAND_DARK,
    marginBottom: 2,
  },
  detailsContributionNote: {
    fontSize: 11,
    fontWeight: "600",
    color: MUTED,
  },
  detailsContributionAmount: {
    fontSize: 14,
    fontWeight: "900",
    color: BRAND_GREEN,
  },
  filterOptionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  filterOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LINE_SOFT,
    backgroundColor: "#fff",
  },
  filterOptionActive: {
    backgroundColor: BRAND_DARK,
    borderColor: BRAND_DARK,
  },
  filterOptionText: {
    color: BRAND_DARK,
    fontWeight: "800",
    fontSize: 13,
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

