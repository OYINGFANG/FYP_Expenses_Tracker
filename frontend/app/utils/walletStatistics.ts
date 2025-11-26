// app/utils/walletStatistics.ts
import { IncomeRecord } from "./IncomeUtils";
import { ExpenseRecord } from "./ExpensesUtils";

export type TimePeriod = "weekly" | "monthly" | "yearly";

export interface Transaction {
  id: string;
  type: "income" | "expense";
  amount: number;
  category: string;
  description: string;
  dateISO: string;
  paymentMethod?: string;
}

export interface Statistics {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  averageDailyExpense: number;
  averageDailyIncome: number;
  budgetUsed?: number; // percentage if budget is provided
  incomeChange?: number; // percentage change from previous period
  expenseChange?: number; // percentage change from previous period
}

export interface ChartData {
  labels: string[];
  incomeData: number[];
  expenseData: number[];
}

/**
 * Combine income and expense records into transactions
 */
export const combineTransactions = (
  incomeRecords: IncomeRecord[],
  expenseRecords: ExpenseRecord[]
): Transaction[] => {
  const incomeTx: Transaction[] = incomeRecords.map((r) => ({
    id: `inc_${r.id}`,
    type: "income",
    amount: r.amount,
    category: r.category,
    description: r.description,
    dateISO: r.dateISO,
    paymentMethod: r.paymentMethod,
  }));

  const expenseTx: Transaction[] = expenseRecords.map((r) => ({
    id: `exp_${r.id}`,
    type: "expense",
    amount: r.amount,
    category: r.category,
    description: r.description,
    dateISO: r.dateISO,
    paymentMethod: r.paymentMethod,
  }));

  return [...incomeTx, ...expenseTx].sort((a, b) =>
    (b.dateISO || "").localeCompare(a.dateISO || "")
  );
};

/**
 * Filter transactions by date range
 */
const filterByDateRange = (
  transactions: Transaction[],
  startDate: Date,
  endDate: Date
): Transaction[] => {
  return transactions.filter((tx) => {
    if (!tx.dateISO) return false;
    const txDate = new Date(tx.dateISO);
    return txDate >= startDate && txDate <= endDate;
  });
};

/**
 * Get date range for time period
 */
export const getDateRange = (period: TimePeriod): { start: Date; end: Date } => {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();

  switch (period) {
    case "weekly":
      // Last 7 days (including today)
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case "monthly":
      // Current month from day 1 to today
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case "yearly":
      // Current year from January 1st to today
      start.setMonth(0);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
  }

  return { start, end };
};

/**
 * Get previous period date range for comparison
 */
const getPreviousDateRange = (period: TimePeriod): { start: Date; end: Date } => {
  const end = new Date();
  const start = new Date();

  switch (period) {
    case "weekly":
      // Previous 7 days (before this week)
      end.setDate(end.getDate() - 7);
      end.setHours(23, 59, 59, 999);
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case "monthly":
      // Previous month
      start.setMonth(end.getMonth() - 1);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setDate(0); // Last day of previous month
      end.setHours(23, 59, 59, 999);
      break;
    case "yearly":
      // Previous year
      start.setFullYear(end.getFullYear() - 1);
      start.setMonth(0);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setFullYear(end.getFullYear() - 1);
      end.setMonth(11);
      end.setDate(31);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end };
};

/**
 * Calculate statistics for a given time period
 */
export const calculateStatistics = (
  incomeRecords: IncomeRecord[],
  expenseRecords: ExpenseRecord[],
  period: TimePeriod = "monthly",
  monthlyBudget?: number
): Statistics => {
  const { start, end } = getDateRange(period);
  const { start: prevStart, end: prevEnd } = getPreviousDateRange(period);

  // Filter current period
  const currentIncome = incomeRecords.filter((r) => {
    if (!r.dateISO) return false;
    const date = new Date(r.dateISO);
    return date >= start && date <= end;
  });

  const currentExpense = expenseRecords.filter((r) => {
    if (!r.dateISO) return false;
    const date = new Date(r.dateISO);
    return date >= start && date <= end;
  });

  // Filter previous period for comparison
  const previousIncome = incomeRecords.filter((r) => {
    if (!r.dateISO) return false;
    const date = new Date(r.dateISO);
    return date >= prevStart && date <= prevEnd;
  });

  const previousExpense = expenseRecords.filter((r) => {
    if (!r.dateISO) return false;
    const date = new Date(r.dateISO);
    return date >= prevStart && date <= prevEnd;
  });

  // Calculate totals
  const totalIncome = currentIncome.reduce((sum, r) => sum + r.amount, 0);
  const totalExpense = currentExpense.reduce((sum, r) => sum + r.amount, 0);
  const balance = totalIncome - totalExpense;

  // Calculate days in period
  const daysInPeriod = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1;
  const averageDailyExpense = totalExpense / daysInPeriod;
  const averageDailyIncome = totalIncome / daysInPeriod;

  // Calculate percentage changes
  const prevTotalIncome = previousIncome.reduce((sum, r) => sum + r.amount, 0);
  const prevTotalExpense = previousExpense.reduce((sum, r) => sum + r.amount, 0);

  const incomeChange =
    prevTotalIncome > 0 ? ((totalIncome - prevTotalIncome) / prevTotalIncome) * 100 : 0;
  const expenseChange =
    prevTotalExpense > 0 ? ((totalExpense - prevTotalExpense) / prevTotalExpense) * 100 : 0;

  // Calculate budget used
  const budgetUsed = monthlyBudget && monthlyBudget > 0 ? (totalExpense / monthlyBudget) * 100 : undefined;

  return {
    totalIncome,
    totalExpense,
    balance,
    averageDailyExpense,
    averageDailyIncome,
    budgetUsed,
    incomeChange,
    expenseChange,
  };
};

