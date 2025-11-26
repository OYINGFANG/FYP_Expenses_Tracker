// app/utils/debtStore.ts
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebase";

export type DebtType =
  | "Credit Card"
  | "Personal Loan"
  | "Mortgage"
  | "Car Loan"
  | "Student Loan"
  | "Medical"
  | "Other";

export type Payment = {
  id: string;
  amount: number;
  dateISO: string;
  note?: string;
};

export type Debt = {
  id: string;
  name: string;
  type: DebtType;
  originalAmount: number;
  currentBalance: number;
  monthlyPayment: number;
  targetDate?: string | null;
  payments: Payment[];
  createdAt: string; // ISO
};

const userPath = (userId: string) => `/USERS/${userId}`;

/** Subscribe to debts for a user and hydrate last 20 payments per debt.
 *  IMPORTANT: no orderBy on DEBTS to avoid composite index requirement.
 */
export function subscribeUserDebts(
  userId: string,
  onData: (debts: Debt[]) => void,
  onError?: (e: any) => void
) {
  const debtsRef = collection(db, "DEBTS");
  // ✅ No orderBy("created_at") here, so no composite index needed.
  const q = query(debtsRef, where("user_id", "==", userPath(userId)));

  const unsub = onSnapshot(
    q,
    async (snap) => {
      const debts = await Promise.all(
        snap.docs.map(async (d) => {
          const x = d.data() as any;

          const payQ = query(
            collection(d.ref, "PAYMENTS"),
            orderBy("date_iso", "desc"), // single-field index (auto-managed by Firestore)
            limit(20)
          );
          const paySnap = await getDocs(payQ);
          const payments: Payment[] = paySnap.docs.map((p) => {
            const pd = p.data() as any;
            return {
              id: p.id,
              amount: Number(pd.amount) || 0,
              dateISO: String(pd.date_iso || new Date().toISOString()),
              note: pd.note ?? undefined,
            };
          });

          const createdAtISO =
            typeof x.created_at?.toDate === "function"
              ? x.created_at.toDate().toISOString()
              : new Date().toISOString();

          const debt: Debt = {
            id: d.id,
            name: x.name || "",
            type: (x.type || "Other") as DebtType,
            originalAmount: Number(x.original_amount) || 0,
            currentBalance: Number(x.current_balance) || 0,
            monthlyPayment: Number(x.monthly_payment) || 0,
            targetDate: x.target_date || null,
            payments,
            createdAt: createdAtISO,
          };
          return debt;
        })
      );

      // Client-side priority: highest balance first
      onData(debts.sort((a, b) => b.currentBalance - a.currentBalance));
    },
    (e) => onError?.(e)
  );

  return unsub;
}

/** Create or update a debt. If d.id exists, upsert that doc id; else auto-id. */
export async function upsertDebt(userId: string, d: Partial<Debt>) {
  const base = {
    user_id: userPath(userId),
    name: d.name ?? "",
    type: d.type ?? "Other",
    original_amount: Number(d.originalAmount) || 0,
    current_balance: Number(d.currentBalance) || 0,
    monthly_payment: Number(d.monthlyPayment) || 0,
    target_date: d.targetDate ?? null,
    updated_at: serverTimestamp(),
  };

  if (d.id) {
    const ref = doc(db, "DEBTS", d.id);
    await setDoc(
      ref,
      {
        ...base,
        created_at: d.createdAt ? new Date(d.createdAt) : serverTimestamp(),
      },
      { merge: true }
    );
    return d.id;
  } else {
    const ref = await addDoc(collection(db, "DEBTS"), {
      ...base,
      created_at: serverTimestamp(),
    });
    return ref.id;
  }
}

/** Add a payment and atomically reduce the debt balance. */
export async function addDebtPayment(
  userId: string,
  debtId: string,
  p: { amount: number; dateISO: string; note?: string }
) {
  const debtRef = doc(db, "DEBTS", debtId);
  const paysCol = collection(debtRef, "PAYMENTS");

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(debtRef);
    if (!snap.exists()) throw new Error("Debt not found");

    const data = snap.data() as any;
    const current = Number(data.current_balance) || 0;
    const nextBalance = Math.max(0, current - (Number(p.amount) || 0));

    const payRef = doc(paysCol); // allocate id inside tx
    tx.set(payRef, {
      user_id: userPath(userId),
      amount: Number(p.amount) || 0,
      date_iso: p.dateISO,
      note: p.note || null,
      created_at: serverTimestamp(),
    });

    tx.set(
      debtRef,
      {
        current_balance: nextBalance,
        updated_at: serverTimestamp(),
      },
      { merge: true }
    );
  });
}

/** Delete a debt and all its payments. */
export async function deleteDebtDeep(debtId: string) {
  const debtRef = doc(db, "DEBTS", debtId);
  const paysCol = collection(debtRef, "PAYMENTS");
  const pays = await getDocs(paysCol);
  const batch = writeBatch(db);
  pays.forEach((p) => batch.delete(p.ref));
  batch.delete(debtRef);
  await batch.commit();
}
