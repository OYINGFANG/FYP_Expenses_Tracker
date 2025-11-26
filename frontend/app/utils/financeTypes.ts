// app/utils/financeTypes.ts
// Shared types for financial data analysis

export interface ExpenseRecord {
  id: string;
  amount: number;
  category: string;
  dateISO: string;
  description: string;
  paymentMethod?: string;
}

export interface IncomeRecord {
  id: string;
  amount: number;
  category: string;
  dateISO: string;
  description: string;
  paymentMethod?: string;
}

// Debt type is exported from DebtUtils.ts - import from there instead

export type SpendingTotals = {
  income: number;          // same as totalIncome
  spending: number;        // consumption spend only (excludes savings contributions)
  savingsContrib: number;  // money actively moved into savings this month
  netCashFlow: number;     // income - (spending + savingsContrib)
};

export type SavingsSummary = {
  savingsContrib: number;         // total contributions this month
  savingsRate: number;            // savingsContrib / income (0–1)
  goalsCount: number;             // number of active savings goals
  totalGoalTarget: number;        // sum of target_amount across goals
  totalGoalCurrent: number;       // sum of current_amount across goals
  emergencyFundMonths?: number | null; // optional: estimated months of expenses covered (if you can compute from a specific goal)
};

export type DebtSummary = {
  totalDebt: number;              // already computed in backend builder
  totalMonthlyDebtPayment: number; // same as monthlyDebtPayments
  debtToIncomeRatio: number | null; // totalMonthlyDebtPayment / income, or null if income = 0
  debtsCount: number;
};

export type BudgetCategorySummary = {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;      // actual - budgeted
  varianceRate: number | null; // variance / budgeted
};

export type BudgetSummary = {
  totalBudget: number;
  totalActual: number;
  categories: BudgetCategorySummary[];
};

export interface MonthlySnapshot {
  userId: string;
  monthKey: string; // e.g. "2025-11"
  currency: string; // e.g. "MYR"

  totalIncome: number;
  totalExpenses: number;
  savings: number;
  savingsRate: number; // 0.18 = 18%

  categories: {
    name: string;
    amount: number;
    changePctVsPrevMonth: number | null; // null if no previous month
  }[];

  // Optional debt-related fields
  debtHealthScore?: number;
  totalDebt?: number;
  monthlyDebtPayments?: number;

  // New fields (optional for backward compatibility)
  spendingTotals?: SpendingTotals;
  savingsSummary?: SavingsSummary;
  debtSummary?: DebtSummary;
  budgetSummary?: BudgetSummary;
}

