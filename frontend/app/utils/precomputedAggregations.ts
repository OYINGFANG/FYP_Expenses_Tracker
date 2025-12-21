// app/utils/precomputedAggregations.ts
// Pre-computed monthly aggregations stored in Firestore for fast access

import { db } from "../../firebase";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AGGREGATIONS_COLLECTION = "MONTHLY_AGGREGATIONS";

export interface MonthlyAggregation {
  userId: string;
  monthKey: string; // YYYY-MM
  totalExpenses: number;
  totalIncome: number;
  expenseCount: number;
  incomeCount: number;
  byCategory: Record<string, number>;
  lastUpdated: string;
  createdAt: string;
}

/**
 * Normalize user path
 */
function normalizeUserPath(uidOrPath: string): string {
  return uidOrPath?.startsWith("/USERS/") ? uidOrPath : `/USERS/${uidOrPath}`;
}

/**
 * Get aggregation document ID
 */
function getAggregationDocId(userId: string, monthKey: string): string {
  const userPath = normalizeUserPath(userId);
  const cleanPath = userPath.replace(/\//g, "_");
  return `${cleanPath}_${monthKey}`;
}

/**
 * Compute and store monthly aggregation
 * This should be called when records are added/updated
 */
export async function computeAndStoreMonthlyAggregation(
  userId: string,
  monthKey: string,
  expenses: Array<{ amount: number; category: string }>,
  incomes: Array<{ amount: number; category: string }>
): Promise<void> {
  try {
    const userPath = normalizeUserPath(userId);
    
    // Calculate totals
    const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const totalIncome = incomes.reduce((sum, i) => sum + (i.amount || 0), 0);
    
    // Calculate by category
    const byCategory: Record<string, number> = {};
    expenses.forEach((exp) => {
      const cat = exp.category || "Uncategorized";
      byCategory[cat] = (byCategory[cat] || 0) + (exp.amount || 0);
    });
    
    const aggregation: MonthlyAggregation = {
      userId: userPath,
      monthKey,
      totalExpenses,
      totalIncome,
      expenseCount: expenses.length,
      incomeCount: incomes.length,
      byCategory,
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    
    const docId = getAggregationDocId(userId, monthKey);
    const docRef = doc(db, AGGREGATIONS_COLLECTION, docId);
    
    // Use merge to update existing or create new
    await setDoc(docRef, aggregation, { merge: true });
    
    console.log(`✅ Stored aggregation for ${monthKey}`);
  } catch (error) {
    console.error("❌ Error storing monthly aggregation:", error);
  }
}

/**
 * Get pre-computed monthly aggregation
 */
export async function getMonthlyAggregation(
  userId: string,
  monthKey: string
): Promise<MonthlyAggregation | null> {
  try {
    const docId = getAggregationDocId(userId, monthKey);
    const docRef = doc(db, AGGREGATIONS_COLLECTION, docId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as MonthlyAggregation;
    }
    
    return null;
  } catch (error) {
    console.error("❌ Error getting monthly aggregation:", error);
    return null;
  }
}

/**
 * Get aggregations for multiple months
 */
export async function getMonthlyAggregations(
  userId: string,
  monthKeys: string[]
): Promise<MonthlyAggregation[]> {
  try {
    const userPath = normalizeUserPath(userId);
    const aggregations: MonthlyAggregation[] = [];
    
    // Fetch in parallel
    const promises = monthKeys.map((monthKey) =>
      getMonthlyAggregation(userId, monthKey)
    );
    
    const results = await Promise.all(promises);
    
    results.forEach((agg) => {
      if (agg) aggregations.push(agg);
    });
    
    return aggregations;
  } catch (error) {
    console.error("❌ Error getting monthly aggregations:", error);
    return [];
  }
}

/**
 * Get aggregations for a date range
 */
export async function getAggregationsForRange(
  userId: string,
  startMonthKey: string,
  endMonthKey: string
): Promise<MonthlyAggregation[]> {
  try {
    const userPath = normalizeUserPath(userId);
    
    // Generate month keys in range
    const monthKeys: string[] = [];
    const [startYear, startMonth] = startMonthKey.split("-").map(Number);
    const [endYear, endMonth] = endMonthKey.split("-").map(Number);
    
    let currentYear = startYear;
    let currentMonth = startMonth;
    
    while (
      currentYear < endYear ||
      (currentYear === endYear && currentMonth <= endMonth)
    ) {
      monthKeys.push(
        `${currentYear}-${String(currentMonth).padStart(2, "0")}`
      );
      
      currentMonth++;
      if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
      }
    }
    
    return await getMonthlyAggregations(userId, monthKeys);
  } catch (error) {
    console.error("❌ Error getting aggregations for range:", error);
    return [];
  }
}

/**
 * Trigger aggregation recomputation for a month
 * Call this after adding/updating/deleting records
 */
export async function triggerAggregationUpdate(
  userId: string,
  monthKey: string
): Promise<void> {
  // This would typically be called from a Cloud Function or backend
  // For now, we'll mark it as needing update
  try {
    const docId = getAggregationDocId(userId, monthKey);
    const docRef = doc(db, AGGREGATIONS_COLLECTION, docId);
    
    await setDoc(
      docRef,
      {
        needsUpdate: true,
        lastUpdateRequested: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("❌ Error triggering aggregation update:", error);
  }
}
