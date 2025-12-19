// app/utils/budgetUtils.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, doc, getDocs, limit, query, setDoc, where } from "firebase/firestore";
import { db } from "../../firebase";

/* =========================
   Types
========================= */
export interface BudgetAllocation {
  totalBudget: number;
  allocations: Record<string, number>;   // category -> RM
  percentages: Record<string, number>;   // category -> % (0..100)
}
export interface BudgetRecord extends BudgetAllocation {
  budId: string;
  userId: string;
  monthKey: string;
  createdAt: string;
  updatedAt: string;
}
export interface CategoryProgress {
  allocated: number; // RM
  spent: number;     // RM
  ratio: number;     // spent/allocated (0..∞)
}
export interface BudgetProgress {
  monthKey: string;
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  utilizationPct: number; // (spent/totalBudget)*100
  byCategory: Record<string, CategoryProgress>;
}

/* =========================
   Constants
========================= */
const BUDGET_COLLECTION = "BUDGET";
const EXPENSES_COLLECTION = "EXPENSES";

export const recommendedPercentages: Record<string, number> = {
  Food: 13,
  Shopping: 6,
  Bills: 12,
  Entertainment: 4,
  Transport: 10,
  Healthcare: 7,
  Education: 2,
  Housing: 25,
  Savings: 20,
  Debt: 0, // Debt payments - users can allocate budget for debt repayment
  Others: 1,
};

export const getAllBudgetCategories = (): string[] => Object.keys(recommendedPercentages);

/* =========================
   Helpers
========================= */
const normalizeUserPath = (userId: string): string =>
  userId.startsWith("/USERS/") ? userId : `/USERS/${userId}`;

export const getCurrentMonthKey = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const ensureAllCategories = (values: Record<string, number>, def = 0): Record<string, number> => {
  const base: Record<string, number> = {};
  getAllBudgetCategories().forEach((c) => (base[c] = def));
  return { ...base, ...values };
};

const toNumberMap = (map: Record<string, any>): Record<string, number> => {
  const out: Record<string, number> = {};
  Object.entries(map ?? {}).forEach(([k, v]) => {
    const num = typeof v === "number" ? v : Number(v);
    out[k] = Number.isFinite(num) ? num : 0;
  });
  return out;
};

/** Month ISO range for Firestore queries */
export const getMonthDateRange = (monthKey?: string) => {
  const [y, m] = (monthKey ?? getCurrentMonthKey()).split("-").map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0); // first of next month
  return { startISO: start.toISOString(), endISO: end.toISOString() };
};

/* =========================
   Budget fetch/save
========================= */
export const fetchBudgetRecordForUser = async (
  userId: string,
  monthKey: string = getCurrentMonthKey()
): Promise<BudgetRecord | null> => {
  const userPath = normalizeUserPath(userId);
  const qRef = query(
    collection(db, BUDGET_COLLECTION),
    where("user_id", "==", userPath),
    where("month_key", "==", monthKey),
    limit(1)
  );

  const snap = await getDocs(qRef);
  if (snap.empty) return null;

  const docSnap = snap.docs[0];
  const data = docSnap.data() as any;
  const totalBudget = Number(data.total_budget) || 0;

  // Percentages
  const rawPct = toNumberMap(data.percentages ?? {});
  let percentages = ensureAllCategories(rawPct);
  const sumPct = Object.values(percentages).reduce((s, v) => s + v, 0);
  // convert 0..1 fractions to %
  if (sumPct > 0 && sumPct <= 1.5) {
    percentages = ensureAllCategories(
      Object.fromEntries(Object.entries(percentages).map(([k, v]) => [k, Math.round(v * 100 * 100) / 100]))
    );
  }

  // Allocations (calc + allow persisted overrides)
  const rawAlloc = toNumberMap(data.allocations ?? {});
  const calcAlloc = calculateBudgetAllocation(totalBudget, percentages);
  const allocations = { ...calcAlloc, ...rawAlloc };

  return {
    budId: typeof data.bud_id === "string" ? data.bud_id : docSnap.id,
    userId: userPath,
    totalBudget,
    percentages,
    allocations,
    monthKey: typeof data.month_key === "string" ? data.month_key : monthKey,
    createdAt: typeof data.created_at === "string" ? data.created_at : "",
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : "",
  };
};

export const getUserBudget = async (
  monthKey: string = getCurrentMonthKey()
): Promise<BudgetRecord | null> => {
  try {
    const userId = await AsyncStorage.getItem("userId");
    if (!userId) return null;
    return await fetchBudgetRecordForUser(userId, monthKey);
  } catch (e) {
    console.error("🔥 getUserBudget:", e);
    return null;
  }
};

