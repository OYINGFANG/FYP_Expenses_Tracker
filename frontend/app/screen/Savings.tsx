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
  upsertSavingsGoal,
  addSavingsContribution,
  deleteSavingsGoalDeep,
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
  currency,
}: {
  goal: SavingsGoal;
  onEdit: () => void;
  onDelete: () => void;
  onAddContribution: () => void;
  currency: Currency;
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
function BadgeCard({ badge, earned }: { badge: Omit<SavingsBadge, "earnedAt">; earned: boolean }) {
  return (
    <View style={[styles.badgeCard, !earned && styles.badgeCardLocked]}>
      <View style={[styles.badgeIconContainer, !earned && styles.badgeIconContainerLocked]}>
        {earned ? (
          <Ionicons name={badge.icon as any} size={32} color={BRAND_GREEN} />
        ) : (
          <>
            <Ionicons name={badge.icon as any} size={32} color={MUTED} />
            <View style={styles.badgeLockOverlay}>
              <Ionicons name="lock-closed" size={16} color="#fff" />
            </View>
          </>
        )}
      </View>
      <Text style={[styles.badgeTitle, !earned && styles.badgeTitleLocked]} numberOfLines={1}>
        {badge.title}
      </Text>
    </View>
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

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.achievementModalOverlay}>
        <View style={styles.achievementModalCard}>
          <View style={styles.achievementModalIconContainer}>
            <Ionicons name={badge.icon as any} size={64} color={BRAND_GREEN} />
          </View>
          <Text style={styles.achievementModalTitle}>New Achievement!</Text>
          <Text style={styles.achievementModalBadgeTitle}>{badge.title}</Text>
          <Text style={styles.achievementModalDescription}>{badge.description}</Text>
          <TouchableOpacity onPress={onClose} style={styles.achievementModalButton}>
            <Text style={styles.achievementModalButtonText}>Got it</Text>
          </TouchableOpacity>
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

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<SavingsGoal | null>(null);

  const [contributionModalOpen, setContributionModalOpen] = useState(false);
  const [contributionGoal, setContributionGoal] = useState<SavingsGoal | null>(null);

  const [newBadgeModalOpen, setNewBadgeModalOpen] = useState(false);
  const [newBadge, setNewBadge] = useState<SavingsBadge | null>(null);
  const [showCompletedGoals, setShowCompletedGoals] = useState(true);

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
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgesContainer}
          >
            {sortedBadges.map((badgeDef) => {
              const earned = badges.some((b) => b.id === badgeDef.id);
              return <BadgeCard key={badgeDef.id} badge={badgeDef} earned={earned} />;
            })}
          </ScrollView>
          </View>

        {/* Active Goals List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Goals ({activeGoals.length})</Text>
          </View>

          {activeGoals.length === 0 ? (
            <View style={styles.card}>
              <View style={styles.empty}>
                <Ionicons name="trophy-outline" size={56} color={BRAND_GREEN} />
                <Text style={styles.emptyTitle}>No active savings goals</Text>
                <Text style={styles.emptyText}>Tap the + button to create your first savings goal</Text>
              </View>
            </View>
          ) : (
            activeGoals.map((goal) => (
              <GoalRow
                key={goal.id}
                goal={goal}
                onEdit={() => openEdit(goal)}
                onDelete={() => deleteGoal(goal.id)}
                onAddContribution={() => openContributionModal(goal)}
                currency={currency}
              />
            ))
          )}
        </View>

        {/* Completed Goals List */}
        {completedGoals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Completed Goals ({completedGoals.length})</Text>
              <TouchableOpacity
                onPress={() => setShowCompletedGoals(!showCompletedGoals)}
                style={styles.toggleButton}
              >
                <Text style={styles.toggleButtonText}>{showCompletedGoals ? "Hide" : "Show"}</Text>
              </TouchableOpacity>
            </View>

            {showCompletedGoals &&
              completedGoals.map((goal) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  onEdit={() => openEdit(goal)}
                  onDelete={() => deleteGoal(goal.id)}
                  onAddContribution={() => {}} // No-op since button is hidden for completed goals
                  currency={currency}
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

      <AchievementModal
        open={newBadgeModalOpen}
        badge={newBadge}
        onClose={() => {
          setNewBadgeModalOpen(false);
          setNewBadge(null);
        }}
      />
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
    marginTop: 20,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: {
    color: BRAND_DARK,
    fontSize: 18,
    fontWeight: "800",
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
    width: 100,
    alignItems: "center",
    backgroundColor: CARD_BG,
    borderRadius: 18,
    padding: 14,
    marginRight: 10,
    ...shadow(3, 0.1),
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  badgeCardLocked: {
    opacity: 0.6,
    backgroundColor: "#F9FAFB",
  },
  badgeIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#D1FAE5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    position: "relative",
    borderWidth: 2,
    borderColor: "#A7F3D0",
  },
  badgeIconContainerLocked: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
  },
  badgeLockOverlay: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: BRAND_DARK,
    alignItems: "center",
    justifyContent: "center",
    ...shadow(2, 0.2),
  },
  badgeTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: BRAND_DARK,
    textAlign: "center",
  },
  badgeTitleLocked: {
    color: MUTED,
  },

  achievementModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  achievementModalCard: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    ...shadow(8, 0.2),
  },
  achievementModalIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#F0FDF4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  achievementModalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: BRAND_DARK,
    marginBottom: 8,
  },
  achievementModalBadgeTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: BRAND_GREEN,
    marginBottom: 8,
  },
  achievementModalDescription: {
    fontSize: 14,
    fontWeight: "600",
    color: MUTED,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  achievementModalButton: {
    backgroundColor: BRAND_DARK,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
  },
  achievementModalButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "900",
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

