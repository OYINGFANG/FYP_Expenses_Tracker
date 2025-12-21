// app/utils/fetchUserExpenseRecords.ts
import { db } from "../../firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
  DocumentData,
  QuerySnapshot,
  Unsubscribe,
  orderBy,
  limit,
  Timestamp,
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCache, setCache, CACHE_KEYS } from "./dataOptimization";

export interface ExpenseRecord {
  id: string;
  amount: number;
  category: string;
  dateISO: string;
  description: string;
  paymentMethod?: string;
}

const normalizeUserPath = (uidOrPath: string) =>
  uidOrPath?.startsWith("/USERS/") ? uidOrPath : `/USERS/${uidOrPath}`;

/**
 * Convert exp_date to ISO string regardless of whether it's a string or Timestamp.
 */
const toISO = (maybeDate: any, fallback?: any) => {
  const v = maybeDate ?? fallback;
  if (!v) return "";
  // Firestore Timestamp has toDate()
  if (typeof v?.toDate === "function") {
    try {
      return v.toDate().toISOString();
    } catch {
      /* ignore */
    }
  }
  // already a string?
  if (typeof v === "string") return v;
  // Date object?
  if (v instanceof Date) return v.toISOString();
  return String(v);
};

/**
 * Map a Firestore doc -> UI record (defensive)
 */
const mapDoc = (doc: DocumentData): ExpenseRecord => {
  const d = doc.data?.() ?? doc; // support getDocs().docs[i] and onSnapshot
  return {
    id: doc.id ?? d.id ?? "",
    amount: typeof d.exp_total === "number" ? d.exp_total : Number(d.exp_total ?? 0),
    category: d.exp_category ?? "Uncategorized",
    dateISO: toISO(d.exp_date, d.created_at),
    description: d.exp_notes ?? "",
    paymentMethod: d.exp_payment_method ?? "",
  };
};

/**
 * One-off fetch with date range limit (optimized for big data)
 * Fetches only records from the last 24 months by default
 * FALLBACK: If indexes don't exist, uses simple query and filters in memory
 */
export const fetchUserExpenseOnce = async (
  monthsBack: number = 24
): Promise<ExpenseRecord[]> => {
  const raw = await AsyncStorage.getItem("userId");
  if (!raw) {
    console.warn("⚠️ No user ID found in AsyncStorage.");
    return [];
  }
  const userPath = normalizeUserPath(raw);
  
  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsBack);
  startDate.setHours(0, 0, 0, 0);
  const startISO = startDate.toISOString();
  const startTimestamp = Timestamp.fromDate(startDate);
  
  try {
    // Try optimized query first (with date range and orderBy)
    // IMPORTANT: When using range filter (>=), orderBy must match the filter direction
    const q = query(
      collection(db, "EXPENSES"),
      where("user_id", "==", userPath),
      where("exp_date", ">=", startTimestamp),
      orderBy("exp_date", "asc"), // Must be ASC to match >= filter
      limit(1000) // Safety limit - adjust based on your needs
    );
    
  const snap = await getDocs(q);
    let records = snap.docs.map(mapDoc);
    // Reverse to get descending order (newest first)
    records.reverse();
    return records;
  } catch (err: any) {
    // Fallback: if index doesn't exist, use simple query and filter in memory
    if (err?.code === "failed-precondition" || err?.message?.includes("index")) {
      console.warn("⚠️ Firestore index not found, using fallback query");
      console.warn("💡 Create Firestore indexes for optimal performance. See DEPLOYMENT_CHECKLIST.md");
      
      const fallbackQ = query(
        collection(db, "EXPENSES"),
        where("user_id", "==", userPath)
      );
      
      const snap = await getDocs(fallbackQ);
      let records = snap.docs.map(mapDoc);
      
      // Filter by date in memory
      records = records.filter((record) => {
        if (!record.dateISO) return false;
        return record.dateISO >= startISO;
      });
      
      // Sort by date (descending)
      records.sort((a, b) => (b.dateISO || "").localeCompare(a.dateISO || ""));
      
      return records;
    } else {
      // Re-throw other errors
      throw err;
    }
  }
};

/**
 * Realtime subscription with date range limit (optimized for big data)
 * Only subscribes to records from the last 24 months by default
 * Returns unsubscribe fn.
 * 
 * FALLBACK: If indexes don't exist, falls back to simple query and filters in memory
 */
