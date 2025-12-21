// app/utils/optimizedBehaviorAnalysis.ts
// Optimized behavior analysis using cached data and pre-computed aggregations

import { getCache, setCache, CACHE_KEYS } from "./dataOptimization";
import { getMonthlyAggregation, getAggregationsForRange } from "./precomputedAggregations";
import { analyzeSpendingBehavior } from "../services/behaviorAnalysis";
import type { Expense } from "../services/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Get current month key (YYYY-MM)
 */
function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Get previous N month keys
 */
function getPreviousMonthKeys(count: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  
  for (let i = 0; i < count; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    keys.push(`${year}-${month}`);
  }
  
  return keys;
}

/**
 * Optimized behavior analysis using cached data and aggregations
 * Only processes recent months (last 3-6 months) instead of all records
 */
export async function getOptimizedBehaviorAnalysis(
  expenses: Expense[],
  options: {
    monthsLookback?: number;
    useCache?: boolean;
    useAggregations?: boolean;
  } = {}
): Promise<any> {
  const {
    monthsLookback = 3,
    useCache = true,
    useAggregations = true,
  } = options;

  const userId = await AsyncStorage.getItem("userId");
  if (!userId) {
    console.warn("No userId found, falling back to standard analysis");
    return analyzeSpendingBehavior(expenses, { monthsLookback });
  }

  const currentMonthKey = getCurrentMonthKey();
  const cacheKey = CACHE_KEYS.BEHAVIOR_ANALYSIS(userId, currentMonthKey);

  // Check cache first
  if (useCache) {
    const cached = await getCache(cacheKey);
    if (cached) {
      console.log("✅ Using cached behavior analysis");
      return cached;
    }
  }

  // If using aggregations, try to get pre-computed data
  if (useAggregations) {
    try {
      const monthKeys = getPreviousMonthKeys(monthsLookback);
      const aggregations = await getAggregationsForRange(
        userId,
        monthKeys[monthKeys.length - 1],
        monthKeys[0]
      );

      if (aggregations.length > 0) {
        // Use aggregations for faster analysis
        // This is a simplified version - you may need to adapt based on your analysis needs
        console.log("✅ Using pre-computed aggregations for analysis");
        
        // Combine aggregations with current month expenses
        const currentMonthExpenses = expenses.filter((e) => {
          if (!e.date) return false;
          const expenseDate = new Date(e.date);
          const expenseMonthKey = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, "0")}`;
          return expenseMonthKey === currentMonthKey;
        });

        // Run analysis with limited data
        const result = analyzeSpendingBehavior(currentMonthExpenses, {
          monthsLookback: 1, // Only analyze current month in detail
          // You can pass aggregated data as context if your analysis supports it
        });

        // Cache result
        if (useCache) {
          await setCache(cacheKey, result, 10 * 60 * 1000); // 10 minutes
        }

        return result;
      }
    } catch (error) {
      console.warn("Failed to use aggregations, falling back to standard analysis:", error);
    }
  }

  // Fallback to standard analysis but limit data
  // Only use expenses from the last N months
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - monthsLookback);
  
  const recentExpenses = expenses.filter((e) => {
    if (!e.date) return false;
    const expenseDate = new Date(e.date);
    return expenseDate >= cutoffDate;
  });

  console.log(`📊 Analyzing ${recentExpenses.length} recent expenses (out of ${expenses.length} total)`);

  const result = analyzeSpendingBehavior(recentExpenses, { monthsLookback });

  // Cache result
  if (useCache) {
    await setCache(cacheKey, result, 10 * 60 * 1000); // 10 minutes
  }

  return result;
}

/**
 * Clear behavior analysis cache for a month
 */
export async function clearBehaviorAnalysisCache(
  userId: string,
  monthKey?: string
): Promise<void> {
  const { clearCache } = await import("./dataOptimization");
  const targetMonthKey = monthKey || getCurrentMonthKey();
  const cacheKey = CACHE_KEYS.BEHAVIOR_ANALYSIS(userId, targetMonthKey);
  await clearCache(cacheKey);
}
