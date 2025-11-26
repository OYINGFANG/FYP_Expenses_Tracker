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
 */
export async function upsertSavingsGoal(
  userId: string,
  goal: Partial<SavingsGoal> & { id?: string }
): Promise<void> {
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
}

/**
 * Add a contribution and atomically increment the goal's current_amount.
 * Uses a transaction to ensure consistency.
 */
export async function addSavingsContribution(
  userId: string,
  goalId: string,
  payload: { amount: number; date?: Date; source?: string; note?: string }
): Promise<void> {
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