export const subscribeUserExpenseRecords = async (
  onData: (rows: ExpenseRecord[]) => void,
  onError?: (e: any) => void,
  monthsBack: number = 24
): Promise<Unsubscribe> => {
  const raw = await AsyncStorage.getItem("userId");
  if (!raw) {
    console.warn("⚠️ No user ID found in AsyncStorage.");
    onData([]);
    return () => {};
  }
  const userPath = normalizeUserPath(raw);

  // Calculate date range for filtering
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - monthsBack);
  startDate.setHours(0, 0, 0, 0);
  const startISO = startDate.toISOString();

  console.log(`📅 Expense subscription: Fetching records from last ${monthsBack} months`);
  console.log(`📅 Date range: ${startISO} to ${endDate.toISOString()}`);

  // Calculate date range for filtering
  const startTimestamp = Timestamp.fromDate(startDate);
  
  // Try to test the optimized query first with getDocs to check if index exists
  // If it fails, use fallback immediately
  let currentUnsub: Unsubscribe | null = null;
  let cleanupFn: (() => void) | null = null;
  
  const testAndSetupQuery = async () => {
    // First, check if exp_date is stored as string or Timestamp
    const testAllQ = query(
      collection(db, "EXPENSES"),
      where("user_id", "==", userPath),
      limit(1)
    );
    const testAllSnap = await getDocs(testAllQ);
    
    let useStringComparison = false;
    if (testAllSnap.docs.length > 0) {
      const sampleData = testAllSnap.docs[0].data();
      // Check if exp_date is a string (not a Timestamp)
      useStringComparison = typeof sampleData.exp_date === "string";
      console.log(`🔍 exp_date field type: ${typeof sampleData.exp_date}, using string comparison: ${useStringComparison}`);
    }
    
    // If exp_date is stored as string, we can't use Timestamp in query
    // We'll need to use fallback and filter in memory
    if (useStringComparison) {
      console.log("ℹ️ exp_date is stored as string, using fallback query with in-memory filtering");
      
      // Fallback: simple query without date range
      const fallbackQ = query(
        collection(db, "EXPENSES"),
        where("user_id", "==", userPath)
      );

      currentUnsub = onSnapshot(
        fallbackQ,
    (snap: QuerySnapshot<DocumentData>) => {
          console.log(`✅ Fallback query returned ${snap.docs.length} documents`);
          let list = snap.docs.map(mapDoc);

          // Filter by date in memory (works with string dates)
          const beforeFilter = list.length;
          list = list.filter((record) => {
            if (!record.dateISO) {
              console.warn(`⚠️ Record ${record.id} has no dateISO`);
              return false;
            }
            return record.dateISO >= startISO;
          });
          console.log(`📅 Filtered from ${beforeFilter} to ${list.length} records (after ${startISO})`);
          
          // Sort by date (descending)
      list.sort((a, b) => (b.dateISO || "").localeCompare(a.dateISO || ""));
          console.log(`✅ Sending ${list.length} expense records to UI (fallback with string dates)`);
          onData(list);
        },
        (fallbackErr) => {
          console.error("🔥 Firestore fallback query error:", fallbackErr);
          onError?.(fallbackErr);
          onData([]);
        }
      );
      return;
    }
    
    // If exp_date is Timestamp, use optimized query
    const optimizedQ = query(
      collection(db, "EXPENSES"),
      where("user_id", "==", userPath),
      where("exp_date", ">=", startTimestamp),
      orderBy("exp_date", "asc")
    );
    
    try {
      // Test if the query works (this will fail immediately if index doesn't exist)
      const testSnap = await getDocs(optimizedQ);
      console.log("✅ Optimized query test passed, using optimized subscription");
      console.log(`🔍 Test query returned ${testSnap.docs.length} documents`);
      
      // Index exists, use optimized query
      currentUnsub = onSnapshot(
        optimizedQ,
        (snap: QuerySnapshot<DocumentData>) => {
          console.log(`✅ Optimized expense query returned ${snap.docs.length} documents`);
          const list = snap.docs.map(mapDoc);
          // Reverse to get descending order (newest first)
          list.reverse();
          console.log(`✅ Sending ${list.length} expense records to UI (optimized query)`);
      onData(list);
    },
        (err: any) => {
          console.error("🔥 Optimized query subscription error:", err);
      onError?.(err);
      onData([]);
    }
  );
    } catch (testErr: any) {
      // Index doesn't exist or query failed, use fallback
      if (testErr?.code === "failed-precondition" || testErr?.message?.includes("index")) {
        console.warn("⚠️ Firestore index not found for expenses, using fallback query");
        console.warn("💡 Create Firestore indexes for optimal performance. See DEPLOYMENT_CHECKLIST.md");
        console.log("🔍 Using fallback query (no date filter) for user:", userPath);
      } else {
        console.warn("⚠️ Query test failed, using fallback:", testErr?.message);
      }
      
      // Fallback: simple query without date range - SHOW ALL RECORDS
      const fallbackQ = query(
        collection(db, "EXPENSES"),
        where("user_id", "==", userPath)
      );
      
      currentUnsub = onSnapshot(
        fallbackQ,
        (snap: QuerySnapshot<DocumentData>) => {
          console.log(`✅ Fallback query returned ${snap.docs.length} documents`);
          let list = snap.docs.map(mapDoc);
          
          // Show sample dates for debugging
          if (list.length > 0) {
            const sample = list[0];
            console.log(`🔍 Sample expense record:`, {
              id: sample.id,
              dateISO: sample.dateISO,
              amount: sample.amount,
              category: sample.category,
            });
          }
          
          // TEMPORARILY: Don't filter by date - show ALL records to debug
          // Filter by date in memory
          const beforeFilter = list.length;
          const filteredList = list.filter((record) => {
            if (!record.dateISO) {
              console.warn(`⚠️ Record ${record.id} has no dateISO`);
              return false;
            }
            return record.dateISO >= startISO;
          });
          console.log(`📅 Filtered from ${beforeFilter} to ${filteredList.length} records (after ${startISO})`);
          
          // If filtering removed all records, show all records anyway for debugging
          if (filteredList.length === 0 && beforeFilter > 0) {
            console.warn(`⚠️ Date filter removed all records! Showing all ${beforeFilter} records for debugging.`);
            console.warn(`⚠️ Date filter start: ${startISO}`);
            console.warn(`⚠️ This means all your records are older than ${monthsBack} months.`);
            // Show all records instead of filtering
            list.sort((a, b) => (b.dateISO || "").localeCompare(a.dateISO || ""));
            console.log(`✅ Sending ALL ${list.length} expense records to UI (no date filter)`);
            onData(list);
          } else {
            // Sort by date (descending)
            filteredList.sort((a, b) => (b.dateISO || "").localeCompare(a.dateISO || ""));
            console.log(`✅ Sending ${filteredList.length} expense records to UI (fallback)`);
            onData(filteredList);
          }
        },
        (fallbackErr) => {
          console.error("🔥 Firestore fallback query error:", fallbackErr);
          onError?.(fallbackErr);
          onData([]);
        }
      );
    }
  };

  // Setup query (async but we return immediately)
  testAndSetupQuery().catch((err) => {
    console.error("🔥 Failed to setup expense subscription:", err);
    onError?.(err);
    onData([]);
  });
  
  // Return cleanup function
  return () => {
    if (currentUnsub) {
      currentUnsub();
    }
  };
};

