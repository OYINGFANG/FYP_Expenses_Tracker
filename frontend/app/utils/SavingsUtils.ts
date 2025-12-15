// app/utils/SavingsUtils.ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { createBadgeNotification } from "./badgeNotificationUtils";

export type SavingsGoal = {
  id: string;
  userId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  monthlyTarget?: number | null;
  deadline?: Date | null;
  category?: string;
  notes?: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
};

export type SavingsContribution = {
  id: string;
  goalId: string;
  amount: number;
  date: Date;
  source?: string;
  note?: string;
};

export type SavingsBadge = {
  id: string;
  title: string;
  description: string;
  icon: string;
  earnedAt: Date;
};

const userPath = (userId: string) => `/USERS/${userId}`;

/**
 * Subscribe to savings goals for a user.
 * Maps Firestore docs to SavingsGoal with JS Date for deadline/createdAt.
 */
export function subscribeUserSavingsGoals(
  userId: string,
  callback: (goals: SavingsGoal[]) => void
): () => void {
  const goalsRef = collection(db, "SAVINGS_GOALS");
  const q = query(goalsRef, where("user_id", "==", userPath(userId)));

  const unsub = onSnapshot(
    q,
    (snap) => {
      const goals: SavingsGoal[] = snap.docs.map((d) => {
        const x = d.data() as any;

        const createdAtDate =
          x.created_at?.toDate?.() ||
          (x.created_at ? new Date(x.created_at) : null);

        const updatedAtDate =
          x.updated_at?.toDate?.() ||
          (x.updated_at ? new Date(x.updated_at) : null);

        const deadlineDate =
          x.deadline?.toDate?.() || (x.deadline ? new Date(x.deadline) : null);

        return {
          id: d.id,
          userId: x.user_id || userPath(userId),
          name: x.name || "",
          targetAmount: Number(x.target_amount) || 0,
          currentAmount: Number(x.current_amount) || 0,
          monthlyTarget: x.monthly_target !== undefined ? Number(x.monthly_target) || null : null,
          deadline: deadlineDate,
          category: x.category || undefined,
          notes: x.notes || undefined,
          createdAt: createdAtDate,
          updatedAt: updatedAtDate,
        };
      });

      callback(goals);
    },
    (e) => {
      console.error("subscribeUserSavingsGoals error:", e);
      callback([]);
    }
  );

  return unsub;
}

/**
 * Create or update a savings goal.
 * If goal.id exists → update existing doc.
 * Else → create new doc with current_amount = 0.
 * Also checks and awards badges if the goal might be completed.
 */
export async function upsertSavingsGoal(
  userId: string,
  goal: Partial<SavingsGoal> & { id?: string }
): Promise<SavingsBadge[]> {
  const base = {
    user_id: userPath(userId),
    name: goal.name ?? "",
    target_amount: Number(goal.targetAmount) || 0,
    monthly_target: goal.monthlyTarget !== undefined ? (goal.monthlyTarget ? Number(goal.monthlyTarget) : null) : null,
    deadline: goal.deadline ? Timestamp.fromDate(goal.deadline) : null,
    category: goal.category || null,
    notes: goal.notes || null,
    updated_at: serverTimestamp(),
  };

  if (goal.id) {
    // Update existing
    const ref = doc(db, "SAVINGS_GOALS", goal.id);
    await setDoc(
      ref,
      {
        ...base,
        current_amount: goal.currentAmount !== undefined ? Number(goal.currentAmount) || 0 : undefined,
        created_at: goal.createdAt ? Timestamp.fromDate(goal.createdAt) : serverTimestamp(),
      },
      { merge: true }
    );
  } else {
    // Create new
    const ref = await addDoc(collection(db, "SAVINGS_GOALS"), {
      ...base,
      current_amount: 0,
      created_at: serverTimestamp(),
    });
  }

  // Check and award badges after goal is updated/created
  // This is especially important when currentAmount might reach targetAmount
  return await checkAndAwardSavingsBadges(userId);
}

