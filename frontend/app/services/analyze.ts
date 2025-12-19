// app/services/analyze.ts
import type { Expense, Analysis } from "./types";
import { BudgetRecommendationService } from "./budgetRecommendation";

const svc = new BudgetRecommendationService();

export function analyzeExpenses(expenses: Expense[], monthlyBudget: number): Analysis {
  const totalSpending = round2(expenses.reduce((s, e) => s + (e.amount || 0), 0));
  const categoryBreakdown = expenses.reduce<Record<string, number>>((acc, e) => {
    const cat = e.category || "Others";
    acc[cat] = round2((acc[cat] ?? 0) + (e.amount || 0));
    return acc;
  }, {});
  const insights = svc.generateInsights(expenses, monthlyBudget);
  const budgetRecommendations = svc.recommendBudget(expenses, monthlyBudget);

  return {
    totalSpending,
    remainingBudget: Math.max(0, round2(monthlyBudget - totalSpending)),
    categoryBreakdown,
    insights,
    budgetRecommendations,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
