// --- 1) NEW TYPE: Income -----------------------------------
export type Income = {
  id?: string;
  userId: string;
  amount: number;
  cadence: "weekly" | "biweekly" | "semimonthly" | "monthly" | "irregular";
  source?: string;
  nextPayDate?: string;
};

// --- 2) EXTEND AnalyseOptions --------------------------------
export type AnalyseOptions = {
  monthlyBudget?: number;
  today?: Date;
  monthsLookback?: number;
  allocations?: Record<string, number>;
  fixedCategories?: string[];
  incomes?: Income[];
  liquidSavingsRM?: number;
};

// --- 3) HELPER: normalize income to monthly RM ---------------
function incomeToMonthlyRM(incomes: Income[] = []): number {
  const cadenceMultiplier: Record<Income["cadence"], number> = {
    weekly: 52 / 12,
    biweekly: 26 / 12,
    semimonthly: 2,
    monthly: 1,
    irregular: 1,
  };
  return incomes.reduce((total, income) => {
    const amount = Math.max(0, Number(income.amount) || 0);
    return total + amount * cadenceMultiplier[income.cadence];
  }, 0);
}












export type Expense = {
  id?: string;
  userId: string;
  amount: number;             // > 0
  category?: string;          // e.g., "Food"
  description?: string;       // note / merchant text
  merchantName?: string;      // if you store merchant separately
  date?: string;              // ISO yyyy-mm-dd or any parseable date
};

// NEW: tiny per-category monthly plan 
export type EnvelopePlan = Record<string, { planned: number; fixed?: boolean }>;

// Mild default: which categories are "fixed" (must-pay) — tweak as you like
const DEFAULT_FIXED_CATEGORIES = ["Housing", "Bills", "Healthcare", "Education", "Transport"];

// Build a plan from your budget.allocations map
export function planFromAllocations(
  allocations: Record<string, number> | undefined,
  fixedCategories: string[] = DEFAULT_FIXED_CATEGORIES
): EnvelopePlan | undefined {
  if (!allocations) return undefined;
  const plan: EnvelopePlan = {};
  for (const [cat, amt] of Object.entries(allocations)) {
    plan[cat] = { planned: Math.max(0, Number(amt) || 0), fixed: fixedCategories.includes(cat) };
  }
  return plan;
}

export function sumPlanned(plan?: EnvelopePlan) {
  if (!plan) return 0;
  return Object.values(plan).reduce((a, v) => a + (v?.planned ?? 0), 0);
}

// Bill coverage: sum(actual in fixed cats) / sum(planned fixed)
function computeBillCoverage(monthByCategory: Record<string, number>, plan?: EnvelopePlan) {
  if (!plan) return undefined;
  let plannedFixed = 0, actualFixed = 0;
  for (const [cat, cfg] of Object.entries(plan)) {
    if (cfg.fixed) {
      plannedFixed += cfg.planned || 0;
      actualFixed += monthByCategory[cat] || 0;
    }
  }
  if (plannedFixed <= 0) return undefined;
  return actualFixed / plannedFixed; // 1.0 = 100%
}

// Per-category remaining (planned − actual)
function computeRemaining(monthByCategory: Record<string, number>, plan?: EnvelopePlan) {
  const remaining: Record<string, number> = {};
  if (!plan) return remaining;
  for (const [cat, cfg] of Object.entries(plan)) {
    remaining[cat] = (cfg.planned ?? 0) - (monthByCategory[cat] ?? 0);
  }
  return remaining;
}

export type BehaviourInsight = {
  type:
    | "overspend-category"
    | "underspend-category"
    | "category-volatility"
    | "category-drift"
    | "merchant-concentration"
    | "recurring-merchant"
    | "big-ticket-outlier"
    | "month-on-month-trend"
    | "burn-rate-warning"
    | "healthy-pattern"
    | "data-quality"
    | "spending-pattern"
    | "savings-opportunity"
    // NEW:
    | "bill-coverage"
    | "forecast-overshoot";
  message: string;
  details?: Record<string, any>;
  severity?: "info" | "warning" | "critical";
  icon?: string; // Optional icon identifier
  actionable?: boolean; // Whether user can take action
};

