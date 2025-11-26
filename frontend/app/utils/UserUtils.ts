// app/utils/userSummary.ts (or wherever your utils live)
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../firebase";

export type UserSummary = {
  username: string;
  income: number;
  expense: number;
  totalBalance: number;
};

// Normalize the AsyncStorage value, which is stored as "/USERS/<uid>"
function getUidAndPath(userIdFromStorage: string | null): { uid: string | null; userPath: string | null } {
  if (!userIdFromStorage) return { uid: null, userPath: null };
  // If it already looks like "/USERS/<uid>", extract uid; otherwise treat as uid and build path.
  const parts = userIdFromStorage.split("/");
  const looksLikePath = parts.length >= 3 && parts[1] === "USERS";
  const uid = looksLikePath ? parts[2] : userIdFromStorage;
  const userPath = `/USERS/${uid}`;
  return { uid, userPath };
}

export const getUsernameFromFirestore = async (): Promise<UserSummary | null> => {
  try {
    const stored = await AsyncStorage.getItem("userId");
    const { uid, userPath } = getUidAndPath(stored);

    if (!uid || !userPath) {
      console.warn("⚠️ No valid user identity found in AsyncStorage");
      return null;
    }

    // 1) Fetch username from USERS/<uid>
    const userRef = doc(db, "USERS", uid);
    const userSnap = await getDoc(userRef);
    let username = "Guest";
    if (userSnap.exists()) {
      const userData = userSnap.data() as any;
      username = userData.username || userData.displayName || "Guest";
    }

    // 2) Sum INCOME.inc_total for this user
    const incomeQuery = query(collection(db, "INCOME"), where("user_id", "==", userPath));
    const incomeSnap = await getDocs(incomeQuery);
    let totalIncome = 0;
    incomeSnap.forEach((d) => {
      const v = (d.data() as any).inc_total;
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isNaN(n)) totalIncome += n;
    });

    // 3) Sum EXPENSES.exp_total for this user
    const expenseQuery = query(collection(db, "EXPENSES"), where("user_id", "==", userPath));
    const expenseSnap = await getDocs(expenseQuery);
    let totalExpense = 0;
    expenseSnap.forEach((d) => {
      const v = (d.data() as any).exp_total;
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isNaN(n)) totalExpense += n;
    });

    // 4) Balance
    const totalBalance = totalIncome - totalExpense;

    return { username, income: totalIncome, expense: totalExpense, totalBalance };
  } catch (error) {
    console.error("🔥 Error fetching user summary:", error);
    return null;
  }
};