export const createUserBudget = async (
  budget: BudgetAllocation,
  monthKey: string = getCurrentMonthKey()
): Promise<BudgetRecord | null> => {
  try {
    const userId = await AsyncStorage.getItem("userId");
    if (!userId) return null;

    const userPath = normalizeUserPath(userId);
    const existing = await fetchBudgetRecordForUser(userId, monthKey);
    if (existing) return null;

    const budId = `BUD-${Date.now()}`;
    const now = new Date().toISOString();

    const percentages = ensureAllCategories(toNumberMap(budget.percentages));
    const inputAlloc = ensureAllCategories(toNumberMap(budget.allocations), 0);
    const calcAlloc = calculateBudgetAllocation(budget.totalBudget, percentages);

    // Keep explicit overrides
    getAllBudgetCategories().forEach((c) => {
      if (inputAlloc[c]) calcAlloc[c] = Math.round(Number(inputAlloc[c]) * 100) / 100;
    });

    const payload = {
      bud_id: budId,
      user_id: userPath,
      total_budget: budget.totalBudget,
      percentages,
      allocations: calcAlloc,
      month_key: monthKey,
      created_at: now,
      updated_at: now,
    };

    await setDoc(doc(collection(db, BUDGET_COLLECTION), budId), payload);

    return {
      budId,
      userId: userPath,
      totalBudget: budget.totalBudget,
      percentages,
      allocations: calcAlloc,
      monthKey,
      createdAt: now,
      updatedAt: now,
    };
  } catch (e) {
    console.error("🔥 createUserBudget:", e);
    return null;
  }
};

/* =========================
   Calculations
========================= */
export const calculateBudgetAllocation = (
  totalBudget: number,
  percentages: Record<string, number>
): Record<string, number> => {
  const allocations: Record<string, number> = {};
  const cats = new Set([...getAllBudgetCategories(), ...Object.keys(percentages)]);
  cats.forEach((c) => {
    const pct = Number.isFinite(percentages[c]) ? percentages[c] : 0;
    allocations[c] = Math.round(totalBudget * (pct / 100) * 100) / 100;
  });
  return allocations;
};

export const validateBudgetPercentages = (percentages: Record<string, number>) => {
  const total = Object.values(percentages).reduce((s, v) => s + v, 0);
  const difference = Math.abs(100 - total);
  return { isValid: difference < 0.01, total, difference };
};

export const getRecommendedBudget = (totalBudget: number): BudgetAllocation => {
  const allocations = calculateBudgetAllocation(totalBudget, recommendedPercentages);
  return { totalBudget, allocations, percentages: { ...recommendedPercentages } };
};

export const getComprehensiveRecommendedBudget = (totalBudget: number): BudgetAllocation => {
  const allocations = calculateBudgetAllocation(totalBudget, { ...recommendedPercentages });
  return { totalBudget, allocations, percentages: { ...recommendedPercentages } };
};

/* =========================
   Spend aggregation & progress
========================= */
export const getUserMonthlySpendByCategory = async (
  monthKey: string = getCurrentMonthKey()
): Promise<Record<string, number>> => {
  const userId = await AsyncStorage.getItem("userId");
  if (!userId) return {};
  const userPath = userId.startsWith("/USERS/") ? userId : `/USERS/${userId}`;
  const { startISO, endISO } = getMonthDateRange(monthKey);

  const sums: Record<string, number> = {};
  const add = (cat: string, amt: number) => (sums[cat] = (sums[cat] ?? 0) + amt);

  try {
    // Preferred: indexed query (user_id equality + exp_date range)
    const qRef = query(
      collection(db, "EXPENSES"),
      where("user_id", "==", userPath),
      where("exp_date", ">=", startISO),
      where("exp_date", "<", endISO)
    );
    const snap = await getDocs(qRef);
    snap.forEach((d) => {
      const data = d.data() as any;
      const cat = (data.exp_category as string) || "Others";
      const amt = Number(data.exp_total) || 0;
      add(cat, amt);
    });
  } catch (e: any) {
    // Fallback: environment missing composite index -> fetch by user_id only and filter dates client-side
    if (e?.code === "failed-precondition" || /index/i.test(String(e?.message))) {
      const qRef = query(collection(db, "EXPENSES"), where("user_id", "==", userPath));
      const snap = await getDocs(qRef);
      for (const d of snap.docs) {
        const data = d.data() as any;
        const dt = String(data.exp_date || "");
        if (dt >= startISO && dt < endISO) {
          const cat = (data.exp_category as string) || "Others";
          const amt = Number(data.exp_total) || 0;
          add(cat, amt);
        }
      }
    } else {
      console.error("🔥 getUserMonthlySpendByCategory:", e);
      throw e;
    }
  }

  // Ensure all categories exist
  const complete: Record<string, number> = {};
  getAllBudgetCategories().forEach((c) => (complete[c] = sums[c] ?? 0));
  return complete;
};


export const getBudgetProgress = async (
  monthKey: string = getCurrentMonthKey()
): Promise<BudgetProgress | null> => {
  const budget = await getUserBudget(monthKey);
  if (!budget) return null;

  const spentByCategory = await getUserMonthlySpendByCategory(monthKey);
  const byCategory: Record<string, CategoryProgress> = {};
  let totalSpent = 0;

  getAllBudgetCategories().forEach((cat) => {
    const allocated = Math.max(0, Number(budget.allocations[cat] ?? 0));
    const spent = Math.max(0, Number(spentByCategory[cat] ?? 0));
    totalSpent += spent;
    const ratio = allocated > 0 ? spent / allocated : spent > 0 ? Infinity : 0;
    byCategory[cat] = { allocated, spent, ratio };
  });

  const totalBudget = Math.max(0, Number(budget.totalBudget || 0));
  const remaining = Math.max(0, totalBudget - totalSpent);
  const utilizationPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0;

  return {
    monthKey,
    totalBudget,
    totalSpent: Math.round(totalSpent * 100) / 100,
    remaining: Math.round(remaining * 100) / 100,
    utilizationPct: Math.round(utilizationPct * 100) / 100,
    byCategory,
  };
};