export type BehaviourReport = {
  monthKey: string; // current month analyzed
  totals: {
    monthTotal: number;
    monthByCategory: Record<string, number>;
    lastMonthTotal?: number;
    trendMoM?: number; // percentage change vs last month
  };
  stats: {
    volatilityByCategory: Record<string, number>; // stdev/mean across months
    concentrationTopMerchant?: { merchant: string; share: number };
    recurringMerchants: { merchant: string; times: number; cadence: "weekly" | "monthly" | "irregular" }[];
  };
  outliers: { id?: string; amount: number; category?: string; merchant?: string; zScore: number }[];
  insights: BehaviourInsight[];
};

// ------------- Public API -------------
export function analyzeSpendingBehavior(
  rawExpenses: Expense[],
  opts: AnalyseOptions = {}
): BehaviourReport {
  const now = opts.today ?? new Date();
  const monthsLookback = clamp(opts.monthsLookback ?? 3, 2, 12);
  const monthKeyNow = monthKey(now);

  // normalize and filter expenses
  const expenses = rawExpenses
    .filter(e => {
      if (!isFinite(e.amount) || e.amount <= 0 || !e.date) return false;
      const date = safeDate(e.date);
      return !isNaN(date.getTime());
    })
    .map(e => {
      const expenseDate = safeDate(e.date!);
      return {
        ...e,
        category: (e.category || "Others").trim(),
        merchant: normalizedMerchant(e),
        ts: expenseDate.getTime(),
        monthKey: monthKey(expenseDate),
      };
    })
    .sort((a, b) => a.ts - b.ts);

  console.log(`[Behavior Analysis] Processing ${expenses.length} expenses for user`);
  console.log(`[Behavior Analysis] Current month key: ${monthKeyNow}`);
  console.log(`[Behavior Analysis] Expense month keys:`, [...new Set(expenses.map(e => e.monthKey))]);

  const insights: BehaviourInsight[] = [];
  if (expenses.length === 0) {
    return {
      monthKey: monthKeyNow,
      totals: { monthTotal: 0, monthByCategory: {} },
      stats: { volatilityByCategory: {}, recurringMerchants: [] },
      outliers: [],
      insights: [{
        type: "data-quality",
        message: "No expenses found. Track spending to unlock behaviour insights.",
        severity: "info",
      }],
    };
  }

  // Build plan from allocations (if provided)
  const plan = planFromAllocations(opts.allocations, opts.fixedCategories);
  const plannedTotal = sumPlanned(plan);

  // group by month
  const byMonth = groupBy(expenses, e => e.monthKey);
  const lastMonths = lastN(Object.keys(byMonth).sort(), monthsLookback);

  // month totals
  const monthNowExpenses = byMonth[monthKeyNow] ?? [];
  const monthTotal = sum(monthNowExpenses.map(e => e.amount));
  const monthByCategory = sumByKey(monthNowExpenses, e => e.category!, e => e.amount);

  const monthlyIncome = incomeToMonthlyRM(opts.incomes || []);
  if (monthlyIncome > 0) {
    const netCashflow = monthlyIncome - monthTotal;
    const savingsRate = netCashflow / monthlyIncome;
    const pctStr = (x:number)=> (x*100).toFixed(0);

    insights.push({
      type: "savings-opportunity",
      message: savingsRate >= 0
        ? `Savings rate: ${pctStr(savingsRate)}% this month.`
        : `Negative savings rate ${pctStr(-savingsRate)}% — spending exceeds income.`,
      severity: savingsRate < 0 ? "critical" : savingsRate < 0.1 ? "warning" : "info",
      details: { monthlyIncome, monthTotal, netCashflow, savingsRate },
      icon: savingsRate < 0 ? "🛑" : "💰",
      actionable: savingsRate < 0,
    });
  }

  if (typeof opts.liquidSavingsRM === "number" && opts.liquidSavingsRM > 0) {
    const monthlyBurn = Math.max(1, monthTotal);
    const runwayMonths = opts.liquidSavingsRM / monthlyBurn;

    insights.push({
      type: "healthy-pattern",
      message: `Cash runway: ${runwayMonths.toFixed(1)} months at current burn.`,
      severity: runwayMonths < 1.5 ? "warning" : "info",
      details: { liquidSavingsRM: opts.liquidSavingsRM, monthlyBurn, runwayMonths },
      icon: "⏳",
    });
  }

  // last month comparison
  const monthPrev = prevMonthKey(monthKeyNow);
  const lastMonthTotal = sum((byMonth[monthPrev] ?? []).map(e => e.amount));
  const trendMoM = lastMonthTotal > 0 ? (monthTotal - lastMonthTotal) / lastMonthTotal : undefined;
  if (trendMoM !== undefined) {
    const pct = (trendMoM * 100).toFixed(1);
    insights.push({
      type: "month-on-month-trend",
      message: trendMoM >= 0
        ? `Spending is up ${pct}% vs last month.`
        : `Spending is down ${Math.abs(parseFloat(pct)).toFixed(1)}% vs last month.`,
      severity: trendMoM > 0.15 ? "warning" : "info",
      details: { monthTotal, lastMonthTotal, trendMoM },
    });
  }

  // volatility across months per category (stdev/mean of monthly totals)
  const monthlyCatSeries: Record<string, number[]> = {};
  for (const mk of lastMonths) {
    const catTotals = sumByKey(byMonth[mk] ?? [], e => e.category!, e => e.amount);
    for (const [cat, amt] of Object.entries(catTotals)) {
      (monthlyCatSeries[cat] ??= []).push(amt);
    }
  }
  const volatilityByCategory: Record<string, number> = {};
  for (const [cat, series] of Object.entries(monthlyCatSeries)) {
    if (series.length >= 2) {
      const m = mean(series);
      const sd = stdev(series);
      volatilityByCategory[cat] = m > 0 ? sd / m : 0; // coefficient of variation
      if (volatilityByCategory[cat] > 0.6) {
        insights.push({
          type: "category-volatility",
          message: `Spending in ${cat} is highly volatile (cv=${volatilityByCategory[cat].toFixed(2)}).`,
          severity: "info",
          details: { series },
        });
      }
    }
  }

  // category drift this month vs 3-month average
  const lookbackTotals = sumByKey(
    expenses.filter(e => isWithinLastMonths(e.ts, now, monthsLookback)), e => e.category!, e => e.amount
  );
  const monthsCount = distinct(lastMonths.filter(mk => byMonth[mk]?.length)).length || 1;
  const avgCat = mapValues(lookbackTotals, v => v / monthsCount);
  for (const [cat, thisMonth] of Object.entries(monthByCategory)) {
    const avg = avgCat[cat] ?? 0;
    if (avg > 0) {
      const diff = (thisMonth - avg) / avg;
      if (diff > 0.25) {
        insights.push({
          type: "category-drift",
          message: `${cat} is ${Math.round(diff * 100)}% higher than your ${monthsCount}-month average.`,
          severity: "warning",
          details: { thisMonth, avg },
        });
      } else if (diff < -0.25) {
        insights.push({
          type: "underspend-category",
          message: `${cat} is ${Math.round(Math.abs(diff) * 100)}% lower than usual.`,
          severity: "info",
          details: { thisMonth, avg },
        });
      }
    } else if (thisMonth > 0) {
      insights.push({
        type: "category-drift",
        message: `New spending emerged in ${cat} this month.`,
        severity: "info",
      });
    }
  }

  // merchant concentration (this month)
  const byMerchant = sumByKey(monthNowExpenses, e => e.merchant || "Unknown", e => e.amount);
  const merchantsSorted = Object.entries(byMerchant).sort((a,b)=>b[1]-a[1]);
  if (merchantsSorted.length > 0) {
    const [topMerchant, topAmt] = merchantsSorted[0];
    const share = topAmt / Math.max(1, monthTotal);
    if (share >= 0.4 && topAmt >= 100) {
      insights.push({
        type: "merchant-concentration",
        message: `Heavy concentration: ${topMerchant} accounts for ${(share*100).toFixed(0)}% of this month's spend.`,
        severity: "warning",
        details: { topMerchant, share },
      });
    }
  }

  // recurring merchants (≥3 purchases spaced weekly/monthly-ish)
  const recurring = detectRecurringMerchants(expenses, now);
  for (const r of recurring) {
    insights.push({
      type: "recurring-merchant",
      message: `Recurring spend detected: ${r.merchant} (${r.times} times, ${r.cadence}).`,
      severity: "info",
      details: r,
    });
  }

  // outliers by category using z-score
  const outliers = detectOutliersByCategory(monthNowExpenses);
  for (const o of outliers) {
    insights.push({
      type: "big-ticket-outlier",
      message: `Unusually large ${o.category ?? "purchase"}: RM ${o.amount.toFixed(2)} (z=${o.zScore.toFixed(2)}).`,
      severity: "warning",
      details: o,
    });
  }

  // ---------------------------
  // NEW: Plan-aware insights
  // ---------------------------
  if (plan) {
    // 1) Bill Coverage %
    const coverage = computeBillCoverage(monthByCategory, plan);
    if (coverage !== undefined && coverage < 1) {
      insights.push({
        type: "bill-coverage",
        message: `Bills funded at ${(coverage * 100).toFixed(0)}% — risk of missed payments.`,
        severity: coverage < 0.8 ? "critical" : "warning",
        details: { coverage, plannedFixed: "sum(planned for fixed categories)" },
        icon: "🧾",
        actionable: true,
      });
    }

    // 2) Overspend vs plan (per category)
    const remaining = computeRemaining(monthByCategory, plan);
    Object.entries(remaining)
      .filter(([, rem]) => rem < 0)
      .sort((a,b)=>a[1]-b[1]) // most negative first
      .slice(0, 3) // keep top few
      .forEach(([cat, rem]) => {
        const reduction = Math.abs(rem);
        insights.push({
          type: "overspend-category",
          message: `Over ${cat} plan by RM ${reduction.toFixed(2)}. Trim this category.`,
          severity: "warning",
          details: { category: cat, overBy: reduction, planned: plan[cat]?.planned || 0, actual: monthByCategory[cat] || 0 },
          icon: "🔴",
          actionable: true,
        });
      });

    // 3) Forecast overshoot vs planned total
    const daysInMonth = getDaysInMonth(now);
    const day = now.getDate();
    const daysRemaining = daysInMonth - day;
    const avgDailySpend = monthTotal / Math.max(1, day);
    const projectedMonthEnd = monthTotal + (avgDailySpend * daysRemaining);
    if (plannedTotal > 0 && projectedMonthEnd > plannedTotal * 1.02) {
      const delta = projectedMonthEnd - plannedTotal;
      insights.push({
        type: "forecast-overshoot",
        message: `Projected to exceed plan by RM ${delta.toFixed(2)} (by month-end).`,
        severity: "warning",
        details: { projectedMonthEnd, plannedTotal, avgDailySpend, day, daysRemaining },
        icon: "🔭",
        actionable: true,
      });
    }
  }

  // burn-rate vs single-number monthly budget (kept from your original)
  if (opts.monthlyBudget && opts.monthlyBudget > 0) {
    const daysInMonth = getDaysInMonth(now);
    const day = now.getDate();
    const planned = (opts.monthlyBudget / daysInMonth) * day;
    const budgetUtilization = (monthTotal / opts.monthlyBudget) * 100;
    const daysRemaining = daysInMonth - day;
    const avgDailySpend = monthTotal / Math.max(1, day);
    const projectedMonthEnd = monthTotal + (avgDailySpend * daysRemaining);
    
    if (monthTotal > planned * 1.15) {
      insights.push({
        type: "burn-rate-warning",
        message: `You're spending ${((monthTotal / planned - 1) * 100).toFixed(0)}% faster than planned. At this rate, you'll exceed your budget by RM ${Math.max(0, projectedMonthEnd - opts.monthlyBudget).toFixed(2)}.`,
        severity: "critical",
        details: { monthTotal, planned, day, budgetUtilization, projectedMonthEnd },
      });
    } else if (budgetUtilization > 80) {
      insights.push({
        type: "burn-rate-warning",
        message: `You've used ${budgetUtilization.toFixed(0)}% of your monthly budget with ${daysRemaining} days remaining.`,
        severity: "warning",
        details: { monthTotal, planned, day, budgetUtilization },
      });
    } else if (monthTotal <= planned * 0.85) {
      insights.push({
        type: "healthy-pattern",
        message: `Great! You're ${((1 - monthTotal / planned) * 100).toFixed(0)}% under planned spending. Keep it up!`,
        severity: "info",
        details: { monthTotal, planned, day },
      });
    } else {
      insights.push({
        type: "healthy-pattern",
        message: `Spending pace is healthy. You've used ${budgetUtilization.toFixed(0)}% of your budget so far.`,
        severity: "info",
        details: { monthTotal, planned, day },
      });
    }
  }

  // Spending patterns: weekend vs weekday
  const weekdaySpend = monthNowExpenses
    .filter(e => {
      const d = new Date(e.ts);
      const day = d.getDay();
      return day >= 1 && day <= 5; // Mon-Fri
    })
    .reduce((sum, e) => sum + e.amount, 0);
  const weekendSpend = monthNowExpenses
    .filter(e => {
      const d = new Date(e.ts);
      const day = d.getDay();
      return day === 0 || day === 6; // Sat-Sun
    })
    .reduce((sum, e) => sum + e.amount, 0);
  
  if (weekendSpend > weekdaySpend * 1.5 && monthTotal > 500) {
    insights.push({
      type: "category-volatility",
      message: `You spend ${((weekendSpend / weekdaySpend - 1) * 100).toFixed(0)}% more on weekends. Consider planning weekend activities to control spending.`,
      severity: "info",
      details: { weekdaySpend, weekendSpend },
    });
  }

  // Category balance insights
  const topCategories = Object.entries(monthByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  if (topCategories.length > 0) {
    const topCategoryShare = (topCategories[0][1] / Math.max(1, monthTotal)) * 100;
    if (topCategoryShare > 50) {
      insights.push({
        type: "category-drift",
        message: `${topCategories[0][0]} accounts for ${topCategoryShare.toFixed(0)}% of your spending. Consider diversifying your expenses.`,
        severity: "warning",
        details: { category: topCategories[0][0], share: topCategoryShare },
      });
    }
  }

  // Daily average insights
  const avgDailySpend = monthTotal / Math.max(1, now.getDate());
  if (lastMonthTotal) {
    const lastMonthAvg = lastMonthTotal / 30; // approximate
    if (avgDailySpend > lastMonthAvg * 1.2) {
      insights.push({
        type: "month-on-month-trend",
        message: `Your daily average spending (RM ${avgDailySpend.toFixed(2)}) is ${((avgDailySpend / lastMonthAvg - 1) * 100).toFixed(0)}% higher than last month.`,
        severity: "warning",
        details: { avgDailySpend, lastMonthAvg },
      });
    }
  }

  // Budget status insight (high-level)
  if (opts.monthlyBudget && opts.monthlyBudget > 0) {
    const budgetDifference = opts.monthlyBudget - monthTotal;
    if (budgetDifference > 0) {
      insights.push({
        type: "healthy-pattern",
        message: `You're under budget by RM ${budgetDifference.toFixed(2)}.`,
        severity: "info",
        details: { monthTotal, monthlyBudget: opts.monthlyBudget, difference: budgetDifference },
        icon: "✅",
      });
    } else if (budgetDifference < 0) {
      insights.push({
        type: "burn-rate-warning",
        message: `You're over budget by RM ${Math.abs(budgetDifference).toFixed(2)}.`,
        severity: "critical",
        details: { monthTotal, monthlyBudget: opts.monthlyBudget, difference: budgetDifference },
        icon: "⚠️",
        actionable: true,
      });
    } else {
      insights.push({
        type: "healthy-pattern",
        message: `You're exactly on budget for this month.`,
        severity: "info",
        details: { monthTotal, monthlyBudget: opts.monthlyBudget },
        icon: "✅",
      });
    }
  }

  // Highest spending category
  if (Object.keys(monthByCategory).length > 0) {
    const sortedCategories = Object.entries(monthByCategory)
      .sort((a, b) => b[1] - a[1]);
    const [topCategory, topAmount] = sortedCategories[0];
    
    insights.push({
      type: "category-drift",
      message: `Your highest spending category is ${topCategory} at RM ${topAmount.toFixed(2)}.`,
      severity: "info",
      details: { category: topCategory, amount: topAmount },
      icon: "📊",
    });

    // Reduction recommendation vs recommended allocation (kept from your original)
    if (opts.monthlyBudget && opts.monthlyBudget > 0) {
      const recommendedAllocation: Record<string, number> = {
        Food: 13, Shopping: 6, Bills: 12, Entertainment: 4, Transport: 10,
        Healthcare: 7, Education: 2, Housing: 25, Savings: 20, Others: 1,
      };
      const recommendedPct = (recommendedAllocation[topCategory] ?? 10) / 100;
      const recommendedAmount = recommendedPct * opts.monthlyBudget;
      if (topAmount > recommendedAmount * 1.2) {
        const reductionAmount = topAmount - recommendedAmount;
        insights.push({
          type: "overspend-category",
          message: `Consider reducing spending on ${topCategory} by RM ${reductionAmount.toFixed(2)}.`,
          severity: "warning",
          details: { category: topCategory, current: topAmount, recommended: recommendedAmount, reduction: reductionAmount },
          icon: "🔴",
          actionable: true,
        });
      }
    }
  }

  // Missing category recommendation (kept)
  if (opts.monthlyBudget && opts.monthlyBudget > 0) {
    const recommendedAllocation: Record<string, number> = {
      Food: 13, Shopping: 6, Bills: 12, Entertainment: 4, Transport: 10,
      Healthcare: 7, Education: 2, Housing: 25, Savings: 20, Others: 1,
    };
    for (const [cat, pct] of Object.entries(recommendedAllocation)) {
      if (cat === "Others" || cat === "Housing" || cat === "Savings") continue;
      if (!monthByCategory[cat] || monthByCategory[cat] === 0) {
        const suggestedAmount = (pct / 100) * opts.monthlyBudget;
        insights.push({
          type: "underspend-category",
          message: `You haven't allocated any budget to ${cat}. Consider setting aside RM ${suggestedAmount.toFixed(2)}.`,
          severity: "info",
          details: { category: cat, suggestedAmount },
          icon: "💡",
          actionable: true,
        });
        break; // show one
      }
    }
  }

  // Savings recommendation (kept)
  if (opts.monthlyBudget && opts.monthlyBudget > 0) {
    const savingsPercentage = 0.20; // 20%
    const recommendedSavings = opts.monthlyBudget * savingsPercentage;
    const currentSavings = monthByCategory["Savings"] || 0;
    
    if (currentSavings === 0 || currentSavings < recommendedSavings * 0.5) {
      insights.push({
        type: "healthy-pattern",
        message: `Consider setting aside ${(savingsPercentage * 100).toFixed(0)}% of your budget (RM ${recommendedSavings.toFixed(2)}) for savings and emergencies.`,
        severity: "info",
        details: { recommendedSavings, currentSavings, percentage: savingsPercentage },
        icon: "💰",
        actionable: true,
      });
    }
  }

  // Savings opportunity (kept)
  if (opts.monthlyBudget && monthTotal < opts.monthlyBudget * 0.8) {
    const potentialSavings = opts.monthlyBudget - monthTotal;
    if (potentialSavings > 50) {
      insights.push({
        type: "healthy-pattern",
        message: `Excellent! You're under budget by RM ${potentialSavings.toFixed(2)}. Consider saving this amount!`,
        severity: "info",
        details: { potentialSavings },
        icon: "✅",
      });
    }
  }

  // Remove duplicate insights (same message)
  let uniqueInsights = dedupeMessages(insights);

  // Sort insights by priority - budget status and key insights first
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  
  const getInsightPriority = (insight: BehaviourInsight): number => {
    if (insight.type === "burn-rate-warning" && insight.message.includes("over budget")) return 0;
    if (insight.type === "healthy-pattern" && insight.message.includes("under budget")) return 1;
    if (insight.type === "healthy-pattern" && insight.message.includes("on budget")) return 2;
    if (insight.type === "category-drift" && insight.message.includes("highest spending category")) return 3;
    if (insight.type === "overspend-category" && insight.message.includes("Consider reducing")) return 4;
    if (insight.type === "underspend-category" && insight.message.includes("haven't allocated")) return 5;
    if (insight.type === "healthy-pattern" && insight.message.includes("Consider setting aside")) return 6;

    // NEW: lift plan-aware items a bit
    if (insight.type === "bill-coverage") return 1;            // high priority
    if (insight.type === "forecast-overshoot") return 4;       // action soon

    return 10 + (severityOrder[insight.severity || "info"] || 3);
  };

  // Sort: by priority, then by severity
  uniqueInsights.sort((a, b) => {
    const aPriority = getInsightPriority(a);
    const bPriority = getInsightPriority(b);
    if (aPriority !== bPriority) return aPriority - bPriority;
    const aSev = severityOrder[a.severity || "info"];
    const bSev = severityOrder[b.severity || "info"];
    return aSev - bSev;
  });

  // Add icons to insights if not already set
  uniqueInsights.forEach(insight => {
    if (!insight.icon) {
      switch (insight.type) {
        case "burn-rate-warning":
          insight.icon = "⚠️";
          if (!insight.actionable) insight.actionable = true;
          break;
        case "month-on-month-trend":
          insight.icon = "📈";
          break;
        case "category-drift":
          insight.icon = "📊";
          if (!insight.actionable) insight.actionable = true;
          break;
        case "merchant-concentration":
          insight.icon = "🏪";
          break;
        case "recurring-merchant":
          insight.icon = "🔄";
          break;
        case "big-ticket-outlier":
          insight.icon = "💸";
          break;
        case "healthy-pattern":
          insight.icon = "✅";
          break;
        case "category-volatility":
          insight.icon = "📉";
          break;
        case "overspend-category":
          insight.icon = "🔴";
          if (!insight.actionable) insight.actionable = true;
          break;
        case "underspend-category":
          insight.icon = "🟢";
          break;
        case "bill-coverage":
          insight.icon = "🧾";
          break;
        case "forecast-overshoot":
          insight.icon = "🔭";
          if (!insight.actionable) insight.actionable = true;
          break;
        default:
          insight.icon = "💡";
      }
    }
  });

  // compile
  console.log(`[Behavior Analysis] Generated ${uniqueInsights.length} insights for month ${monthKeyNow}`);
  console.log(`[Behavior Analysis] Month total: RM ${monthTotal.toFixed(2)}, Categories:`, Object.keys(monthByCategory).length);
  
  return {
    monthKey: monthKeyNow,
    totals: { monthTotal, monthByCategory, lastMonthTotal, trendMoM },
    stats: {
      volatilityByCategory,
      concentrationTopMerchant: merchantsSorted[0]
        ? { merchant: merchantsSorted[0][0], share: merchantsSorted[0][1] / Math.max(1, monthTotal) }
        : undefined,
      recurringMerchants: recurring,
    },
    outliers,
    insights: uniqueInsights,
  };
}

// ------------- helpers -------------
function normalizedMerchant(e: Expense): string {
  const m = (e.merchantName || e.description || "").trim();
  if (!m) return "Unknown";
  return m.replace(/\s+/g, " ").slice(0, 64);
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function prevMonthKey(mk: string) {
  const [y,m] = mk.split("-").map(Number);
  const d = new Date(y, m-2, 1); // JS month 0-based
  return monthKey(d);
}
function safeDate(anyDate: string | Date) {
  const d = (anyDate instanceof Date) ? anyDate : new Date(anyDate);
  return isNaN(d.getTime()) ? new Date() : d;
}
function getDaysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
}
function isWithinLastMonths(ts: number, now: Date, n: number) {
  const start = new Date(now.getFullYear(), now.getMonth() - (n-1), 1).getTime();
  return ts >= start;
}
function mapValues<T, U>(
  obj: Record<string, T>,
  fn: (v: T, k: string) => U
): Record<string, U> {
  const out: Record<string, U> = {};
  for (const k in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      out[k] = fn(obj[k], k);
    }
  }
  return out;
}
function sum(nums: number[]) { return nums.reduce((a,b)=>a+b,0); }
function mean(nums: number[]) { return nums.length ? sum(nums)/nums.length : 0; }
function stdev(nums: number[]) {
  if (nums.length < 2) return 0;
  const m = mean(nums); const v = mean(nums.map(x => (x-m)**2));
  return Math.sqrt(v);
}
function groupBy<T>(arr: T[], keyFn: (t:T)=>string) {
  return arr.reduce<Record<string,T[]>>((acc, t) => {
    const k = keyFn(t); (acc[k] ??= []).push(t); return acc;
  }, {});
}
function sumByKey<T>(arr: T[], keyFn: (t:T)=>string, valFn: (t:T)=>number) {
  return arr.reduce<Record<string, number>>((acc, t) => {
    const k = keyFn(t); acc[k] = (acc[k] ?? 0) + valFn(t); return acc;
  }, {});
}
function lastN<T>(arr: T[], n: number) { return arr.slice(Math.max(0, arr.length - n)); }
function distinct<T>(arr: T[]) { return Array.from(new Set(arr)); }
function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
function dedupeMessages(list: BehaviourInsight[]) {
  const seen = new Set<string>();
  return list.filter(x => {
    const sig = `${x.type}:${x.message}`;
    if (seen.has(sig)) return false;
    seen.add(sig); return true;
  });
}