/**
 * Fetch expenses for a specific month (optimized)
 * FALLBACK: If indexes don't exist, uses simple query and filters in memory
 */
export const fetchExpensesForMonth = async (
  monthKey: string
): Promise<ExpenseRecord[]> => {
  const raw = await AsyncStorage.getItem("userId");
  if (!raw) {
    console.warn("⚠️ No user ID found in AsyncStorage.");
    return [];
  }
  const userPath = normalizeUserPath(raw);
  
  // Parse month key (YYYY-MM)
  const [year, month] = monthKey.split("-").map(Number);
  const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(year, month, 1, 0, 0, 0, 0);
  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();
  
  const startTimestamp = Timestamp.fromDate(startDate);
  const endTimestamp = Timestamp.fromDate(endDate);
  
  // Check cache first
  const cacheKey = CACHE_KEYS.CATEGORY_TOTALS(raw, monthKey);
  const cached = await getCache<ExpenseRecord[]>(cacheKey);
  if (cached) {
    return cached;
  }
  
  try {
    // Try optimized query first (with date range)
    // IMPORTANT: When using range filters (>= and <), orderBy must match the first range filter direction
    const q = query(
      collection(db, "EXPENSES"),
      where("user_id", "==", userPath),
      where("exp_date", ">=", startTimestamp),
      where("exp_date", "<", endTimestamp),
      orderBy("exp_date", "asc") // Must be ASC to match >= filter
    );
    
    const snap = await getDocs(q);
    let records = snap.docs.map(mapDoc);
    // Reverse to get descending order (newest first)
    records.reverse();
    
    // Cache for 5 minutes
    await setCache(cacheKey, records, 5 * 60 * 1000);
    
    return records;
  } catch (err: any) {
    // Fallback: if index doesn't exist, use simple query and filter in memory
    if (err?.code === "failed-precondition" || err?.message?.includes("index")) {
      console.warn("⚠️ Firestore index not found, using fallback query for month:", monthKey);
      console.warn("💡 Create Firestore indexes for optimal performance. See DEPLOYMENT_CHECKLIST.md");
      
      const fallbackQ = query(
        collection(db, "EXPENSES"),
        where("user_id", "==", userPath)
      );
      
      const snap = await getDocs(fallbackQ);
      let records = snap.docs.map(mapDoc);
      
      // Filter by date range in memory
      records = records.filter((record) => {
        if (!record.dateISO) return false;
        return record.dateISO >= startISO && record.dateISO < endISO;
      });
      
      // Sort by date (descending)
      records.sort((a, b) => (b.dateISO || "").localeCompare(a.dateISO || ""));
      
      // Cache for 5 minutes
      await setCache(cacheKey, records, 5 * 60 * 1000);
      
      return records;
    } else {
      // Re-throw other errors
      throw err;
    }
  }
};