/**
 * Add a contribution and atomically increment the goal's current_amount.
 * Uses a transaction to ensure consistency.
 * Also checks and awards badges after the contribution is added.
 */
export async function addSavingsContribution(
  userId: string,
  goalId: string,
  payload: { amount: number; date?: Date; source?: string; note?: string }
): Promise<SavingsBadge[]> {
  const goalRef = doc(db, "SAVINGS_GOALS", goalId);
  const contributionsCol = collection(goalRef, "CONTRIBUTIONS");

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(goalRef);
    if (!snap.exists()) throw new Error("Savings goal not found");

    const data = snap.data() as any;
    const current = Number(data.current_amount) || 0;
    const contributionAmount = Number(payload.amount) || 0;
    const nextAmount = current + contributionAmount;

    const contribRef = doc(contributionsCol);
    tx.set(contribRef, {
      user_id: userPath(userId),
      amount: contributionAmount,
      date: payload.date ? Timestamp.fromDate(payload.date) : serverTimestamp(),
      source: payload.source || null,
      note: payload.note || null,
      created_at: serverTimestamp(),
    });

    tx.update(goalRef, {
      current_amount: nextAmount,
      updated_at: serverTimestamp(),
    });
  });

  // Check and award badges after contribution is added
  return await checkAndAwardSavingsBadges(userId);
}

/**
 * Delete a savings goal and all its contributions.
 * Uses a batched write to delete all subcollection docs first.
 */
export async function deleteSavingsGoalDeep(userId: string, goalId: string): Promise<void> {
  const goalRef = doc(db, "SAVINGS_GOALS", goalId);
  const contributionsCol = collection(goalRef, "CONTRIBUTIONS");
  
  // Get all contributions
  const contribSnap = await getDocs(contributionsCol);
  const batch = writeBatch(db);
  
  // Delete all contributions
  contribSnap.docs.forEach((d) => {
    batch.delete(d.ref);
  });
  
  // Delete the goal
  batch.delete(goalRef);
  
  await batch.commit();
}

/* =========================
   Badge Definitions
========================= */
export const BADGE_DEFINITIONS: Record<string, Omit<SavingsBadge, "earnedAt">> = {
  first_goal_completed: {
    id: "first_goal_completed",
    title: "First Goal",
    description: "Completed your first savings goal",
    icon: "trophy",
  },
  three_goals_completed: {
    id: "three_goals_completed",
    title: "Triple Achievement",
    description: "Completed 3 savings goals",
    icon: "medal",
  },
  five_goals_completed: {
    id: "five_goals_completed",
    title: "Five Star Saver",
    description: "Completed 5 savings goals",
    icon: "star",
  },
  big_goal_completed: {
    id: "big_goal_completed",
    title: "Big Spender Saver",
    description: "Completed a goal worth RM 5,000 or more",
    icon: "diamond",
  },
  streak_3_months: {
    id: "streak_3_months",
    title: "Consistent Saver",
    description: "Made contributions in 3 consecutive months",
    icon: "flame",
  },
};

/* =========================
   Badge Firestore Functions
========================= */
/**
 * Subscribe to savings badges for a user.
 * Badges are stored with badge_id field and persist across sign-ins.
 */