// Outliers by category using z-score > 2
function detectOutliersByCategory(monthExpenses: any[]) {
  const byCat = groupBy(monthExpenses, e => e.category || "Others");
  const out: { id?: string; amount: number; category?: string; merchant?: string; zScore: number }[] = [];
  for (const [cat, items] of Object.entries(byCat)) {
    const amounts = items.map((e:any)=>e.amount);
    const m = mean(amounts), sd = stdev(amounts) || 1;
    for (const e of items) {
      const z = (e.amount - m) / sd;
      if (z > 2 && e.amount >= 50) {
        out.push({ id: e.id, amount: e.amount, category: cat, merchant: e.merchant, zScore: z });
      }
    }
  }
  return out.sort((a,b)=>b.amount-a.amount);
}

// Detect recurring merchants: ≥3 purchases, roughly weekly or monthly spacing
function detectRecurringMerchants(expenses: any[], now: Date) {
  const byM = groupBy(expenses, e => e.merchant || "Unknown");
  const recurring: { merchant: string; times: number; cadence: "weekly" | "monthly" | "irregular" }[] = [];
  for (const [merchant, items] of Object.entries(byM)) {
    if (!merchant || merchant === "Unknown") continue;
    if (items.length < 3) continue;
    const ts = (items as any[]).map(x => x.ts).sort((a,b)=>a-b);
    const deltas = ts.slice(1).map((t,i) => (t - ts[i]) / (1000*60*60*24)); // days
    const avgDelta = mean(deltas);
    const cadence = avgDelta > 20 && avgDelta < 40 ? "monthly" : (avgDelta > 5 && avgDelta < 10 ? "weekly" : "irregular");
    if (cadence !== "irregular") {
      recurring.push({ merchant, times: items.length, cadence });
    }
  }
  return recurring.sort((a,b)=>b.times-a.times).slice(0, 5);
}
