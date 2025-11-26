// server.js
require("dotenv").config();
console.log("Loaded RAPID_API_KEY:", process.env.RAPID_API_KEY ? "✅ Found" : "❌ Missing");
console.log("Loaded OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "✅ Found" : "❌ Missing");

const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const OpenAI = require("openai");
const admin = require("firebase-admin");

const app = express();
const upload = multer({ dest: "uploads/" });

app.use(cors()); // allow cross-origin requests (important for React Native)
app.use(express.json());

// Initialize Firebase Admin (optional - only if service account is provided)
let db = null;
try {
  const serviceAccount = require("./auri-76581-firebase-adminsdk-fbsvc-1122c9b7d7.json"); // 👈 path to your JSON

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  db = admin.firestore();
  console.log("✅ Firebase Admin initialized with service account");
} catch (error) {
  console.warn("⚠️ Firebase Admin initialization failed:", error.message);
  console.warn("⚠️ Backend will not talk directly to Firestore. Frontend should send snapshots.");
}

// Initialize OpenAI
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

// =============== ENVIRONMENT VARIABLES ===============
const RAPID_API_KEY = process.env.RAPID_API_KEY;
const ASSEMBLYAI_KEY = process.env.ASSEMBLYAI_KEY;
const BASE_URL = "https://api.assemblyai.com/v2";
const isDevEnv = process.env.NODE_ENV !== "production";

// ⚠ SECURITY WARNING:
// We currently trust `userId` coming from the client (query/body) for Firestore reads.
// This is NOT safe for production.
// Before going live, replace this with Firebase Auth middleware that:
// - validates a Firebase ID token from headers,
// - decodes it,
// - sets req.userUid = decoded.uid,
// - and uses that uid inside buildMonthlySnapshotFromFirestore instead of trusting client-provided userId.

if (!RAPID_API_KEY) {
  console.error("❌ Missing RAPID_API_KEY in .env file");
}
if (!ASSEMBLYAI_KEY) {
  console.warn("⚠️ Missing ASSEMBLYAI_KEY (transcription may not work)");
}

// ======================================================
// 🗣️ AssemblyAI transcription routes
// ======================================================
async function uploadToAssemblyAI(filePath) {
  const data = fs.readFileSync(filePath);
  const response = await axios.post(`${BASE_URL}/upload`, data, {
    headers: {
      authorization: ASSEMBLYAI_KEY,
      "content-type": "application/octet-stream",
    },
  });
  return response.data.upload_url;
}

app.post("/transcribe", upload.single("file"), async (req, res) => {
  try {
    const uploadUrl = await uploadToAssemblyAI(req.file.path);
    const transcriptRes = await axios.post(
      `${BASE_URL}/transcript`,
      { audio_url: uploadUrl },
      {
        headers: { authorization: ASSEMBLYAI_KEY, "content-type": "application/json" },
      }
    );

    const transcriptId = transcriptRes.data.id;
    let text;

    while (true) {
      const pollingRes = await axios.get(`${BASE_URL}/transcript/${transcriptId}`, {
        headers: { authorization: ASSEMBLYAI_KEY },
      });

      if (pollingRes.data.status === "completed") {
        text = pollingRes.data.text;
        break;
      } else if (pollingRes.data.status === "error") {
        throw new Error(pollingRes.data.error);
      }

      await new Promise((r) => setTimeout(r, 3000));
    }

    res.json({ text });
  } catch (err) {
    console.error("❌ Backend error (transcribe):", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// ======================================================
// 📊 Monthly Snapshot Builder (Backend)
// ======================================================
function getCurrentMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return `${y}-${String(m).padStart(2, "0")}`;
}

function getMonthDateRange(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 1, 0, 0, 0, 0);
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

function getPreviousMonthKey(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevY = prevDate.getFullYear();
  const prevM = prevDate.getMonth() + 1;
  return `${prevY}-${String(prevM).padStart(2, "0")}`;
}

function normalizeUserPath(userId) {
  return userId?.startsWith("/USERS/") ? userId : `/USERS/${userId}`;
}

function toISO(maybeDate) {
  if (!maybeDate) return "";
  if (maybeDate.toDate && typeof maybeDate.toDate === "function") {
    return maybeDate.toDate().toISOString();
  }
  if (typeof maybeDate === "string") return maybeDate;
  if (maybeDate instanceof Date) return maybeDate.toISOString();
  return String(maybeDate);
}

const SAVINGS_CATEGORY_NAMES = ["Savings", "Saving", "Emergency Fund", "Emergency", "Investments", "Investment"];
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const round4 = (n) => Math.round((Number(n) || 0) * 10000) / 10000;
const TINY_TOTAL_THRESHOLD = 50;

const toNumberRecord = (record = {}) => {
  const output = {};
  Object.entries(record || {}).forEach(([key, value]) => {
    const num = Number(value);
    output[key] = Number.isFinite(num) ? num : 0;
  });
  return output;
};

// Savings cash flow source of truth:
// - We use SAVINGS_GOALS/{goalId}/CONTRIBUTIONS as the ONLY source for savingsContrib.
// - EXPENSES with category "Savings" are ignored for savings calculations to avoid double counting.
// - Over time, we should stop writing "Savings" EXPENSE rows altogether.
async function buildMonthlySnapshotFromFirestore(userId, monthKey = getCurrentMonthKey()) {
  if (!db) {
    // When Firestore isn't configured on the backend, just return null so callers can handle it.
    console.warn("⚠️ buildMonthlySnapshotFromFirestore called without Firestore. Returning null.");
    return null;
  }

  console.log(`📊 Building snapshot for userId: ${userId}, monthKey: ${monthKey}`);

  const userPath = normalizeUserPath(userId);
  // TODO: replace this userId from request with a verified uid from auth middleware.
  // Right now we trust userId from the client, which is NOT safe for production.
  const { startISO, endISO } = getMonthDateRange(monthKey);
  const startDateObj = new Date(startISO);
  const endDateObj = new Date(endISO);
  const startTimestamp = admin.firestore.Timestamp.fromDate(startDateObj);
  const endTimestamp = admin.firestore.Timestamp.fromDate(endDateObj);

  // Fetch expenses for this month
  let allExpenses = [];
  try {
    const expensesSnap = await db
      .collection("EXPENSES")
      .where("user_id", "==", userPath)
      .get();

    allExpenses = expensesSnap.docs.map((doc) => {
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
    console.log(`📊 Found ${allExpenses.length} total expenses`);
  } catch (err) {
    console.error("❌ Error fetching expenses:", err.message);
    allExpenses = [];
  }

  const monthExpenses = allExpenses.filter(
    (r) => r.dateISO >= startISO && r.dateISO < endISO
  );
  console.log(`📊 Found ${monthExpenses.length} expenses for ${monthKey}`);

  // Fetch incomes for this month
  let allIncomes = [];
  try {
    const incomesSnap = await db
      .collection("INCOME")
      .where("user_id", "==", userPath)
      .get();

    allIncomes = incomesSnap.docs.map((doc) => {
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
    console.log(`📊 Found ${allIncomes.length} total incomes`);
  } catch (err) {
    console.error("❌ Error fetching incomes:", err.message);
    allIncomes = [];
  }

  const monthIncomes = allIncomes.filter(
    (r) => r.dateISO >= startISO && r.dateISO < endISO
  );
  console.log(`📊 Found ${monthIncomes.length} incomes for ${monthKey}`);

  // Fetch debts
  let debts = [];
  try {
    const debtsSnap = await db
      .collection("DEBTS")
      .where("user_id", "==", userPath)
      .get();

    for (const doc of debtsSnap.docs) {
      try {
        const d = doc.data();
        const paymentsSnap = await doc.ref.collection("PAYMENTS").limit(20).get();
        const payments = paymentsSnap.docs.map((p) => ({
          id: p.id,
          amount: Number(p.data().amount) || 0,
          dateISO: toISO(p.data().date_iso),
          note: p.data().note || "",
        }));

        debts.push({
          id: doc.id,
          name: d.name || "",
          type: d.type || "Other",
          originalAmount: Number(d.original_amount) || 0,
          currentBalance: Number(d.current_balance) || 0,
          monthlyPayment: Number(d.monthly_payment) || 0,
          targetDate: d.target_date || null,
          payments,
          createdAt: toISO(d.created_at),
        });
      } catch (err) {
        console.error(`❌ Error processing debt ${doc.id}:`, err.message);
      }
    }
    console.log(`📊 Found ${debts.length} debts`);
  } catch (err) {
    console.error("❌ Error fetching debts:", err.message);
    debts = [];
  }

  // Fetch savings goals and contributions
  let savingsGoals = [];
  let savingsContributions = [];
  try {
    const goalsSnap = await db
      .collection("SAVINGS_GOALS")
      .where("user_id", "==", userPath)
      .get();

    for (const goalDoc of goalsSnap.docs) {
      try {
        const g = goalDoc.data();
        const goalId = goalDoc.id;
        
        // Fetch contributions for this goal in this month
        const contribsSnap = await goalDoc.ref
          .collection("CONTRIBUTIONS")
          .where("date", ">=", startTimestamp)
          .where("date", "<", endTimestamp)
          .get();

        const monthContribs = contribsSnap.docs.map((c) => {
          const cd = c.data();
          const date = cd.date?.toDate ? cd.date.toDate() : new Date(cd.date || Date.now());
          return {
            id: c.id,
            goalId,
            amount: Number(cd.amount) || 0,
            date: date,
            source: cd.source || "",
            note: cd.note || "",
          };
        });

        savingsContributions.push(...monthContribs);

        const deadline = g.deadline?.toDate ? g.deadline.toDate() : (g.deadline ? new Date(g.deadline) : null);
        const createdAt = g.created_at?.toDate ? g.created_at.toDate() : (g.created_at ? new Date(g.created_at) : null);
        const updatedAt = g.updated_at?.toDate ? g.updated_at.toDate() : (g.updated_at ? new Date(g.updated_at) : null);

        savingsGoals.push({
          id: goalId,
          userId: g.user_id || userPath,
          name: g.name || "",
          targetAmount: Number(g.target_amount) || 0,
          currentAmount: Number(g.current_amount) || 0,
          monthlyTarget: g.monthly_target !== undefined ? (g.monthly_target ? Number(g.monthly_target) : null) : null,
          deadline,
          category: g.category || "",
          notes: g.notes || "",
          createdAt,
          updatedAt,
        });
      } catch (err) {
        console.error(`❌ Error processing savings goal ${goalDoc.id}:`, err.message);
      }
    }
    console.log(`📊 Found ${savingsGoals.length} savings goals, ${savingsContributions.length} contributions for ${monthKey}`);
  } catch (err) {
    console.error("❌ Error fetching savings goals:", err.message);
    savingsGoals = [];
    savingsContributions = [];
  }

  // Fetch budget record for the month
  let budgetDoc = null;
  try {
    const budgetSnap = await db
      .collection("BUDGET")
      .where("user_id", "==", userPath)
      .where("month_key", "==", monthKey)
      .limit(1)
      .get();
    if (!budgetSnap.empty) {
      budgetDoc = budgetSnap.docs[0].data();
    }
  } catch (err) {
    console.error("❌ Error fetching budget record:", err.message);
  }

  // Calculate totals & savings contributions (CONTRIBUTIONS = source of truth)
  const totalIncome = monthIncomes.reduce((sum, r) => sum + r.amount, 0);
  const monthlySavingsContrib = savingsContributions.reduce((sum, c) => sum + (Number(c.amount) || 0), 0);

  const consumptionExpenses = monthExpenses.filter((exp) => {
    const cat = (exp.category || "").trim();
    return !SAVINGS_CATEGORY_NAMES.some((name) => name.toLowerCase() === cat.toLowerCase());
  });
  const ignoredSavingsExpenseCount = monthExpenses.length - consumptionExpenses.length;
  if (ignoredSavingsExpenseCount > 0) {
    console.log(`ℹ️ Ignored ${ignoredSavingsExpenseCount} savings expense rows to avoid double counting.`);
  }

  const consumptionTotal = consumptionExpenses.reduce((sum, r) => sum + r.amount, 0);
  const totalExpenses = round2(consumptionTotal + monthlySavingsContrib);
  const savings = round2(totalIncome - totalExpenses);
  const legacySavingsRate = totalIncome > 0 ? savings / totalIncome : 0;
  const netCashFlow = round2(totalIncome - (consumptionTotal + monthlySavingsContrib));

  const spendingTotals = {
    income: round2(totalIncome),
    spending: round2(consumptionTotal),
    savingsContrib: round2(monthlySavingsContrib),
    netCashFlow,
  };

  const totalGoalTarget = savingsGoals.reduce((sum, g) => sum + (Number(g.targetAmount) || 0), 0);
  const totalGoalCurrent = savingsGoals.reduce((sum, g) => sum + (Number(g.currentAmount) || 0), 0);
  const emergencyGoal = savingsGoals.find((g) => (g.category || "").toLowerCase().includes("emergency"));
  let emergencyFundMonths = null;
  if (emergencyGoal && consumptionTotal > 0) {
    const emergencyBalance = Number(emergencyGoal.currentAmount) || 0;
    emergencyFundMonths = emergencyBalance / consumptionTotal;
  }

  const savingsSummary = {
    savingsContrib: round2(monthlySavingsContrib),
    savingsRate: round4(totalIncome > 0 ? monthlySavingsContrib / totalIncome : 0),
    goalsCount: savingsGoals.length,
    totalGoalTarget: round2(totalGoalTarget),
    totalGoalCurrent: round2(totalGoalCurrent),
    emergencyFundMonths: emergencyFundMonths !== null ? round2(emergencyFundMonths) : null,
  };

  const totalDebtVal = debts.reduce((sum, d) => sum + d.currentBalance, 0);
  const monthlyDebtPaymentsVal = debts.reduce((sum, d) => sum + d.monthlyPayment, 0);
  const dtiRatio = totalIncome > 0 && monthlyDebtPaymentsVal > 0 ? monthlyDebtPaymentsVal / totalIncome : null;
  const debtSummary = debts.length
    ? {
        totalDebt: round2(totalDebtVal),
        totalMonthlyDebtPayment: round2(monthlyDebtPaymentsVal),
        debtToIncomeRatio: dtiRatio !== null ? round4(dtiRatio) : null,
        debtsCount: debts.length,
      }
    : undefined;

  // Group expenses by category (including savings categories for legacy charts / budgets)
  const categoryTotals = {};
  monthExpenses.forEach((exp) => {
    const cat = exp.category || "Uncategorized";
    categoryTotals[cat] = (categoryTotals[cat] || 0) + exp.amount;
  });

  // Get previous month data for comparison
  const prevMonthKey = getPreviousMonthKey(monthKey);
  const prevRange = getMonthDateRange(prevMonthKey);
  const prevExpenses = allExpenses.filter(
    (r) => r.dateISO >= prevRange.startISO && r.dateISO < prevRange.endISO
  );
  const prevCategoryTotals = {};
  prevExpenses.forEach((exp) => {
    const cat = exp.category || "Uncategorized";
    prevCategoryTotals[cat] = (prevCategoryTotals[cat] || 0) + exp.amount;
  });

  // Build categories array with change percentages
  const categories = Object.entries(categoryTotals)
    .map(([name, amount]) => {
      const prevAmount = prevCategoryTotals[name] || 0;
      const changePct = prevAmount > 0 ? ((amount - prevAmount) / prevAmount) * 100 : null;
      return {
        name,
        amount: round2(amount),
        changePctVsPrevMonth: changePct !== null ? round2(changePct) : null,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // Debt health score (unchanged formula)
  let debtHealthScore = null;
  if (debts.length > 0) {
    const totalMonthlyPayments = debts.reduce((sum, d) => sum + d.monthlyPayment, 0);
    const dtiForScore = totalIncome > 0 ? totalMonthlyPayments / totalIncome : 0;
    const dtiScore = Math.max(0, 100 - Math.max(0, dtiForScore * 100 - 15) * 1.8);

    const progressScores = debts.map((d) => {
      if (d.originalAmount <= 0) return 50;
      const progress = ((d.originalAmount - d.currentBalance) / d.originalAmount) * 100;
      return Math.min(100, Math.max(0, progress));
    });
    const progressScore = progressScores.reduce((a, b) => a + b, 0) / progressScores.length;

    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const consistencyScores = debts.map((d) => {
      const recentPayments = (d.payments || []).filter(
        (p) => new Date(p.dateISO) >= threeMonthsAgo
      );
      if (recentPayments.length === 0) return 30;
      if (recentPayments.length >= 2) return 100;
      return 60;
    });
    const consistencyScore = consistencyScores.reduce((a, b) => a + b, 0) / consistencyScores.length;

    const debtCountScore =
      debts.length === 0 ? 100 : debts.length <= 3 ? 100 : debts.length <= 6 ? 80 : Math.max(30, 80 - (debts.length - 6) * 10);

    debtHealthScore = Math.round(0.4 * dtiScore + 0.3 * progressScore + 0.2 * consistencyScore + 0.1 * debtCountScore);
  }

  // Budget summary
  let budgetSummary;
  if (budgetDoc) {
    const allocations = toNumberRecord(budgetDoc.allocations || {});
    const categoriesSet = new Set([...Object.keys(allocations), ...Object.keys(categoryTotals)]);
    const budgetCategories = [...categoriesSet].map((category) => {
      const budgeted = round2(allocations[category] || 0);
      const actual = round2(categoryTotals[category] || 0);
      const variance = round2(actual - budgeted);
      const varianceRate = budgeted > 0 ? variance / budgeted : null;
      return {
        category,
        budgeted,
        actual,
        variance,
        varianceRate: varianceRate !== null ? round4(varianceRate) : null,
      };
    });
    const totalBudget = round2(budgetCategories.reduce((sum, cat) => sum + cat.budgeted, 0));
    const totalActual = round2(budgetCategories.reduce((sum, cat) => sum + cat.actual, 0));
    budgetSummary = {
      totalBudget,
      totalActual,
      categories: budgetCategories,
    };
  }

  const snapshot = {
    userId,
    monthKey,
    currency: "MYR",
    // NOTE: totalExpenses includes consumption + savings contributions to preserve legacy fields.
    totalIncome: round2(totalIncome),
    totalExpenses,
    savings,
    savingsRate: round4(legacySavingsRate),
    categories,
  };

  if (debtHealthScore !== null) snapshot.debtHealthScore = debtHealthScore;
  if (debts.length > 0) {
    snapshot.totalDebt = round2(totalDebtVal);
    snapshot.monthlyDebtPayments = round2(monthlyDebtPaymentsVal);
  }

  snapshot.spendingTotals = spendingTotals;
  snapshot.savingsSummary = savingsSummary;
  if (debtSummary) snapshot.debtSummary = debtSummary;
  if (budgetSummary) snapshot.budgetSummary = budgetSummary;

  return snapshot;
}

// ======================================================
// 📊 Monthly Snapshot Endpoint
// ======================================================
app.get("/monthly-snapshot", async (req, res) => {
  try {
    const { userId, monthKey: monthKeyQuery } = req.query;
    if (!userId) {
      return res.status(400).json({ error: "Missing userId query parameter" });
    }
    // TODO: userId should come from verified auth middleware, not directly from req.query.

    const targetMonthKey =
      typeof monthKeyQuery === "string" && monthKeyQuery.length > 0
        ? monthKeyQuery
        : getCurrentMonthKey();

    console.log("[/monthly-snapshot] userId, monthKey:", userId, targetMonthKey);

    const snapshot = await buildMonthlySnapshotFromFirestore(userId, targetMonthKey);
    const snapshotStats = snapshot
      ? {
          userId,
          monthKey: targetMonthKey,
          income: snapshot.totalIncome,
          spending: snapshot.spendingTotals?.spending,
          savings: snapshot.savingsSummary?.savingsContrib,
          dti: snapshot.debtSummary?.debtToIncomeRatio,
        }
      : { userId, monthKey: targetMonthKey, snapshot: null };

    if (isDevEnv) {
      console.log("[/monthly-snapshot] snapshot:", JSON.stringify(snapshot, null, 2));
    } else {
      console.log("[/monthly-snapshot] snapshot stats:", snapshotStats);
    }

    res.json({ snapshot: snapshot ?? null });
  } catch (err) {
    console.error("❌ Monthly snapshot error:", err.message);
    console.error("❌ Full error:", err);
    res.json({ snapshot: null });
  }
});

// ======================================================
// 💰 Transaction Creation Helpers (reused by chat)
// ======================================================
const SAVINGS_CATEGORY_NAMES_BACKEND = ["Savings", "Saving", "Emergency Fund", "Emergency", "Investments", "Investment"];

// ======================================================
// 📋 Pending Transaction Storage (in-memory)
// ======================================================
// NOTE: In production, consider moving this to Firestore or Redis to survive server restarts
// and handle multiple server instances. For now, in-memory Map is acceptable for single-instance deployments.
const pendingTransactions = new Map(); // userId -> transactionData

function setPendingTransaction(userId, transactionData) {
  pendingTransactions.set(userId, {
    ...transactionData,
    createdAt: Date.now(), // Track when pending was created (for potential timeout)
  });
  console.log(`📋 Pending transaction set for userId: ${userId}`);
}

function getPendingTransaction(userId) {
  return pendingTransactions.get(userId);
}

function clearPendingTransaction(userId) {
  const existed = pendingTransactions.delete(userId);
  if (existed) {
    console.log(`🗑️ Pending transaction cleared for userId: ${userId}`);
  }
  return existed;
}

// Helper to check if user message means "confirm"
function isConfirmMessage(message) {
  const lower = message.toLowerCase().trim();
  const confirmPatterns = [
    /^confirm$/,
    /^yes$/,
    /^ok$/,
    /^okay$/,
    /^save$/,
    /^save it$/,
    /^go ahead$/,
    /^proceed$/,
    /^do it$/,
    /^sure$/,
    /^yep$/,
    /^yeah$/,
    /^correct$/,
    /^that's right$/,
    /^that is right$/,
  ];
  return confirmPatterns.some(pattern => pattern.test(lower));
}

// Helper to check if user message means "cancel"
function isCancelMessage(message) {
  const lower = message.toLowerCase().trim();
  const cancelPatterns = [
    /^cancel$/,
    /^no$/,
    /^don't save$/,
    /^dont save$/,
    /^discard$/,
    /^ignore$/,
    /^nevermind$/,
    /^never mind$/,
    /^forget it$/,
    /^nope$/,
    /^nah$/,
  ];
  return cancelPatterns.some(pattern => pattern.test(lower));
}

// Helper to format transaction summary for confirmation prompt (internal use)
function formatTransactionSummary(transactionData) {
  const { type, amount, currency = "MYR", date, categoryId, description, paymentMethod } = transactionData;
  
  // Format date
  let dateStr = "today";
  if (date) {
    try {
      const dateObj = new Date(date);
      dateStr = dateObj.toLocaleDateString("en-US", { 
        year: "numeric", 
        month: "short", 
        day: "numeric" 
      });
    } catch {
      dateStr = "today";
    }
  }
  
  // Determine category (use provided or infer from description)
  const category = categoryId || mapCategoryToExisting(description || "", type);
  
  // Build summary
  const typeLabel = type === "expense" ? "Expense" : "Income";
  const summary = `I'm about to log this transaction:

• Type: ${typeLabel}
• Amount: ${currency} ${amount}
• Category: ${category}
• Date: ${dateStr}
${description ? `• Description: ${description}` : ""}
${paymentMethod ? `• Payment Method: ${paymentMethod}` : ""}

Type **confirm** to save it, or **cancel** to discard.`;

  return summary;
}

// Helper to format transaction data for structured API response
function formatTransactionForResponse(transactionData) {
  const { type, amount, currency = "MYR", date, categoryId, description, paymentMethod } = transactionData;
  
  // Format date as ISO string (YYYY-MM-DD) or "today"
  let dateStr = null;
  if (date) {
    try {
      const dateObj = new Date(date);
      dateStr = dateObj.toISOString().split("T")[0]; // YYYY-MM-DD format
    } catch {
      dateStr = null;
    }
  }
  
  // Determine category name (use provided or infer from description)
  const categoryName = categoryId || mapCategoryToExisting(description || "", type);
  
  return {
    type: type, // "expense" | "income"
    amount: parseFloat(amount),
    currency: currency,
    categoryName: categoryName,
    date: dateStr,
    description: description || "",
    paymentMethod: paymentMethod || (type === "expense" ? "Cash" : "Bank"),
  };
}

// Map natural language descriptions to existing categories
function mapCategoryToExisting(description = "", type = "expense") {
  const lower = (description || "").toLowerCase();
  
  if (type === "expense") {
    // Expense categories from AddRecord.tsx
    if (lower.match(/rice|fish|chicken|tomato|egg|drink|tea|cabbage|meal|food|mee|lunch|dinner|breakfast|restaurant|mcd|kfc|starbucks|cafe|coffee/)) return "Food";
    if (lower.match(/grab|taxi|bus|fuel|toll|train|car|transport|uber|parking/)) return "Transport";
    if (lower.match(/supermarket|grocer|mart|tesco|jaya|aeon|lotus|grocery|shopping|store/)) return "Shopping";
    if (lower.match(/hotel|flight|travel|booking|trip|vacation/)) return "Travel";
    if (lower.match(/movie|cinema|ticket|entertainment|game|netflix|spotify/)) return "Entertainment";
    if (lower.match(/electric|water|bill|utility|tenaga|tm|unifi|internet|wifi|phone|mobile/)) return "Bills";
    if (lower.match(/pharmacy|clinic|hospital|health|medical|doctor|medicine/)) return "Healthcare";
    if (lower.match(/education|school|university|college|tuition|book/)) return "Education";
    if (lower.match(/rent|housing|home|apartment|house/)) return "Housing";
    return "Others";
  } else {
    // Income categories from AddRecord.tsx
    if (lower.match(/salary|pay|wage|employment|job|work/)) return "Salary";
    if (lower.match(/investment|dividend|stock|return/)) return "Investment";
    if (lower.match(/gift|present|bonus/)) return "Gift";
    if (lower.match(/freelance|contract|project|consulting/)) return "Freelance";
    if (lower.match(/bonus|incentive/)) return "Bonus";
    return "Salary"; // Default for income
  }
}

// Create expense record (same schema as AddRecord.tsx)
async function createExpenseRecord(userId, { amount, currency = "MYR", date, categoryId, description, paymentMethod = "Cash" }) {
  if (!db) {
    throw new Error("Firestore not initialized");
  }
  
  const userPath = normalizeUserPath(userId);
  const expId = "EXP" + new Date().getTime();
  
  // Map category if provided, otherwise try to infer from description
  let finalCategory = categoryId || mapCategoryToExisting(description, "expense");
  
  // Validate date or default to today
  let finalDate;
  try {
    finalDate = date ? new Date(date).toISOString() : new Date().toISOString();
  } catch {
    finalDate = new Date().toISOString();
  }
  
  const expenseData = {
    exp_id: expId,
    user_id: userPath,
    exp_category: finalCategory,
    exp_payment_method: paymentMethod,
    exp_total: parseFloat(amount),
    exp_notes: description || "",
    exp_date: finalDate,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  const docRef = await db.collection("EXPENSES").add(expenseData);
  return { id: docRef.id, ...expenseData };
}

// Create income record (same schema as AddRecord.tsx)
async function createIncomeRecord(userId, { amount, currency = "MYR", date, categoryId, description, paymentMethod = "Bank" }) {
  if (!db) {
    throw new Error("Firestore not initialized");
  }
  
  const userPath = normalizeUserPath(userId);
  const incId = "INC" + new Date().getTime();
  
  // Map category if provided, otherwise try to infer from description
  let finalCategory = categoryId || mapCategoryToExisting(description, "income");
  
  // Validate date or default to today
  let finalDate;
  try {
    finalDate = date ? new Date(date).toISOString() : new Date().toISOString();
  } catch {
    finalDate = new Date().toISOString();
  }
  
  const incomeData = {
    inc_id: incId,
    user_id: userPath,
    inc_category: finalCategory,
    inc_payment_method: paymentMethod,
    inc_total: parseFloat(amount),
    inc_notes: description || "",
    inc_date: finalDate,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  
  const docRef = await db.collection("INCOME").add(incomeData);
  return { id: docRef.id, ...incomeData };
}

// ======================================================
// 🤖 Chatbot route (OpenAI with finance snapshot)
// ======================================================
const CHAT_SYSTEM_PROMPT = `You are Auri, a direct but kind personal finance coach. 
You ONLY use the numeric data in the JSON 'snapshot' when talking about money.
If the snapshot is null or missing information, say so and give general advice instead.
Never invent MYR amounts or percentages that are not directly implied by the snapshot.
All amounts are in MYR.

IMPORTANT FINANCIAL CONCEPTS:
- "spending" or "consumption spending" refers to spendingTotals.spending (consumption only, excludes savings contributions)
- "savings contributions" refers to spendingTotals.savingsContrib (money actively saved this month)
- When discussing spending behavior, use spendingTotals.spending, NOT totalExpenses
- When discussing savings rate, prefer savingsSummary.savingsRate if available (based on actual contributions), otherwise use the top-level savingsRate
- For loan questions, consider both debtSummary (debt obligations) and savingsSummary (available savings/assets)
- If snapshot.totalIncome <= 0, do NOT compute savingsRate or debt-to-income ratios. Explain that meaningful ratios cannot be computed.
- If budgetSummary.totalBudget is 0 or every category has a 0 budget, do NOT comment about overspending vs budget because there is no budget baseline.

TRANSACTION LOGGING:
- When the user CLEARLY asks to log/add/record/save an expense or income (e.g., "Add an expense", "Log my salary", "I paid RM 120"), call the create_transaction tool.
- If the user is just TALKING about money without asking to log it (e.g., "I hate paying RM 100 for parking"), do NOT create a transaction.
- Only call create_transaction when the user explicitly intends to record a transaction.
- If critical fields are missing (amount, type, or unclear date), ask a clarifying question before calling the tool.
- IMPORTANT: When proposing a new transaction using the create_transaction tool, you are only suggesting the data. The system will show a confirmation card with buttons. Do NOT say that a transaction has already been saved. Use language like "I'm about to log this transaction" and let the system handle the actual save after user confirmation via buttons.`;

// OpenAI function/tool definition for create_transaction
const CREATE_TRANSACTION_TOOL = {
  type: "function",
  function: {
    name: "create_transaction",
    description: "Create a new expense or income transaction record. Use this when the user explicitly asks to log/add/record/save an expense or income.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["expense", "income"],
          description: "Whether this is an expense or income transaction",
        },
        amount: {
          type: "number",
          description: "The transaction amount (positive number)",
        },
        currency: {
          type: "string",
          description: "Currency code (default: MYR if not specified)",
          default: "MYR",
        },
        date: {
          type: "string",
          description: "Transaction date in ISO format (YYYY-MM-DD or full ISO string). Default to today if not specified or unclear.",
        },
        categoryId: {
          type: "string",
          description: "Category name (e.g., 'Food', 'Transport', 'Salary'). If not provided, will be inferred from description. For expenses: Food, Transport, Housing, Shopping, Bills, Entertainment, Healthcare, Education, Others. For income: Salary, Investment, Gift, Freelance, Bonus.",
        },
        description: {
          type: "string",
          description: "Description or merchant name for the transaction",
        },
        paymentMethod: {
          type: "string",
          description: "Payment method (e.g., 'Cash', 'Bank', 'Credit Card'). Default: 'Cash' for expenses, 'Bank' for income.",
        },
      },
      required: ["type", "amount"],
    },
  },
};

// ======================================================
// 🤖 Chat Endpoint with Button-Based Transaction Confirmation
// ======================================================
// 
// NEW BUTTON-BASED FLOW:
// 
// 1. User sends text message: "Add an expense RM 50 for groceries"
//    → Backend calls OpenAI with create_transaction tool
//    → Model extracts transaction data and calls tool
//    → Backend stores as pending transaction (no DB write yet)
//    → Returns: { type: "pending_transaction_confirmation", message: "...", transaction: {...}, actions: [...] }
// 
// 2. Frontend displays confirmation card with "Confirm" and "Cancel" buttons
// 
// 3. User clicks "Confirm" button
//    → Frontend sends: { userId, action: "confirm_pending_transaction" }
//    → Backend saves transaction to Firestore
//    → Clears pending transaction
//    → Returns: { type: "normal", message: "Done! I've saved..." }
// 
// 4. User clicks "Cancel" button
//    → Frontend sends: { userId, action: "cancel_pending_transaction" }
//    → Backend clears pending transaction (no DB write)
//    → Returns: { type: "normal", message: "Okay, I've discarded..." }
// 
// 5. If user sends text while pending exists (fallback):
//    → If text matches confirm/cancel patterns → process as above
//    → Otherwise → return pending confirmation structure again with buttons
// 
// 6. Normal chat (no pending transaction):
//    → Returns: { type: "normal", message: "Assistant reply..." }
// 
// ======================================================
app.post("/chat", async (req, res) => {
  try {
    const { message, userId, action } = req.body || {};
    
    // Validate request: must have either message or action, and always need userId
    if (!userId) return res.status(400).json({ error: "Missing userId" });
    if (!message && !action) return res.status(400).json({ error: "Must provide either 'message' or 'action'" });
    // TODO: userId should come from verified auth middleware, not directly from req.body.

    if (!openai) {
      return res.status(500).json({ error: "OpenAI API key not configured" });
    }

    // ======================================================
    // STEP 1: Handle button actions (confirm/cancel from UI)
    // ======================================================
    if (action) {
      const pending = getPendingTransaction(userId);
      
      if (action === "confirm_pending_transaction") {
        if (!pending) {
          return res.json({
            type: "normal",
            message: "There is no transaction pending confirmation.",
          });
        }
        
        // User confirmed via button - save the transaction
        try {
          let createdRecord;
          if (pending.type === "expense") {
            createdRecord = await createExpenseRecord(userId, {
              amount: pending.amount,
              currency: pending.currency || "MYR",
              date: pending.date,
              categoryId: pending.categoryId,
              description: pending.description || "",
              paymentMethod: pending.paymentMethod || "Cash",
            });
          } else {
            createdRecord = await createIncomeRecord(userId, {
              amount: pending.amount,
              currency: pending.currency || "MYR",
              date: pending.date,
              categoryId: pending.categoryId,
              description: pending.description || "",
              paymentMethod: pending.paymentMethod || "Bank",
            });
          }
          
          console.log("✅ Transaction confirmed and saved:", createdRecord);
          clearPendingTransaction(userId);
          
          // Format date for display
          const transactionDate = new Date(createdRecord.exp_date || createdRecord.inc_date);
          const dateStr = transactionDate.toLocaleDateString("en-US", { 
            year: "numeric", 
            month: "short", 
            day: "numeric" 
          });
          
          const confirmationMessage = `Done! I've saved this transaction:
• Type: ${pending.type === "expense" ? "Expense" : "Income"}
• Amount: ${pending.currency || "MYR"} ${pending.amount}
• Category: ${createdRecord.exp_category || createdRecord.inc_category}
${createdRecord.exp_notes || createdRecord.inc_notes ? `• Description: ${createdRecord.exp_notes || createdRecord.inc_notes}` : ""}
• Date: ${dateStr}`;
          
          return res.json({
            type: "normal",
            message: confirmationMessage,
          });
        } catch (error) {
          console.error("❌ Error saving confirmed transaction:", error);
          clearPendingTransaction(userId);
          return res.json({
            type: "normal",
            message: `Sorry, I encountered an error while saving the transaction: ${error.message}. Please try again or use the manual Add Record screen.`,
          });
        }
      } else if (action === "cancel_pending_transaction") {
        if (!pending) {
          return res.json({
            type: "normal",
            message: "There is no transaction pending confirmation.",
          });
        }
        
        // User cancelled via button - discard pending transaction
        clearPendingTransaction(userId);
        return res.json({
          type: "normal",
          message: "Okay, I've discarded that transaction and nothing was saved.",
        });
      } else {
        // Unknown action
        return res.json({
          type: "normal",
          message: "Unknown action. Please try again.",
        });
      }
    }

    // ======================================================
    // STEP 2: Handle text messages when pending transaction exists
    // ======================================================
    const pending = getPendingTransaction(userId);
    if (pending) {
      console.log("📋 Found pending transaction for userId:", userId);
      
      // Optional: Keep text-based confirm/cancel as fallback
      if (isConfirmMessage(message)) {
        // User confirmed via text - save the transaction
        try {
          let createdRecord;
          if (pending.type === "expense") {
            createdRecord = await createExpenseRecord(userId, {
              amount: pending.amount,
              currency: pending.currency || "MYR",
              date: pending.date,
              categoryId: pending.categoryId,
              description: pending.description || "",
              paymentMethod: pending.paymentMethod || "Cash",
            });
          } else {
            createdRecord = await createIncomeRecord(userId, {
              amount: pending.amount,
              currency: pending.currency || "MYR",
              date: pending.date,
              categoryId: pending.categoryId,
              description: pending.description || "",
              paymentMethod: pending.paymentMethod || "Bank",
            });
          }
          
          console.log("✅ Transaction confirmed and saved:", createdRecord);
          clearPendingTransaction(userId);
          
          const transactionDate = new Date(createdRecord.exp_date || createdRecord.inc_date);
          const dateStr = transactionDate.toLocaleDateString("en-US", { 
            year: "numeric", 
            month: "short", 
            day: "numeric" 
          });
          
          const confirmationMessage = `Done! I've saved this transaction:
• Type: ${pending.type === "expense" ? "Expense" : "Income"}
• Amount: ${pending.currency || "MYR"} ${pending.amount}
• Category: ${createdRecord.exp_category || createdRecord.inc_category}
${createdRecord.exp_notes || createdRecord.inc_notes ? `• Description: ${createdRecord.exp_notes || createdRecord.inc_notes}` : ""}
• Date: ${dateStr}`;
          
          return res.json({
            type: "normal",
            message: confirmationMessage,
          });
        } catch (error) {
          console.error("❌ Error saving confirmed transaction:", error);
          clearPendingTransaction(userId);
          return res.json({
            type: "normal",
            message: `Sorry, I encountered an error while saving the transaction: ${error.message}. Please try again or use the manual Add Record screen.`,
          });
        }
      } else if (isCancelMessage(message)) {
        // User cancelled via text - discard pending transaction
        clearPendingTransaction(userId);
        return res.json({
          type: "normal",
          message: "Okay, I've discarded that transaction and nothing was saved.",
        });
      } else {
        // User sent something unrelated - return pending confirmation structure with buttons
        return res.json({
          type: "pending_transaction_confirmation",
          message: "You still have a pending transaction. Please confirm or cancel it.",
          transaction: formatTransactionForResponse(pending),
          actions: [
            { id: "confirm_pending_transaction", label: "Confirm", style: "primary" },
            { id: "cancel_pending_transaction", label: "Cancel", style: "secondary" },
          ],
        });
      }
    }

    // ======================================================
    // STEP 3: No pending transaction - proceed with normal chat flow
    // ======================================================
    const targetMonthKey = getCurrentMonthKey(); // Chat currently always reflects the CURRENT month snapshot.
    // If the user later references a different month, parse it and pass that monthKey instead.

    const snapshot = await buildMonthlySnapshotFromFirestore(userId, targetMonthKey);
    const income = snapshot?.totalIncome ?? 0;
    const spending = snapshot?.spendingTotals?.spending ?? 0;
    const totalBudget = snapshot?.budgetSummary?.totalBudget ?? 0;
    const hasMeaningfulBudget = totalBudget > 0;

    const snapshotStats = snapshot
      ? {
          userId,
          monthKey: targetMonthKey,
          income,
          spending,
          savings: snapshot.savingsSummary?.savingsContrib,
          dti: snapshot.debtSummary?.debtToIncomeRatio,
        }
      : { userId, monthKey: targetMonthKey, snapshot: null };
    console.log("🧾 /chat snapshot stats:", snapshotStats);

    const promptNotes = [];
    if (income <= 0) {
      promptNotes.push(
        "WARNING: totalIncome is 0 or negative. Do NOT compute savings rates or debt-to-income ratios. Explain clearly that meaningful ratios cannot be computed because income is 0 this month."
      );
    }
    if (Math.abs(income) < TINY_TOTAL_THRESHOLD && Math.abs(spending) < TINY_TOTAL_THRESHOLD) {
      promptNotes.push(
        "NOTE: This month has very small totals (income and spending under 50 MYR). Make it clear in your answer that insights are based on very little data and may not be representative."
      );
    }
    if (!hasMeaningfulBudget) {
      promptNotes.push(
        "NOTE: There is effectively no budget set (totalBudget is 0). Do NOT comment about overspending or underspending relative to a budget; instead, suggest setting up a budget first if helpful."
      );
    }

    let userContent = "";
    if (promptNotes.length) {
      userContent += promptNotes.join("\n") + "\n\n";
    }

    if (snapshot) {
      userContent += `Here is the user's current-month finance snapshot (MYR):\n${JSON.stringify(snapshot, null, 2)}\n\n`;
    } else {
      userContent += "Finance snapshot: null (no data was provided).\n\n";
    }

    userContent += `User question:\n${message}\n\nRules:\n` +
      `- When they ask about 'my spending' or 'consumption spending', use spendingTotals.spending (NOT totalExpenses, which may include savings).\n` +
      `- When they ask about 'my savings', use savingsSummary if available (shows active savings contributions and goals), otherwise use the top-level savings field.\n` +
      `- When they ask about 'my income', use spendingTotals.income or totalIncome.\n` +
      `- When they ask about 'my debt' or loans, use debtSummary for debt obligations AND savingsSummary for available savings/assets.\n` +
      `- If you cannot compute something from the snapshot, say so plainly.\n` +
      `- Give at most 3 concise, actionable recommendations.\n` +
      `- Do NOT output fake exact numbers; only use numbers you can read from the snapshot.`;

    const lower = message.toLowerCase();
    const asksNewLoan =
      lower.includes("apply for") ||
      lower.includes("get a loan") ||
      lower.includes("take a loan") ||
      lower.includes("house loan") ||
      lower.includes("car loan") ||
      lower.includes("personal loan") ||
      lower.includes("new mortgage") ||
      lower.includes("new loan") ||
      lower.includes("should i get a loan") ||
      lower.includes("should i take a loan");

    if (asksNewLoan) {
      userContent +=
        "\n\nThe user is asking about taking a NEW loan. Use `debtSummary` and `savingsSummary` to assess their readiness:\n" +
        "- Look at debtSummary.debtToIncomeRatio, debtSummary.totalDebt, and debtSummary.totalMonthlyDebtPayment.\n" +
        "- Look at savingsSummary.savingsRate and savingsSummary.emergencyFundMonths.\n" +
        "- Explain why taking a new loan looks manageable or risky based on these numbers.\n" +
        "- Suggest improvements before taking a loan (e.g., reduce DTI, build an emergency fund).\n" +
        "- Do NOT give guarantees; this is not formal financial advice.\n";
    }

    // First API call with tools
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: CHAT_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      tools: [CREATE_TRANSACTION_TOOL],
      tool_choice: "auto", // Let the model decide when to use the tool
      max_tokens: 500,
      temperature: 0.7,
    });

    const assistantMessage = response.choices[0]?.message;
    let finalReply = assistantMessage?.content || "";

    // Check if the model wants to call a tool
    if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolCall = assistantMessage.tool_calls[0];
      
      if (toolCall.function.name === "create_transaction") {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          console.log("🔧 Tool call received:", args);

          // Validate required fields
          if (!args.type || !args.amount) {
            finalReply = "I need both the transaction type (expense or income) and amount to create a record. Could you please provide those?";
          } else {
            // Store as pending transaction instead of immediately saving
            // NOTE: For now, we require confirmation for ALL transactions.
            // In the future, we could relax this for small amounts (e.g., < 100 MYR),
            // but always require confirmation for large amounts (>= 1000 MYR).
            const requiresConfirmation = true; // Set to false for auto-save on small amounts in future
            
            if (requiresConfirmation || args.amount >= 1000) {
              // Store pending transaction
              const transactionData = {
                type: args.type,
                amount: args.amount,
                currency: args.currency || "MYR",
                date: args.date,
                categoryId: args.categoryId,
                description: args.description || "",
                paymentMethod: args.paymentMethod || (args.type === "expense" ? "Cash" : "Bank"),
              };
              
              setPendingTransaction(userId, transactionData);
              
              console.log("📋 Transaction stored as pending, waiting for user confirmation");
              
              // Return structured pending confirmation response with buttons
              return res.json({
                type: "pending_transaction_confirmation",
                message: "I'm about to log this transaction:",
                transaction: formatTransactionForResponse(transactionData),
                actions: [
                  { id: "confirm_pending_transaction", label: "Confirm", style: "primary" },
                  { id: "cancel_pending_transaction", label: "Cancel", style: "secondary" },
                ],
              });
            } else {
              // Future: Auto-save for small amounts (not implemented yet)
              // For now, this branch won't execute since requiresConfirmation is always true
              finalReply = "Auto-save for small amounts is not yet implemented. All transactions require confirmation.";
            }
          }
        } catch (error) {
          console.error("❌ Error processing transaction tool call:", error);
          finalReply = `Sorry, I encountered an error while processing the transaction: ${error.message}. Please try again or use the manual Add Record screen.`;
        }
      }
    }

    // Return normal chat response (no pending transaction, no tool call, or tool call failed)
    res.json({
      type: "normal",
      message: finalReply,
    });
  } catch (err) {
    console.error("❌ Chat error:", err.response?.data || err.message);
    // Return a valid ChatResponse structure even on errors
    res.status(500).json({
      type: "normal",
      message: err.message || "Sorry, I encountered an error. Please try again.",
    });
  }
});

// ======================================================
// 💰 AI Spending Analysis route (OpenAI direct)
// ======================================================
const SYSTEM_PROMPT = `You are a cautious personal finance coach. You ONLY use the numeric data in the JSON 'snapshot' field. If a number is missing, say that it is missing. NEVER invent MYR amounts, percentages, or trends that are not directly present in the snapshot.

IMPORTANT: Use spendingTotals.spending (consumption spending) when analyzing spending behavior, NOT totalExpenses (which may include savings).
- If snapshot.totalIncome <= 0, do NOT compute savingsRate or debt-to-income ratios. Clearly state that the data is insufficient instead.
- If budgetSummary.totalBudget is 0 or every budgeted amount is 0, do NOT mention overspending relative to a budget because there is no baseline.

Your job:

1. Analyse their spending behaviour for that month:
   - Where is most of the money going? (use only the categories array from the snapshot, BUT exclude any "Savings" category from consumption analysis)
   - Which categories increased or decreased compared to last month? (use only changePctVsPrevMonth values from the snapshot)
   - Are they saving a healthy percentage? Use savingsSummary.savingsRate if available (based on actual contributions), otherwise use the top-level savingsRate.
   - If spendingTotals is available, note their consumption spending vs savings contributions separately.

2. Give 2–4 specific, realistic recommendations to improve their financial situation:
   - Focus on behaviour changes (for example: limits on a category, rules like "no food delivery on weekdays", or increasing savings contributions).
   - Use concrete numbers from the JSON where helpful (percentages, amounts).
   - If savingsSummary is available, reference their savings goals and progress.
   - If debtSummary is available, consider debt-to-income ratio and available savings when giving loan-related advice.
   - If totalIncome is 0 or very small, explain that you cannot meaningfully compute savings rate or deficits.

CRITICAL RULES:

- When discussing "spending", use spendingTotals.spending (consumption only), NOT totalExpenses.
- Savings contributions (spendingTotals.savingsContrib) are separate from consumption spending.
- You must not output any MYR amount or percentage that cannot be computed from the fields in the snapshot.
- If the snapshot looks inconsistent or has very small totals (e.g., totalIncome <= 0), comment on that instead of making up detailed insights.
- DO NOT invent numbers that are not present in the JSON.
- DO NOT recommend specific financial products, loans, investments, or brands.
- Do not talk about stocks, crypto, insurance products, or credit cards by name.
- It is okay to mention general concepts like "emergency fund", "high-interest debt", or "budgeting", but keep advice general.
- Do not promise outcomes or give legal/financial guarantees.
- Keep the total answer under 220 words.
- Use a friendly but direct tone, like a coach who wants the user to improve, not be comfortable.`;

app.post("/api/monthly-insights", async (req, res) => {
  try {
    if (!openai) {
      return res.status(500).json({ error: "OpenAI API key not configured" });
    }

    const { userId, monthKey: monthKeyBody } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }
    // TODO: replace this userId from request with a verified uid from auth middleware.

    const targetMonthKey =
      typeof monthKeyBody === "string" && monthKeyBody.length > 0
        ? monthKeyBody
        : getCurrentMonthKey();

    const snapshot = await buildMonthlySnapshotFromFirestore(userId, targetMonthKey);
    if (!snapshot) {
      return res.status(400).json({ error: "Unable to build snapshot for analysis" });
    }

    const income = snapshot.totalIncome || 0;
    const spending = snapshot.spendingTotals?.spending ?? 0;
    const totalBudget = snapshot.budgetSummary?.totalBudget ?? 0;
    const hasMeaningfulBudget = totalBudget > 0;

    const promptNotes = [];
    if (income <= 0) {
      promptNotes.push(
        "WARNING: totalIncome is 0 or negative. Do NOT compute savings rates or debt-to-income ratios. Explain clearly that meaningful ratios cannot be computed because income is 0 this month."
      );
    }

    if (Math.abs(income) < TINY_TOTAL_THRESHOLD && Math.abs(spending) < TINY_TOTAL_THRESHOLD) {
      promptNotes.push(
        "NOTE: This month has very small totals (income and spending under 50 MYR). Make it clear that insights are based on very little data and may not be representative."
      );
    }

    if (!hasMeaningfulBudget) {
      promptNotes.push(
        "There is effectively no budget set (totalBudget is 0). Do NOT comment about overspending or underspending relative to a budget; instead, suggest setting up a budget first if helpful."
      );
    }

    const reminder =
      "Remember: You must not output any MYR amount or percentage that cannot be computed from the fields in the snapshot. " +
      "If income is 0, say so instead of trying to compute savingsRate or DTI. If the snapshot looks inconsistent or has very small totals, comment on that instead of making up detailed insights.";

    const noteBlock = promptNotes.length ? promptNotes.join("\n") + "\n\n" : "";
    const userPrompt = `${noteBlock}MonthlySnapshot JSON:\n${JSON.stringify(
      snapshot,
      null,
      2
    )}\n\n${reminder}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const insightsText = response.choices[0]?.message?.content || "Unable to generate insights.";

    res.json({ insights: insightsText });
  } catch (err) {
    console.error("❌ OpenAI error:", err.response?.data || err.message);
    res.status(500).json({ error: err.message || "Failed to generate insights" });
  }
});

// ======================================================
// 🚀 Start server
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend running on http://localhost:${PORT}`));
