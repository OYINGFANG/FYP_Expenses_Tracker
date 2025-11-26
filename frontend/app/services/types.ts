// app/services/types.ts
export type Expense = {
  id?: string;
  userId: string;
  amount: number;          // positive
  category?: string;       // e.g., "Food"
  description?: string;    // note / merchant
  date?: string;           // ISO yyyy-mm-dd
};

export type Analysis = {
  totalSpending: number;
  remainingBudget: number;
  categoryBreakdown: Record<string, number>;
  insights: string[];
  budgetRecommendations: Record<string, number>;
};