/**
 * Generate chart data for a time period
 */
export const generateChartData = (
  incomeRecords: IncomeRecord[],
  expenseRecords: ExpenseRecord[],
  period: TimePeriod = "weekly"
): ChartData => {
  const { start, end } = getDateRange(period);

  // Filter records
  const filteredIncome = incomeRecords.filter((r) => {
    if (!r.dateISO) return false;
    const date = new Date(r.dateISO);
    return date >= start && date <= end;
  });

  const filteredExpense = expenseRecords.filter((r) => {
    if (!r.dateISO) return false;
    const date = new Date(r.dateISO);
    return date >= start && date <= end;
  });

  if (period === "weekly") {
    // Group by day of week
    const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const incomeData = new Array(7).fill(0);
    const expenseData = new Array(7).fill(0);

    filteredIncome.forEach((r) => {
      const date = new Date(r.dateISO);
      const dayOfWeek = date.getDay();
      const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Sunday = 6, Monday = 0
      if (adjustedDay >= 0 && adjustedDay < 7) {
        incomeData[adjustedDay] += r.amount;
      }
    });

    filteredExpense.forEach((r) => {
      const date = new Date(r.dateISO);
      const dayOfWeek = date.getDay();
      const adjustedDay = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      if (adjustedDay >= 0 && adjustedDay < 7) {
        expenseData[adjustedDay] += r.amount;
      }
    });

    return { labels, incomeData, expenseData };
  } else if (period === "monthly") {
    // Group by week (4-5 weeks)
    const weeks: Date[][] = [];
    const current = new Date(start);
    while (current <= end) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (weekEnd > end) weekEnd.setTime(end.getTime());
      weeks.push([weekStart, weekEnd]);
      current.setDate(current.getDate() + 7);
    }

    const labels = weeks.map((_, i) => `Week ${i + 1}`);
    const incomeData = weeks.map(([weekStart, weekEnd]) => {
      return filteredIncome
        .filter((r) => {
          const date = new Date(r.dateISO);
          return date >= weekStart && date <= weekEnd;
        })
        .reduce((sum, r) => sum + r.amount, 0);
    });

    const expenseData = weeks.map(([weekStart, weekEnd]) => {
      return filteredExpense
        .filter((r) => {
          const date = new Date(r.dateISO);
          return date >= weekStart && date <= weekEnd;
        })
        .reduce((sum, r) => sum + r.amount, 0);
    });

    return { labels, incomeData, expenseData };
  } else {
    // Yearly - group by month (only up to current month)
    const currentMonth = new Date().getMonth();
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    
    const labels = monthNames.slice(0, currentMonth + 1);
    const incomeData = new Array(currentMonth + 1).fill(0);
    const expenseData = new Array(currentMonth + 1).fill(0);

    filteredIncome.forEach((r) => {
      const date = new Date(r.dateISO);
      const month = date.getMonth();
      if (month >= 0 && month <= currentMonth) {
        incomeData[month] += r.amount;
      }
    });

    filteredExpense.forEach((r) => {
      const date = new Date(r.dateISO);
      const month = date.getMonth();
      if (month >= 0 && month <= currentMonth) {
        expenseData[month] += r.amount;
      }
    });

    return { labels, incomeData, expenseData };
  }
};

/**
 * Format currency
 */
export const formatCurrency = (amount: number): string => {
  return `RM ${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Format date for display
 */
export const formatTransactionDate = (dateISO: string): string => {
  const date = new Date(dateISO);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today, ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  } else if (diffDays === 1) {
    return `Yesterday, ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
};

/**
 * Get category emoji
 */
export const getCategoryEmoji = (category: string): string => {
  const categoryMap: Record<string, string> = {
    Food: "🍽️",
    Restaurant: "🍽️",
    Transport: "🚕",
    Transportation: "🚕",
    Shopping: "🛍️",
    Entertainment: "🎬",
    Bills: "📄",
    Utilities: "💡",
    Healthcare: "🏥",
    Education: "📚",
    Salary: "💼",
    Freelance: "💻",
    Investment: "📈",
    Gift: "🎁",
    Other: "💰",
  };

  return categoryMap[category] || "💰";
};
