// app/services/budgetRecommendation.ts
import type { Expense } from "./types";

const recommendedAllocation: Record<string, number> = {
  Housing: 0.30,
  Food: 0.12,
  Transportation: 0.10,
  Utilities: 0.08,
  Healthcare: 0.06,
  Entertainment: 0.05,
  Shopping: 0.05,
  Savings: 0.20,
  Others: 0.04,
};

export class BudgetRecommendationService {
  recommendBudget(expenses: Expense[], monthlyBudget: number): Record<string, number> {
    const initial: Record<string, number> = {};
    for (const [cat, pct] of Object.entries(recommendedAllocation)) {
      initial[cat] = round2(monthlyBudget * pct);
    }

    const recs: Record<string, number> = { ...initial };

    if (expenses.length > 0) {
      const totals = this.getCategoryTotals(expenses);

      // adjust existing categories
      for (const [cat, spent] of Object.entries(totals)) {
        if (recs[cat] !== undefined) {
          const recommended = initial[cat];
          if (spent > recommended * 1.2) {
            recs[cat] = recommended;
          } else if (spent < recommended) {
            recs[cat] = spent;
          }
        }
      }

      // add new categories
      for (const [cat, spent] of Object.entries(totals)) {
        if (recs[cat] === undefined) recs[cat] = spent;
      }
    }

    // normalize to monthlyBudget
    let totalRec = Object.values(recs).reduce((s, v) => s + v, 0);
    if (Math.abs(totalRec - monthlyBudget) > 0.01) {
      const factor = monthlyBudget / totalRec;
      const normalized: Record<string, number> = {};
      for (const [cat, amt] of Object.entries(recs)) normalized[cat] = round2(amt * factor);

      const adjustedTotal = Object.values(normalized).reduce((s, v) => s + v, 0);
      const diff = round2(monthlyBudget - adjustedTotal);

      if (Math.abs(diff) > 0.01) {
        const adjustCat = normalized["Others"] !== undefined
          ? "Others"
          : Object.entries(normalized).sort((a, b) => b[1] - a[1])[0][0];
        normalized[adjustCat] = round2((normalized[adjustCat] || 0) + diff);
      }
      return normalized;
    }
    return recs;
  }

  generateInsights(expenses: Expense[], monthlyBudget: number): string[] {
    const insights: string[] = [];
    if (expenses.length === 0) {
      insights.push("Start tracking your expenses to receive personalized recommendations.");
      return insights;
    }

    const totals = this.getCategoryTotals(expenses);
    const totalSpend = Object.values(totals).reduce((s, v) => s + v, 0);

    if (totalSpend > monthlyBudget) {
      insights.push(`You're currently over budget by RM ${round2(totalSpend - monthlyBudget).toFixed(2)}`);
    } else {
      insights.push(`You're under budget by RM ${round2(monthlyBudget - totalSpend).toFixed(2)}`);
    }

    const highest = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
    if (highest) {
      const [cat, amt] = highest;
      insights.push(`Your highest spending category is ${cat} at RM ${round2(amt).toFixed(2)}`);
      if (recommendedAllocation[cat] !== undefined) {
        const recommendedAmt = monthlyBudget * recommendedAllocation[cat];
        if (amt > recommendedAmt * 1.2) {
          insights.push(`Consider reducing spending on ${cat} by RM ${round2(amt - recommendedAmt).toFixed(2)}`);
        }
      }
    }

    // category not used
    const unused = Object.keys(recommendedAllocation).find(
      (c) => c !== "Savings" && totals[c] === undefined
    );
    if (unused) {
      insights.push(
        `You haven't allocated any budget to ${unused}. Consider setting aside RM ${(monthlyBudget * recommendedAllocation[unused]).toFixed(2)}.`
      );
    }

    if (totals["Savings"] === undefined) {
      insights.push(`Consider setting aside 20% of your budget (RM ${(monthlyBudget * 0.2).toFixed(2)}) for savings and emergencies.`);
    }

    return insights;
  }

  private getCategoryTotals(expenses: Expense[]): Record<string, number> {
    return expenses.reduce<Record<string, number>>((acc, e) => {
      const cat = e.category || "Others";
      acc[cat] = (acc[cat] ?? 0) + (e.amount || 0);
      return acc;
    }, {});
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
