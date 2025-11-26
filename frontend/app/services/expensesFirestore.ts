// app/services/expensesFirestore.ts
import { db } from "../../firebase";
import {
  collection, addDoc, getDocs, query, where, deleteDoc, doc,
} from "firebase/firestore";
import type { Expense } from "./types";

const EXPENSES_COL = "expenses";

export async function getExpensesByUser(userId: string): Promise<Expense[]> {
  const q = query(collection(db, EXPENSES_COL), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Expense) }));
}

export async function addExpense(exp: Expense): Promise<string> {
  const ref = await addDoc(collection(db, EXPENSES_COL), exp);
  return ref.id;
}

export async function clearExpensesForUser(userId: string): Promise<void> {
  const q = query(collection(db, EXPENSES_COL), where("userId", "==", userId));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => deleteDoc(doc(db, EXPENSES_COL, d.id))));
}