export function subscribeUserSavingsBadges(
  userId: string,
  callback: (badges: SavingsBadge[]) => void
): () => void {
  const badgesRef = collection(db, "SAVINGS_BADGES");
  const q = query(badgesRef, where("user_id", "==", userPath(userId)));

  const unsub = onSnapshot(
    q,
    (snap) => {
      const badges: SavingsBadge[] = snap.docs.map((d) => {
        const x = d.data() as any;
        const earnedAtDate =
          x.earned_at?.toDate?.() || (x.earned_at ? new Date(x.earned_at) : new Date());

        // Use badge_id from document data, fallback to extracting from doc ID if needed
        let badgeId = x.badge_id;
        if (!badgeId && d.id.includes("_")) {
          // Extract badge_id from composite document ID (userId_badgeId format)
          const parts = d.id.split("_");
          badgeId = parts[parts.length - 1]; // Last part should be badge_id
        }

        return {
          id: badgeId || d.id,
          title: x.title || "",
          description: x.description || "",
          icon: x.icon || "trophy",
          earnedAt: earnedAtDate,
        };
      });

      // Remove duplicates by badge_id (in case of any legacy duplicates)
      const uniqueBadges = badges.filter(
        (badge, index, self) => index === self.findIndex((b) => b.id === badge.id)
      );

      callback(uniqueBadges);
    },
    (e) => {
      console.error("subscribeUserSavingsBadges error:", e);
      callback([]);
    }
  );

  return unsub;
}

/**
 * Get all contributions for a user across all goals.
 */
async function getAllUserContributions(userId: string): Promise<SavingsContribution[]> {
  const goalsRef = collection(db, "SAVINGS_GOALS");
  const q = query(goalsRef, where("user_id", "==", userPath(userId)));
  const goalsSnap = await getDocs(q);

  const contributions: SavingsContribution[] = [];

  for (const goalDoc of goalsSnap.docs) {
    const contributionsCol = collection(goalDoc.ref, "CONTRIBUTIONS");
    const contribSnap = await getDocs(contributionsCol);

    contribSnap.docs.forEach((d) => {
      const x = d.data() as any;
      const date = x.date?.toDate?.() || (x.date ? new Date(x.date) : new Date());

      contributions.push({
        id: d.id,
        goalId: goalDoc.id,
        amount: Number(x.amount) || 0,
        date,
        source: x.source || undefined,
        note: x.note || undefined,
      });
    });
  }

  return contributions;
}

/**
 * Check and award savings badges based on current goals and contributions.
 * Returns newly earned badges.
 */
