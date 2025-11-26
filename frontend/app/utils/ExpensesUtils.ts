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
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
 * One-off fetch (useful for debugging connectivity/index/rules)
 */
export const fetchUserExpenseOnce = async (): Promise<ExpenseRecord[]> => {
  const raw = await AsyncStorage.getItem("userId");
  if (!raw) {
    console.warn("⚠️ No user ID found in AsyncStorage.");
    return [];
  }
  const userPath = normalizeUserPath(raw);
  const q = query(collection(db, "EXPENSES"), where("user_id", "==", userPath));
  const snap = await getDocs(q);
  return snap.docs.map(mapDoc);
};

/**
 * Realtime subscription (preferred). Returns unsubscribe fn.
 */
export const subscribeUserExpenseRecords = async (
  onData: (rows: ExpenseRecord[]) => void,
  onError?: (e: any) => void
): Promise<Unsubscribe> => {
  const raw = await AsyncStorage.getItem("userId");
  if (!raw) {
    console.warn("⚠️ No user ID found in AsyncStorage.");
    onData([]);
    return () => {};
  }
  const userPath = normalizeUserPath(raw);

  // Keep it simple first: no orderBy (avoids index requirement).
  const q = query(collection(db, "EXPENSES"), where("user_id", "==", userPath));

  const unsub = onSnapshot(
    q,
    (snap: QuerySnapshot<DocumentData>) => {
      const list = snap.docs.map(mapDoc);

      // If you want newest first without orderBy, sort in JS:
      list.sort((a, b) => (b.dateISO || "").localeCompare(a.dateISO || ""));

      onData(list);
    },
    (err) => {
      console.error("🔥 Firestore subscription error:", err);
      onError?.(err);
      onData([]);
    }
  );
  return unsub;
};
