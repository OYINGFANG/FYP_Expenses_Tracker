
import { db } from "../../firebase"; // <-- adjust this path if your firebase file isn't exactly here
import {
  collection,
  onSnapshot,
  query,
  where,
  getDocs,
  DocumentData,
  QuerySnapshot,
  Unsubscribe,
  // orderBy,  // We'll add this back later if needed
} from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

export interface IncomeRecord {
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
 * Convert inc_date to ISO string regardless of whether it's a string or Timestamp.
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
const mapDoc = (doc: DocumentData): IncomeRecord => {
  const d = doc.data?.() ?? doc; // support getDocs().docs[i] and onSnapshot
  return {
    id: doc.id ?? d.id ?? "",
    amount: typeof d.inc_total === "number" ? d.inc_total : Number(d.inc_total ?? 0),
    category: d.inc_category ?? "Uncategorized",
    dateISO: toISO(d.inc_date, d.created_at),
    description: d.inc_notes ?? "",
    paymentMethod: d.inc_payment_method ?? "",
  };
};

/**
 * One-off fetch (useful for debugging connectivity/index/rules)
 */
export const fetchUserIncomeOnce = async (): Promise<IncomeRecord[]> => {
  const raw = await AsyncStorage.getItem("userId");
  if (!raw) {
    console.warn("⚠️ No user ID found in AsyncStorage.");
    return [];
  }
  const userPath = normalizeUserPath(raw);
  const q = query(collection(db, "INCOME"), where("user_id", "==", userPath));
  const snap = await getDocs(q);
  return snap.docs.map(mapDoc);
};

/**
 * Realtime subscription (preferred). Returns unsubscribe fn.
 */
export const subscribeUserIncomeRecords = async (
  onData: (rows: IncomeRecord[]) => void,
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
  const q = query(collection(db, "INCOME"), where("user_id", "==", userPath));

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

/**
 * Optional: re-enable server-side ordering (requires index if you add more filters later)
 *  - Replace the q above with:
 *    const q = query(
 *      collection(db, "INCOME"),
 *      where("user_id", "==", userPath),
 *      orderBy("inc_date", "desc")
 *    );
 *  - If Firestore complains with a 'FAILED_PRECONDITION' link, click it to create the index once.
 */