export async function checkAndAwardSavingsBadges(userId: string): Promise<SavingsBadge[]> {
  try {
    // Get all goals
    const goalsRef = collection(db, "SAVINGS_GOALS");
    const q = query(goalsRef, where("user_id", "==", userPath(userId)));
    const goalsSnap = await getDocs(q);
    const goals: SavingsGoal[] = goalsSnap.docs.map((d) => {
      const x = d.data() as any;
      const createdAtDate =
        x.created_at?.toDate?.() || (x.created_at ? new Date(x.created_at) : null);
      const updatedAtDate =
        x.updated_at?.toDate?.() || (x.updated_at ? new Date(x.updated_at) : null);
      const deadlineDate =
        x.deadline?.toDate?.() || (x.deadline ? new Date(x.deadline) : null);

      return {
        id: d.id,
        userId: x.user_id || userPath(userId),
        name: x.name || "",
        targetAmount: Number(x.target_amount) || 0,
        currentAmount: Number(x.current_amount) || 0,
        monthlyTarget: x.monthly_target !== undefined ? Number(x.monthly_target) || null : null,
        deadline: deadlineDate,
        category: x.category || undefined,
        notes: x.notes || undefined,
        createdAt: createdAtDate,
        updatedAt: updatedAtDate,
      };
    });

    // Get existing badges
    const badgesRef = collection(db, "SAVINGS_BADGES");
    const badgesQ = query(badgesRef, where("user_id", "==", userPath(userId)));
    const badgesSnap = await getDocs(badgesQ);
    const existingBadgeIds = new Set(badgesSnap.docs.map((d) => d.data().badge_id || d.id));

    // Get all contributions for streak checking
    const contributions = await getAllUserContributions(userId);

    const newlyEarned: SavingsBadge[] = [];
    const now = new Date();

    // Check each badge rule
    for (const [badgeId, badgeDef] of Object.entries(BADGE_DEFINITIONS)) {
      if (existingBadgeIds.has(badgeId)) continue; // Already earned

      let shouldAward = false;

      switch (badgeId) {
        case "first_goal_completed": {
          // First time any goal is completed
          const completedGoals = goals.filter((g) => g.currentAmount >= g.targetAmount && g.targetAmount > 0);
          shouldAward = completedGoals.length >= 1;
          break;
        }

        case "three_goals_completed": {
          const completedGoals = goals.filter((g) => g.currentAmount >= g.targetAmount && g.targetAmount > 0);
          shouldAward = completedGoals.length >= 3;
          break;
        }

        case "five_goals_completed": {
          const completedGoals = goals.filter((g) => g.currentAmount >= g.targetAmount && g.targetAmount > 0);
          shouldAward = completedGoals.length >= 5;
          break;
        }

        case "big_goal_completed": {
          // Any completed goal with targetAmount >= 5000
          const bigCompletedGoals = goals.filter(
            (g) => g.currentAmount >= g.targetAmount && g.targetAmount >= 5000
          );
          shouldAward = bigCompletedGoals.length >= 1;
          break;
        }

        case "streak_3_months": {
          // Check if user has contributions in at least 3 distinct months
          const monthSet = new Set<string>();
          contributions.forEach((c) => {
            const monthKey = `${c.date.getFullYear()}-${String(c.date.getMonth() + 1).padStart(2, "0")}`;
            monthSet.add(monthKey);
          });

          // Get last 3 months
          const last3Months: string[] = [];
          for (let i = 0; i < 3; i++) {
            const date = new Date(now);
            date.setMonth(date.getMonth() - i);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            last3Months.push(monthKey);
          }

          // Check if all last 3 months have contributions
          shouldAward = last3Months.every((month) => monthSet.has(month));
          break;
        }
      }

      if (shouldAward) {
        // Use a deterministic document ID to prevent duplicates: userId_badgeId
        // This ensures each user can only have one badge of each type, and badges persist across sign-ins
        // Sanitize userId to ensure valid Firestore document ID (no slashes, special chars)
        const sanitizedUserId = userId.replace(/[^a-zA-Z0-9]/g, "_");
        const badgeDocId = `${sanitizedUserId}_${badgeId}`;
        const badgeRef = doc(db, "SAVINGS_BADGES", badgeDocId);

        // Double-check if badge already exists to prevent race conditions
        const existingBadgeDoc = await getDocs(
          query(
            collection(db, "SAVINGS_BADGES"),
            where("user_id", "==", userPath(userId)),
            where("badge_id", "==", badgeId)
          )
        );

        if (existingBadgeDoc.empty) {
          // Award the badge with deterministic ID - this ensures persistence across sign-ins
          await setDoc(
            badgeRef,
            {
              user_id: userPath(userId),
              badge_id: badgeId,
              title: badgeDef.title,
              description: badgeDef.description,
              icon: badgeDef.icon,
              earned_at: serverTimestamp(),
            },
            { merge: false }
          ); // Use merge: false to ensure we don't accidentally overwrite existing badges

          const earnedBadge: SavingsBadge = {
            id: badgeId,
            title: badgeDef.title,
            description: badgeDef.description,
            icon: badgeDef.icon,
            earnedAt: now,
          };

          newlyEarned.push(earnedBadge);

          // Create notification for the earned badge
          await createBadgeNotification(earnedBadge).catch((e) => {
            console.error(`Error creating notification for badge ${badgeId}:`, e);
          });
        } else {
          // Badge already exists, skip (this shouldn't happen due to existingBadgeIds check, but safety net)
          console.log(`Badge ${badgeId} already exists for user ${userId}, skipping duplicate creation`);
        }
      }
    }

    return newlyEarned;
  } catch (e) {
    console.error("checkAndAwardSavingsBadges error:", e);
    return [];
  }
}

