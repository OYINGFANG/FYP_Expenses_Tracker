// app/utils/dataOptimization.ts
// Big Data Handling Utilities for Scalability

import { db } from "../../firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  Query,
  QueryDocumentSnapshot,
  Timestamp,
  DocumentData,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ======================================================
// PAGINATION UTILITIES
// ======================================================

export interface PaginationOptions {
  pageSize?: number;
  startAfterDoc?: QueryDocumentSnapshot<DocumentData>;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
}

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
  totalFetched: number;
}

/**
 * Fetch expenses with pagination and optional date range
 */
export async function fetchExpensesPaginated(
  userId: string,
  options: PaginationOptions = {}
): Promise<PaginatedResult<any>> {
  const {
    pageSize = 50,
    startAfterDoc,
    dateRange,
  } = options;

  const userPath = userId.startsWith("/USERS/") ? userId : `/USERS/${userId}`;
  
  let q: Query<DocumentData> = query(
    collection(db, "EXPENSES"),
    where("user_id", "==", userPath),
    orderBy("exp_date", "desc")
  );

  // Add date range filter if provided
  if (dateRange) {
    const startTimestamp = Timestamp.fromDate(dateRange.startDate);
    const endTimestamp = Timestamp.fromDate(dateRange.endDate);
    q = query(
      collection(db, "EXPENSES"),
      where("user_id", "==", userPath),
      where("exp_date", ">=", startTimestamp),
      where("exp_date", "<=", endTimestamp),
      orderBy("exp_date", "desc"),
      limit(pageSize)
    );
  } else {
    q = query(q, limit(pageSize));
  }

  // Add pagination cursor
  if (startAfterDoc) {
    q = query(q, startAfter(startAfterDoc));
  }

  const snap = await getDocs(q);
  const docs = snap.docs;
  const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;
  const hasMore = docs.length === pageSize;

  const data = docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      amount: Number(d.exp_total) || 0,
      category: d.exp_category || "Uncategorized",
      dateISO: toISO(d.exp_date || d.created_at),
      description: d.exp_notes || "",
      paymentMethod: d.exp_payment_method || "",
    };
  });

  return {
    data,
    lastDoc,
    hasMore,
    totalFetched: data.length,
  };
}

/**
 * Fetch income records with pagination and optional date range
 */
export async function fetchIncomePaginated(
  userId: string,
  options: PaginationOptions = {}
): Promise<PaginatedResult<any>> {
  const {
    pageSize = 50,
    startAfterDoc,
    dateRange,
  } = options;

  const userPath = userId.startsWith("/USERS/") ? userId : `/USERS/${userId}`;
  
  let q: Query<DocumentData> = query(
    collection(db, "INCOME"),
    where("user_id", "==", userPath),
    orderBy("inc_date", "desc")
  );

  if (dateRange) {
    const startTimestamp = Timestamp.fromDate(dateRange.startDate);
    const endTimestamp = Timestamp.fromDate(dateRange.endDate);
    q = query(
      collection(db, "INCOME"),
      where("user_id", "==", userPath),
      where("inc_date", ">=", startTimestamp),
      where("inc_date", "<=", endTimestamp),
      orderBy("inc_date", "desc"),
      limit(pageSize)
    );
  } else {
    q = query(q, limit(pageSize));
  }

  if (startAfterDoc) {
    q = query(q, startAfter(startAfterDoc));
  }

  const snap = await getDocs(q);
  const docs = snap.docs;
  const lastDoc = docs.length > 0 ? docs[docs.length - 1] : null;
  const hasMore = docs.length === pageSize;

  const data = docs.map((doc) => {
    const d = doc.data();
    return {
      id: doc.id,
      amount: Number(d.inc_total) || 0,
      category: d.inc_category || "Uncategorized",
      dateISO: toISO(d.inc_date || d.created_at),
      description: d.inc_notes || "",
      paymentMethod: d.inc_payment_method || "",
    };
  });

  return {
    data,
    lastDoc,
    hasMore,
    totalFetched: data.length,
  };
}

/**
 * Get date range for a specific month
 */
export function getMonthDateRange(monthKey: string): { startDate: Date; endDate: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 1, 0, 0, 0, 0);
  return { startDate, endDate };
}

/**
 * Get date range for last N months
 */
export function getLastNMonthsDateRange(months: number = 12): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);
  return { startDate, endDate };
}

// ======================================================
// CACHING UTILITIES
// ======================================================

const CACHE_PREFIX = "auri_cache_";
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

/**
 * Cache data with expiration
 */
export async function setCache<T>(key: string, data: T, ttlMs: number = CACHE_EXPIRY_MS): Promise<void> {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
    expiry: Date.now() + ttlMs,
  };
  try {
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
  } catch (error) {
    console.warn("Failed to set cache:", error);
  }
}

/**
 * Get cached data if not expired
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const cached = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!cached) return null;

    const entry: CacheEntry<T> = JSON.parse(cached);
    
    // Check if expired
    if (Date.now() > entry.expiry) {
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
      return null;
    }

    return entry.data;
  } catch (error) {
    console.warn("Failed to get cache:", error);
    return null;
  }
}

/**
 * Clear cache for a specific key
 */
export async function clearCache(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch (error) {
    console.warn("Failed to clear cache:", error);
  }
}

/**
 * Clear all cache
 */
export async function clearAllCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
    await AsyncStorage.multiRemove(cacheKeys);
  } catch (error) {
    console.warn("Failed to clear all cache:", error);
  }
}

// Cache keys
export const CACHE_KEYS = {
  INSIGHTS: (userId: string, monthKey: string) => `insights_${userId}_${monthKey}`,
  BEHAVIOR_ANALYSIS: (userId: string, monthKey: string) => `behavior_${userId}_${monthKey}`,
  MONTHLY_SNAPSHOT: (userId: string, monthKey: string) => `snapshot_${userId}_${monthKey}`,
  CATEGORY_TOTALS: (userId: string, monthKey: string) => `categories_${userId}_${monthKey}`,
};

// ======================================================
// DATA AGGREGATION HELPERS
// ======================================================

/**
 * Calculate totals for a date range without loading all records
 * Uses pagination to process in chunks
 */
export async function calculateTotalsForRange(
  userId: string,
  startDate: Date,
  endDate: Date,
  type: "expenses" | "income" = "expenses"
): Promise<{ total: number; count: number; byCategory: Record<string, number> }> {
  let total = 0;
  let count = 0;
  const byCategory: Record<string, number> = {};
  let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
  const pageSize = 100;

  while (true) {
    const result = type === "expenses"
      ? await fetchExpensesPaginated(userId, {
          pageSize,
          startAfterDoc: lastDoc || undefined,
          dateRange: { startDate, endDate },
        })
      : await fetchIncomePaginated(userId, {
          pageSize,
          startAfterDoc: lastDoc || undefined,
          dateRange: { startDate, endDate },
        });

    // Process batch
    result.data.forEach((record) => {
      total += record.amount;
      count++;
      const category = record.category || "Uncategorized";
      byCategory[category] = (byCategory[category] || 0) + record.amount;
    });

    if (!result.hasMore) break;
    lastDoc = result.lastDoc;
  }

  return { total, count, byCategory };
}

// ======================================================
// HELPER FUNCTIONS
// ======================================================

function toISO(maybeDate: any): string {
  if (!maybeDate) return "";
  if (maybeDate.toDate && typeof maybeDate.toDate === "function") {
    return maybeDate.toDate().toISOString();
  }
  if (typeof maybeDate === "string") return maybeDate;
  if (maybeDate instanceof Date) return maybeDate.toISOString();
  return String(maybeDate);
}
