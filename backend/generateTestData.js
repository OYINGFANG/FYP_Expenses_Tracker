/**
 * Comprehensive Test Data Generator for Auri Finance App
 * 
 * Generates realistic financial data for testing:
 * - Expenses and Income records (6 months)
 * - Savings Goals with contributions
 * - Debts with payment history
 * - Budget allocations
 * 
 * Usage:
 *   node generateTestData.js [userId1] [userId2]
 *   node generateTestData.js (uses default user IDs)
 */

require("dotenv").config();
const admin = require("firebase-admin");
const path = require("path");

// Initialize Firebase Admin
let db = null;
try {
  const serviceAccount = require("./auri-76581-firebase-adminsdk-fbsvc-1122c9b7d7.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  db = admin.firestore();
  console.log("✅ Firebase Admin initialized");
} catch (error) {
  console.error("❌ Firebase Admin initialization failed:", error.message);
  process.exit(1);
}

// ==================== CONFIGURATION ====================

const EXPENSE_CATEGORIES = [
  "Food", "Transport", "Housing", "Shopping", "Bills", 
  "Entertainment", "Healthcare", "Education", "Others"
];

const INCOME_CATEGORIES = [
  "Salary", "Investment", "Gift", "Freelance", "Bonus"
];

const PAYMENT_METHODS = ["Cash", "Bank", "Credit Card"];

// Malaysian Ringgit realistic amounts - more small amounts for realism
const EXPENSE_AMOUNTS = {
  Food: { 
    min: 5, 
    max: 150, 
    // More realistic small amounts for daily meals - prioritize small amounts
    common: [5, 8, 10, 12, 15, 18, 20, 22, 25, 28, 30, 35, 40, 45, 50, 60, 70, 80, 100, 120, 150],
    // Specific patterns for different meal types - more small amounts
    lunch: [5, 8, 10, 12, 15, 18, 20, 25, 30],
    dinner: [10, 15, 18, 20, 25, 30, 35, 40, 50, 60],
    grocery: [30, 50, 80, 100, 120, 150, 200, 250, 300],
    snack: [5, 8, 10, 12, 15, 18, 20]
  },
  Transport: { min: 5, max: 200, common: [5, 8, 10, 15, 20, 25, 30, 50, 80, 150] },
  Housing: { min: 800, max: 3500, common: [1200, 1500, 1800, 2200, 2800] },
  Shopping: { min: 10, max: 800, common: [15, 20, 25, 30, 50, 80, 100, 150, 250, 400, 600] },
  Bills: { min: 50, max: 500, common: [80, 120, 200, 300, 450] },
  Entertainment: { min: 10, max: 300, common: [15, 20, 25, 30, 50, 80, 120, 180, 250] },
  Healthcare: { min: 10, max: 500, common: [15, 20, 25, 30, 50, 100, 200, 350] },
  Education: { min: 50, max: 2000, common: [100, 200, 500, 800, 1200, 1800] },
  Others: { min: 5, max: 200, common: [5, 10, 15, 20, 25, 50, 100, 150] },
};

const INCOME_AMOUNTS = {
  Salary: { min: 4000, max: 12000, common: [5000, 6000, 7500, 9000, 10000] },
  Investment: { min: 200, max: 2000, common: [300, 500, 800, 1200, 1500] },
  Gift: { min: 50, max: 500, common: [100, 200, 300, 400] },
  Freelance: { min: 300, max: 3000, common: [500, 800, 1200, 2000, 2500] },
  Bonus: { min: 500, max: 5000, common: [1000, 2000, 3000, 4000] },
};

// Realistic merchant/description templates - more detailed for food
const MERCHANT_TEMPLATES = {
  Food: {
    lunch: [
      "Lunch - Nasi Lemak", "Lunch - Chicken Rice", "Lunch - Char Kuey Teow",
      "Lunch - Mee Goreng", "Lunch - Roti Canai", "Lunch - Curry Laksa",
      "Lunch - Hokkien Mee", "Lunch - Wanton Mee", "Lunch - Bak Kut Teh",
      "Lunch - Economy Rice", "Lunch - Mixed Rice", "Lunch - Nasi Kandar"
    ],
    dinner: [
      "Dinner - Steamboat", "Dinner - BBQ", "Dinner - Seafood",
      "Dinner - Japanese", "Dinner - Korean BBQ", "Dinner - Western",
      "Dinner - Chinese Restaurant", "Dinner - Thai Food", "Dinner - Indian",
      "Dinner - Pizza", "Dinner - Pasta", "Dinner - Family Meal"
    ],
    grocery: [
      "Grocery - Lotus's", "Grocery - Giant", "Grocery - Tesco",
      "Grocery - Aeon", "Grocery - Jaya Grocer", "Grocery - Village Grocer",
      "Grocery - 99 Speedmart", "Grocery - 7-Eleven", "Grocery - KK Mart"
    ],
    snack: [
      "Snack - Tealive", "Snack - Chatime", "Snack - Gong Cha",
      "Snack - Starbucks", "Snack - Coffee Bean", "Snack - Donut",
      "Snack - Ice Cream", "Snack - Pastry", "Snack - Kuih"
    ],
    general: [
      "McDonald's", "KFC", "Pizza Hut", "Domino's", "Subway",
      "Old Town White Coffee", "Mamak Stall", "GrabFood", "Foodpanda"
    ]
  },
  Transport: [
    "Grab", "Uber", "Petrol Station", "Toll", "Parking", "LRT", "MRT", 
    "Bus", "Taxi", "Car Service", "Motorcycle Service"
  ],
  Housing: [
    "Rent", "Utilities", "Maintenance", "Property Tax", "Home Insurance"
  ],
  Shopping: [
    "Uniqlo", "H&M", "Zara", "Sephora", "Guardian", "Watsons", "Popular Bookstore",
    "Harvey Norman", "Senheng", "Courts", "Lazada", "Shopee", "Amazon"
  ],
  Bills: [
    "Electricity (TNB)", "Water (SYABAS)", "Internet (TM/Unifi)", "Mobile (Maxis/Celcom)",
    "Insurance Premium", "Streaming (Netflix/Spotify)", "Phone Bill"
  ],
  Entertainment: [
    "Cinema (GSC/TGV)", "Concert", "Theme Park", "Karaoke", "Bowling", 
    "Arcade", "Concert Ticket", "Event Ticket"
  ],
  Healthcare: [
    "Clinic Visit", "Pharmacy", "Dental", "Optical", "Hospital", "Medicine",
    "Health Checkup", "Vaccination"
  ],
  Education: [
    "Tuition", "Course Fee", "Books", "Stationery", "Online Course", "Workshop"
  ],
  Others: [
    "Miscellaneous", "Donation", "Repair", "Service Fee", "Subscription"
  ],
};

// Savings Badge Definitions
const BADGE_DEFINITIONS = {
  first_goal_completed: {
    id: "first_goal_completed",
    title: "First Goal",
    description: "Completed your first savings goal",
    icon: "trophy",
  },
  three_goals_completed: {
    id: "three_goals_completed",
    title: "Triple Achievement",
    description: "Completed 3 savings goals",
    icon: "medal",
  },
  five_goals_completed: {
    id: "five_goals_completed",
    title: "Five Star Saver",
    description: "Completed 5 savings goals",
    icon: "star",
  },
  big_goal_completed: {
    id: "big_goal_completed",
    title: "Big Spender Saver",
    description: "Completed a goal worth RM 5,000 or more",
    icon: "diamond",
  },
  streak_3_months: {
    id: "streak_3_months",
    title: "Consistent Saver",
    description: "Made contributions in 3 consecutive months",
    icon: "flame",
  },
};

// ==================== HELPER FUNCTIONS ====================

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomDateInMonth(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = randomInt(1, daysInMonth);
  const hour = randomInt(8, 22);
  const minute = randomInt(0, 59);
  return new Date(year, month, day, hour, minute, 0);
}

// Helper removed - we'll use actual dates from today going back

function getMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function userPath(userId) {
  return userId.startsWith("/USERS/") ? userId : `/USERS/${userId}`;
}

function randomExpenseAmount(category, expenseType = null) {
  const config = EXPENSE_AMOUNTS[category] || EXPENSE_AMOUNTS.Others;
  
  // Special handling for Food category with different meal types
  if (category === "Food" && expenseType && config[expenseType]) {
    // Use specific amount range for meal type - prioritize small amounts (90% chance)
    if (Math.random() < 0.90) {
      return randomChoice(config[expenseType]);
    }
    // Fallback to common amounts (prioritize small ones)
    const smallAmounts = config.common.filter(amt => amt <= 30);
    if (smallAmounts.length > 0 && Math.random() < 0.7) {
      return randomChoice(smallAmounts);
    }
    return randomChoice(config.common || [10, 15, 20]);
  }
  
  // For all categories, prioritize small amounts (5, 10, 15, etc.)
  // 70% chance to use small amounts (<= 30), 30% chance for larger amounts
  if (Math.random() < 0.70 && config.common) {
    const smallAmounts = config.common.filter(amt => amt <= 30);
    if (smallAmounts.length > 0) {
      return randomChoice(smallAmounts);
    }
    // If no small amounts in common, use the smallest common amounts
    const sortedCommon = [...config.common].sort((a, b) => a - b);
    const smallRange = sortedCommon.slice(0, Math.ceil(sortedCommon.length * 0.4));
    if (smallRange.length > 0) {
      return randomChoice(smallRange);
    }
    return randomChoice(config.common);
  }
  
  // For remaining 30%, still bias towards smaller amounts
  if (config.common && Math.random() < 0.6) {
    return randomChoice(config.common);
  }
  
  // For random, strongly bias towards smaller amounts (80% in lower third)
  const randomAmount = randomFloat(config.min, config.max);
  if (Math.random() < 0.80) {
    return Math.round(randomFloat(config.min, config.min + (config.max - config.min) * 0.33) * 100) / 100;
  }
  return Math.round(randomAmount * 100) / 100;
}

function randomIncomeAmount(category) {
  const config = INCOME_AMOUNTS[category] || INCOME_AMOUNTS.Salary;
  if (Math.random() < 0.7 && config.common) {
    return randomChoice(config.common);
  }
  return randomFloat(config.min, config.max);
}

function randomMerchant(category, expenseType = null) {
  if (category === "Food" && expenseType && MERCHANT_TEMPLATES.Food[expenseType]) {
    return randomChoice(MERCHANT_TEMPLATES.Food[expenseType]);
  }
  const templates = MERCHANT_TEMPLATES[category];
  if (!templates) {
    return randomChoice(MERCHANT_TEMPLATES.Others);
  }
  if (Array.isArray(templates)) {
    return randomChoice(templates);
  }
  // If it's an object (like Food), use general
  if (templates.general) {
    return randomChoice(templates.general);
  }
  return randomChoice(Object.values(templates).flat());
}

// ==================== DATA GENERATION ====================

/**
 * Generate expenses for a month - with more realistic food expenses
 */
function generateExpenses(userId, year, month, count, categoryDistribution) {
  const expenses = [];
  const userPathStr = userPath(userId);
  
  // For Food category, generate more realistic meal patterns
  // Typical month: ~20-25 food expenses (lunch, dinner, grocery, snacks)
  const foodExpenseTypes = ["lunch", "dinner", "grocery", "snack", "general"];
  const foodTypeWeights = [0.35, 0.30, 0.20, 0.10, 0.05]; // More lunch/dinner, less snacks
  
  // Helper function for weighted random selection
  function weightedRandomChoice(weights) {
    const categories = Object.keys(weights);
    const values = Object.values(weights);
    const total = values.reduce((sum, val) => sum + val, 0);
    let random = Math.random() * total;
    for (let i = 0; i < categories.length; i++) {
      random -= values[i];
      if (random <= 0) {
        return categories[i];
      }
    }
    return categories[categories.length - 1];
  }
  
  for (let i = 0; i < count; i++) {
    const category = weightedRandomChoice(categoryDistribution);
    let amount, merchant, expenseType = null;
    
    // Special handling for Food - generate realistic meal patterns
    if (category === "Food") {
      // Weighted random selection for meal type
      const rand = Math.random();
      let cumulative = 0;
      for (let j = 0; j < foodExpenseTypes.length; j++) {
        cumulative += foodTypeWeights[j];
        if (rand <= cumulative) {
          expenseType = foodExpenseTypes[j];
          break;
        }
      }
      amount = randomExpenseAmount(category, expenseType);
      merchant = randomMerchant(category, expenseType);
    } else {
      amount = randomExpenseAmount(category);
      merchant = randomMerchant(category);
    }
    
    // For food, distribute throughout the day more realistically
    let date;
    if (category === "Food" && expenseType) {
      if (expenseType === "lunch") {
        // Lunch: 11 AM - 2 PM
        const day = randomInt(1, new Date(year, month + 1, 0).getDate());
        const hour = randomInt(11, 14);
        const minute = randomInt(0, 59);
        date = new Date(year, month, day, hour, minute, 0);
      } else if (expenseType === "dinner") {
        // Dinner: 6 PM - 10 PM
        const day = randomInt(1, new Date(year, month + 1, 0).getDate());
        const hour = randomInt(18, 22);
        const minute = randomInt(0, 59);
        date = new Date(year, month, day, hour, minute, 0);
      } else if (expenseType === "grocery") {
        // Grocery: Usually weekends or evenings
        const day = randomInt(1, new Date(year, month + 1, 0).getDate());
        const isWeekend = new Date(year, month, day).getDay() === 0 || new Date(year, month, day).getDay() === 6;
        const hour = isWeekend ? randomInt(10, 18) : randomInt(18, 21);
        const minute = randomInt(0, 59);
        date = new Date(year, month, day, hour, minute, 0);
      } else {
        // Snacks/general: Random time
        date = randomDateInMonth(year, month);
      }
    } else {
      date = randomDateInMonth(year, month);
    }
    
    const paymentMethod = randomChoice(PAYMENT_METHODS);
    
    expenses.push({
      exp_id: `EXP${Date.now()}${i}${Math.random().toString(36).substr(2, 5)}`,
      user_id: userPathStr,
      exp_category: category,
      exp_payment_method: paymentMethod,
      exp_total: amount,
      exp_notes: merchant,
      exp_date: date.toISOString(), // ISO string format (matches frontend AddRecord.tsx)
      created_at: date.toISOString(), // Use ISO string for consistency
      updated_at: date.toISOString(), // Use ISO string for consistency
    });
  }
  
  return expenses;
}

/**
 * Generate income for a month
 */
function generateIncome(userId, year, month, baseSalary, hasBonus = false, hasFreelance = false) {
  const income = [];
  const userPathStr = userPath(userId);
  const firstDay = new Date(year, month, 1, 9, 0, 0);
  
  // Main salary (always on 1st or 2nd of month)
  const salaryDate = new Date(year, month, randomInt(1, 2), 9, 0, 0);
  income.push({
    inc_id: `INC${Date.now()}SAL${Math.random().toString(36).substr(2, 5)}`,
    user_id: userPathStr,
    inc_category: "Salary",
    inc_payment_method: "Bank",
    inc_total: baseSalary,
    inc_notes: "Monthly Salary",
    inc_date: salaryDate.toISOString(), // ISO string format
    created_at: salaryDate.toISOString(), // Use ISO string for consistency
    updated_at: salaryDate.toISOString(), // Use ISO string for consistency
  });
  
  // Bonus (if applicable) - usually mid-month
  if (hasBonus && Math.random() < 0.3) {
    const bonusDate = randomDateInMonth(year, month);
    income.push({
      inc_id: `INC${Date.now()}BNS${Math.random().toString(36).substr(2, 5)}`,
      user_id: userPathStr,
      inc_category: "Bonus",
      inc_payment_method: "Bank",
      inc_total: randomIncomeAmount("Bonus"),
      inc_notes: "Performance Bonus",
      inc_date: bonusDate.toISOString(),
      created_at: bonusDate.toISOString(),
      updated_at: bonusDate.toISOString(),
    });
  }
  
  // Freelance (if applicable) - random dates
  if (hasFreelance && Math.random() < 0.4) {
    const freelanceDate = randomDateInMonth(year, month);
    income.push({
      inc_id: `INC${Date.now()}FRL${Math.random().toString(36).substr(2, 5)}`,
      user_id: userPathStr,
      inc_category: "Freelance",
      inc_payment_method: "Bank",
      inc_total: randomIncomeAmount("Freelance"),
      inc_notes: "Freelance Project",
      inc_date: freelanceDate.toISOString(),
      created_at: freelanceDate.toISOString(),
      updated_at: freelanceDate.toISOString(),
    });
  }
  
  // Investment returns (occasional)
  if (Math.random() < 0.2) {
    const invDate = randomDateInMonth(year, month);
    income.push({
      inc_id: `INC${Date.now()}INV${Math.random().toString(36).substr(2, 5)}`,
      user_id: userPathStr,
      inc_category: "Investment",
      inc_payment_method: "Bank",
      inc_total: randomIncomeAmount("Investment"),
      inc_notes: "Investment Returns",
      inc_date: invDate.toISOString(),
      created_at: invDate.toISOString(),
      updated_at: invDate.toISOString(),
    });
  }
  
  return income;
}

/**
 * Generate savings goals
 */
function generateSavingsGoals(userId, scenario) {
  const goals = [];
  const userPathStr = userPath(userId);
  const now = new Date();
  
  const timestamp = Date.now();
  
  if (scenario === "bad") {
    // Bad health: Few or no savings goals, or goals with low progress
    goals.push({
      id: `SG${timestamp}1${Math.random().toString(36).substr(2, 5)}`,
      user_id: userPathStr,
      name: "Emergency Fund",
      target_amount: 5000,
      current_amount: 800, // Very low progress
      monthly_target: 200,
      deadline: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() + 6, 1)),
      category: "Emergency",
      notes: "Struggling to save",
      created_at: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() - 5, 1)),
      updated_at: admin.firestore.Timestamp.fromDate(now),
    });
    
    // Maybe one more goal with no progress
    if (Math.random() < 0.5) {
      goals.push({
        id: `SG${timestamp}2${Math.random().toString(36).substr(2, 5)}`,
        user_id: userPathStr,
        name: "New Phone",
        target_amount: 3000,
        current_amount: 150, // Almost no progress
        monthly_target: 100,
        deadline: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() + 3, 1)),
        category: "Electronics",
        notes: "Haven't saved much",
        created_at: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
        updated_at: admin.firestore.Timestamp.fromDate(now),
      });
    }
  } else if (scenario === "high") {
    // High health: Multiple goals, some completed
    goals.push({
      id: `SG${timestamp}1${Math.random().toString(36).substr(2, 5)}`,
      user_id: userPathStr,
      name: "Emergency Fund",
      target_amount: 10000,
      current_amount: 10000, // Completed
      monthly_target: 1500,
      deadline: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() + 3, 30)),
      category: "Emergency",
      notes: "6 months expenses",
      created_at: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() - 5, 1)),
      updated_at: admin.firestore.Timestamp.fromDate(now),
    });
    
    goals.push({
      id: `SG${timestamp}2${Math.random().toString(36).substr(2, 5)}`,
      user_id: userPathStr,
      name: "Vacation to Japan",
      target_amount: 8000,
      current_amount: 6500, // In progress
      monthly_target: 1000,
      deadline: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() + 3, 1)),
      category: "Travel",
      notes: "Saving for trip",
      created_at: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() - 4, 1)),
      updated_at: admin.firestore.Timestamp.fromDate(now),
    });
    
    goals.push({
      id: `SG${timestamp}3${Math.random().toString(36).substr(2, 5)}`,
      user_id: userPathStr,
      name: "New Laptop",
      target_amount: 5000,
      current_amount: 3200, // In progress
      monthly_target: 800,
      deadline: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() + 1, 1)),
      category: "Electronics",
      notes: "MacBook Pro",
      created_at: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() - 3, 1)),
      updated_at: admin.firestore.Timestamp.fromDate(now),
    });
    
    goals.push({
      id: `SG${timestamp}4${Math.random().toString(36).substr(2, 5)}`,
      user_id: userPathStr,
      name: "Investment Fund",
      target_amount: 15000,
      current_amount: 8500, // In progress
      monthly_target: 2000,
      deadline: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() + 5, 1)),
      category: "Investment",
      notes: "Stock market investment",
      created_at: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() - 5, 15)),
      updated_at: admin.firestore.Timestamp.fromDate(now),
    });
  } else {
    // Good health: Some goals in progress
    goals.push({
      id: `SG${timestamp}1${Math.random().toString(36).substr(2, 5)}`,
      user_id: userPathStr,
      name: "Emergency Fund",
      target_amount: 8000,
      current_amount: 4200, // In progress
      monthly_target: 1000,
      deadline: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() + 5, 1)),
      category: "Emergency",
      notes: "3 months expenses",
      created_at: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() - 4, 1)),
      updated_at: admin.firestore.Timestamp.fromDate(now),
    });
    
    goals.push({
      id: `SG${timestamp}2${Math.random().toString(36).substr(2, 5)}`,
      user_id: userPathStr,
      name: "New Phone",
      target_amount: 3500,
      current_amount: 1800, // In progress
      monthly_target: 500,
      deadline: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() + 2, 1)),
      category: "Electronics",
      notes: "iPhone 15",
      created_at: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() - 3, 1)),
      updated_at: admin.firestore.Timestamp.fromDate(now),
    });
    
    goals.push({
      id: `SG${timestamp}3${Math.random().toString(36).substr(2, 5)}`,
      user_id: userPathStr,
      name: "Holiday Fund",
      target_amount: 5000,
      current_amount: 2100, // In progress
      monthly_target: 600,
      deadline: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() + 4, 1)),
      category: "Travel",
      notes: "Bali trip",
      created_at: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
      updated_at: admin.firestore.Timestamp.fromDate(now),
    });
  }
  
  return goals;
}

/**
 * Generate debts
 */
function generateDebts(userId, scenario) {
  const debts = [];
  const userPathStr = userPath(userId);
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  
  const debtTimestamp = Date.now();
  
  if (scenario === "bad") {
    // Bad health: Multiple debts, high balances, struggling to pay
    const startDate1 = new Date(sixMonthsAgo);
    const targetDate1 = new Date(now.getFullYear() + 1, now.getMonth() + 6, 1);
    debts.push({
      id: `DEBT${debtTimestamp}1${Math.random().toString(36).substr(2, 5)}`,
      user_id: userPathStr,
      name: "Credit Card",
      type: "Credit Card",
      original_amount: 8000,
      current_balance: 7200, // High balance, slow progress
      monthly_payment: 300, // Minimum payment only
      target_date: targetDate1.toISOString().split('T')[0],
      start_date: admin.firestore.Timestamp.fromDate(startDate1),
      created_at: admin.firestore.Timestamp.fromDate(startDate1),
      updated_at: admin.firestore.Timestamp.fromDate(now),
    });
    
    const startDate2 = new Date(sixMonthsAgo);
    const targetDate2 = new Date(now.getFullYear() + 1, now.getMonth(), 1);
    debts.push({
      id: `DEBT${debtTimestamp}2${Math.random().toString(36).substr(2, 5)}`,
      user_id: userPathStr,
      name: "Personal Loan",
      type: "Personal Loan",
      original_amount: 15000,
      current_balance: 13200, // High balance
      monthly_payment: 600, // Struggling with payments
      target_date: targetDate2.toISOString().split('T')[0],
      start_date: admin.firestore.Timestamp.fromDate(startDate2),
      created_at: admin.firestore.Timestamp.fromDate(startDate2),
      updated_at: admin.firestore.Timestamp.fromDate(now),
    });
    
    // Sometimes a third debt
    if (Math.random() < 0.4) {
      const startDate3 = new Date(sixMonthsAgo);
      const targetDate3 = new Date(now.getFullYear() + 2, now.getMonth() + 1, 1);
      debts.push({
        id: `DEBT${debtTimestamp}3${Math.random().toString(36).substr(2, 5)}`,
        user_id: userPathStr,
        name: "Car Loan",
        type: "Car Loan",
        original_amount: 50000,
        current_balance: 42000, // Large debt
        monthly_payment: 1200,
        target_date: targetDate3.toISOString().split('T')[0],
        start_date: admin.firestore.Timestamp.fromDate(startDate3),
        created_at: admin.firestore.Timestamp.fromDate(startDate3),
        updated_at: admin.firestore.Timestamp.fromDate(now),
      });
    }
  } else if (scenario === "high") {
    // High health: Has manageable debt with consistent payments
    const startDate1 = new Date(now.getFullYear(), now.getMonth() - 4, 1);
    const targetDate1 = new Date(now.getFullYear(), now.getMonth() + 5, 1);
    debts.push({
      id: `DEBT${debtTimestamp}1${Math.random().toString(36).substr(2, 5)}`,
      user_id: userPathStr,
      name: "Credit Card",
      type: "Credit Card",
      original_amount: 5000,
      current_balance: 2800, // Making good progress
      monthly_payment: 500, // Consistent payment
      target_date: targetDate1.toISOString().split('T')[0],
      start_date: admin.firestore.Timestamp.fromDate(startDate1),
      created_at: admin.firestore.Timestamp.fromDate(startDate1),
      updated_at: admin.firestore.Timestamp.fromDate(now),
    });
    
    // Sometimes a second manageable debt
    if (Math.random() < 0.5) {
      const startDate2 = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const targetDate2 = new Date(now.getFullYear(), now.getMonth() + 7, 1);
      debts.push({
        id: `DEBT${debtTimestamp}2${Math.random().toString(36).substr(2, 5)}`,
        user_id: userPathStr,
        name: "Personal Loan",
        type: "Personal Loan",
        original_amount: 8000,
        current_balance: 5200, // Good progress
        monthly_payment: 600, // Consistent payment
        target_date: targetDate2.toISOString().split('T')[0],
        start_date: admin.firestore.Timestamp.fromDate(startDate2),
        created_at: admin.firestore.Timestamp.fromDate(startDate2),
        updated_at: admin.firestore.Timestamp.fromDate(now),
      });
    }
  } else {
    // Good health: Some manageable debts
    const startDate1 = new Date(now.getFullYear(), now.getMonth() - 4, 1);
    const targetDate1 = new Date(now.getFullYear(), now.getMonth() + 4, 1);
    debts.push({
      id: `DEBT${debtTimestamp}1${Math.random().toString(36).substr(2, 5)}`,
      user_id: userPathStr,
      name: "Credit Card",
      type: "Credit Card",
      original_amount: 5000,
      current_balance: 3200, // In progress
      monthly_payment: 500,
      target_date: targetDate1.toISOString().split('T')[0],
      start_date: admin.firestore.Timestamp.fromDate(startDate1),
      created_at: admin.firestore.Timestamp.fromDate(startDate1),
      updated_at: admin.firestore.Timestamp.fromDate(now),
    });
    
    const startDate2 = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const targetDate2 = new Date(now.getFullYear(), now.getMonth() + 7, 1);
    debts.push({
      id: `DEBT${debtTimestamp}2${Math.random().toString(36).substr(2, 5)}`,
      user_id: userPathStr,
      name: "Personal Loan",
      type: "Personal Loan",
      original_amount: 10000,
      current_balance: 7200, // In progress
      monthly_payment: 800,
      target_date: targetDate2.toISOString().split('T')[0],
      start_date: admin.firestore.Timestamp.fromDate(startDate2),
      created_at: admin.firestore.Timestamp.fromDate(startDate2),
      updated_at: admin.firestore.Timestamp.fromDate(now),
    });
  }
  
  return debts;
}

/**
 * Generate debt payments
 */
function generateDebtPayments(debt, monthsBack, scenario = "good") {
  const payments = [];
  const startDate = debt.start_date.toDate();
  const now = new Date();
  
  // Calculate how many months have passed since debt started
  const monthsSinceStart = Math.max(0, (now.getFullYear() - startDate.getFullYear()) * 12 + (now.getMonth() - startDate.getMonth()));
  const actualMonthsBack = Math.min(monthsBack, monthsSinceStart);
  
  // Generate payments for each month since debt started
  for (let i = 0; i < actualMonthsBack; i++) {
    const paymentDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, randomInt(1, 5)); // Payment usually early in month
    
    if (paymentDate > now) break;
    
    if (scenario === "bad") {
      // Bad health: Frequently miss payments (25% chance), or pay less than required
      if (Math.random() < 0.25) continue; // Skip this payment
      
      // Sometimes pay less than required (20% chance)
      const paymentAmount = Math.random() < 0.2 ? debt.monthly_payment * 0.7 : debt.monthly_payment;
      payments.push({
        user_id: debt.user_id,
        amount: paymentAmount,
        date_iso: paymentDate.toISOString(),
        note: `Monthly payment ${i + 1}${paymentAmount < debt.monthly_payment ? " (partial)" : ""}`,
        created_at: admin.firestore.Timestamp.fromDate(paymentDate),
      });
    } else if (scenario === "high") {
      // High health (good health user): ALWAYS pay consistently every month, never miss
      payments.push({
        user_id: debt.user_id,
        amount: debt.monthly_payment,
        date_iso: paymentDate.toISOString(),
        note: `Monthly payment ${i + 1}`,
        created_at: admin.firestore.Timestamp.fromDate(paymentDate),
      });
    } else {
      // Good health: Always pay on time, sometimes extra
      payments.push({
        user_id: debt.user_id,
        amount: debt.monthly_payment,
        date_iso: paymentDate.toISOString(),
        note: `Monthly payment ${i + 1}`,
        created_at: admin.firestore.Timestamp.fromDate(paymentDate),
      });
    }
  }
  
  return payments;
}

/**
 * Generate savings contributions
 */
function generateSavingsContributions(goal, monthsBack, scenario = "high") {
  const contributions = [];
  const startDate = goal.created_at.toDate();
  const now = new Date();
  
  // Generate contributions for each month since goal was created
  for (let i = 0; i < monthsBack; i++) {
    const contribDate = new Date(startDate.getFullYear(), startDate.getMonth() + i, randomInt(1, 10)); // Usually early in month
    
    if (contribDate > now) break;
    
    const baseAmount = goal.monthly_target || 500;
    
    if (scenario === "bad") {
      // Bad health: Frequently miss payments (40% chance), or pay less
      if (Math.random() < 0.4) continue; // Skip this month
      
      // Sometimes pay less than target (30% chance)
      const amount = Math.random() < 0.3 ? baseAmount * 0.5 : baseAmount;
      contributions.push({
        user_id: goal.user_id,
        amount: amount,
        date: admin.firestore.Timestamp.fromDate(contribDate),
        source: "Bank",
        note: `Monthly contribution to ${goal.name}`,
        created_at: admin.firestore.Timestamp.fromDate(contribDate),
      });
    } else if (scenario === "high") {
      // High health: Very consistent (only 2% chance to skip)
      if (Math.random() < 0.02) continue;
      
      contributions.push({
        user_id: goal.user_id,
        amount: baseAmount,
        date: admin.firestore.Timestamp.fromDate(contribDate),
        source: "Bank",
        note: `Monthly contribution to ${goal.name}`,
        created_at: admin.firestore.Timestamp.fromDate(contribDate),
      });
    } else {
      // Good health: Sometimes skip a month (10% chance)
      if (Math.random() < 0.1) continue;
      
      contributions.push({
        user_id: goal.user_id,
        amount: baseAmount,
        date: admin.firestore.Timestamp.fromDate(contribDate),
        source: "Bank",
        note: `Monthly contribution to ${goal.name}`,
        created_at: admin.firestore.Timestamp.fromDate(contribDate),
      });
    }
  }
  
  return contributions;
}

/**
 * Generate savings badges based on goals and contributions
 */
function generateSavingsBadges(userId, savingsGoals, contributions, scenario) {
  const badges = [];
  const userPathStr = userPath(userId);
  const now = new Date();
  
  if (scenario === "high") {
    // High health: Earned multiple badges
    // First goal completed
    badges.push({
      badge_id: "first_goal_completed",
      user_id: userPathStr,
      title: BADGE_DEFINITIONS.first_goal_completed.title,
      description: BADGE_DEFINITIONS.first_goal_completed.description,
      icon: BADGE_DEFINITIONS.first_goal_completed.icon,
      earned_at: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() - 1, 15)),
    });
    
    // Big goal completed (Emergency Fund is RM 10,000)
    badges.push({
      badge_id: "big_goal_completed",
      user_id: userPathStr,
      title: BADGE_DEFINITIONS.big_goal_completed.title,
      description: BADGE_DEFINITIONS.big_goal_completed.description,
      icon: BADGE_DEFINITIONS.big_goal_completed.icon,
      earned_at: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() - 1, 15)),
    });
    
    // Streak 3 months (has consistent contributions)
    badges.push({
      badge_id: "streak_3_months",
      user_id: userPathStr,
      title: BADGE_DEFINITIONS.streak_3_months.title,
      description: BADGE_DEFINITIONS.streak_3_months.description,
      icon: BADGE_DEFINITIONS.streak_3_months.icon,
      earned_at: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
    });
  } else if (scenario === "bad") {
    // Bad health: No badges earned (struggling to save)
    // Maybe earned streak badge if they have some contributions
    if (contributions.length >= 3) {
      badges.push({
        badge_id: "streak_3_months",
        user_id: userPathStr,
        title: BADGE_DEFINITIONS.streak_3_months.title,
        description: BADGE_DEFINITIONS.streak_3_months.description,
        icon: BADGE_DEFINITIONS.streak_3_months.icon,
        earned_at: admin.firestore.Timestamp.fromDate(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
      });
    }
  }
  
  return badges;
}

/**
 * Generate budget allocations
 */
function generateBudget(userId, monthKey, totalBudget, scenario) {
  const userPathStr = userPath(userId);
  const now = new Date();
  
  // Base percentages (from budgetUtils.ts)
  const basePercentages = {
    Food: 13,
    Shopping: 6,
    Bills: 12,
    Entertainment: 4,
    Transport: 10,
    Healthcare: 7,
    Education: 2,
    Housing: 25,
    Savings: scenario === "bad" ? 5 : scenario === "high" ? 25 : 15, // Low savings for bad, high for high health
    Debt: scenario === "bad" ? 15 : scenario === "high" ? 8 : 5, // High debt for bad, some for high health (they have debt but manage it well)
    Others: 1,
  };
  
  const allocations = {};
  Object.entries(basePercentages).forEach(([cat, pct]) => {
    allocations[cat] = Math.round((totalBudget * pct / 100) * 100) / 100;
  });
  
  return {
    bud_id: `BUD${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
    user_id: userPathStr,
    total_budget: totalBudget,
    percentages: basePercentages,
    allocations: allocations,
    month_key: monthKey,
    created_at: admin.firestore.Timestamp.fromDate(now),
    updated_at: admin.firestore.Timestamp.fromDate(now),
  };
}

// ==================== MAIN GENERATION FUNCTION ====================

async function generateUserData(userId, scenario, monthsBack = 6) {
  console.log(`\n📊 Generating data for user: ${userId} (${scenario} health score)`);
  
  const now = new Date();
  const userPathStr = userPath(userId);
  
  // Scenario configuration
  const config = {
    bad: {
      baseSalary: 4500,
      // Ensure at least 250 expenses over 6 months: 250/6 = ~42 per month minimum
      expenseCountPerMonth: { min: 45, max: 65 }, // 45*6 = 270 minimum (exceeds 250 requirement)
      hasBonus: false,
      hasFreelance: false,
      categoryDistribution: {
        Food: 0.55, Transport: 0.12, Housing: 0.20, Shopping: 0.07,
        Bills: 0.04, Entertainment: 0.01, Healthcare: 0.01, Education: 0.00, Others: 0.00
      },
    },
    high: {
      baseSalary: 8500,
      // Ensure at least 250 expenses over 6 months: 250/6 = ~42 per month minimum
      expenseCountPerMonth: { min: 45, max: 60 }, // 45*6 = 270 minimum (exceeds 250 requirement)
      hasBonus: true,
      hasFreelance: true,
      categoryDistribution: {
        Food: 0.50, Transport: 0.10, Housing: 0.18, Shopping: 0.08,
        Bills: 0.08, Entertainment: 0.05, Healthcare: 0.01, Education: 0.00, Others: 0.00
      },
    },
  };
  
  const userConfig = config[scenario];
  
  // Generate data for each month
  const allExpenses = [];
  const allIncome = [];
  const budgets = [];
  
  // Generate data for the last 6 months from today
  for (let monthOffset = monthsBack - 1; monthOffset >= 0; monthOffset--) {
    const date = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthKey = getMonthKey(date);
    
    console.log(`  📅 Generating ${monthKey}...`);
    
    // Income (generate first to know available budget)
    const monthIncome = generateIncome(
      userId, year, month, userConfig.baseSalary,
      userConfig.hasBonus, userConfig.hasFreelance
    );
    const monthIncomeTotal = monthIncome.reduce((sum, inc) => sum + inc.inc_total, 0);
    allIncome.push(...monthIncome);
    
    // Expenses
    // For high health user, ensure expenses don't exceed 75% of income (leaving room for savings/debt)
    // For bad health user, allow expenses to potentially exceed income
    let expenseCount = randomInt(
      userConfig.expenseCountPerMonth.min,
      userConfig.expenseCountPerMonth.max
    );
    
    let monthExpenses = generateExpenses(
      userId, year, month, expenseCount, userConfig.categoryDistribution
    );
    
    // For high health user, ensure total expenses < income
    if (scenario === "high") {
      const monthExpensesTotal = monthExpenses.reduce((sum, exp) => sum + exp.exp_total, 0);
      const maxExpenses = monthIncomeTotal * 0.75; // Max 75% of income for expenses
      
      if (monthExpensesTotal > maxExpenses) {
        // Scale down expenses proportionally to fit within budget
        // But ensure minimum amounts are maintained (at least 5 for small expenses)
        const scaleFactor = maxExpenses / monthExpensesTotal;
        monthExpenses = monthExpenses.map(exp => {
          const scaledAmount = Math.round(exp.exp_total * scaleFactor * 100) / 100;
          // Maintain minimum realistic amounts (at least 5 for most categories, 50 for housing/bills)
          const minAmount = exp.exp_category === "Housing" ? 800 : 
                           exp.exp_category === "Bills" ? 50 : 5;
          return {
            ...exp,
            exp_total: Math.max(minAmount, scaledAmount)
          };
        });
        
        // Recalculate total after minimum adjustments
        const adjustedTotal = monthExpenses.reduce((sum, exp) => sum + exp.exp_total, 0);
        if (adjustedTotal > maxExpenses) {
          // Final proportional adjustment if still over budget
          const finalScale = maxExpenses / adjustedTotal;
          monthExpenses = monthExpenses.map(exp => ({
            ...exp,
            exp_total: Math.max(5, Math.round(exp.exp_total * finalScale * 100) / 100)
          }));
        }
      }
    }
    
    allExpenses.push(...monthExpenses);
    
    // Budget
    // Bad health: Often overspending (budget > income)
    // High health: Budget should ensure expenses < income (use 65% of income for budget, leaving room for savings)
    const budgetMultiplier = scenario === "bad" ? 1.15 : scenario === "high" ? 0.65 : 0.85; // Bad: 115%, High: 65% (ensures expenses < income), Good: 85%
    const totalBudget = userConfig.baseSalary * budgetMultiplier;
    const budget = generateBudget(userId, monthKey, totalBudget, scenario);
    budgets.push(budget);
  }
  
  // Savings Goals
  console.log(`  💰 Generating savings goals...`);
  const savingsGoals = generateSavingsGoals(userId, scenario);
  
  // Collect all contributions for badge generation (before writing)
  const allContributions = [];
  for (const goal of savingsGoals) {
    const contributions = generateSavingsContributions(goal, monthsBack, scenario);
    allContributions.push(...contributions);
  }
  
  // Generate savings badges based on goals and contributions
  console.log(`  🏆 Generating savings badges...`);
  const badges = generateSavingsBadges(userId, savingsGoals, allContributions, scenario);
  
  // Debts
  console.log(`  💳 Generating debts...`);
  const debts = generateDebts(userId, scenario);
  
  // Write to Firestore
  console.log(`  💾 Writing to Firestore...`);
  
  const batch = db.batch();
  let batchCount = 0;
  const BATCH_LIMIT = 500;
  
  // Write expenses
  for (const exp of allExpenses) {
    const ref = db.collection("EXPENSES").doc();
    batch.set(ref, exp);
    batchCount++;
    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      batchCount = 0;
    }
  }
  
  // Write income
  for (const inc of allIncome) {
    const ref = db.collection("INCOME").doc();
    batch.set(ref, inc);
    batchCount++;
    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      batchCount = 0;
    }
  }
  
  // Write budgets
  for (const budget of budgets) {
    const ref = db.collection("BUDGET").doc(budget.bud_id);
    batch.set(ref, budget);
    batchCount++;
    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      batchCount = 0;
    }
  }
  
  // Write savings goals and contributions
  for (const goal of savingsGoals) {
    const goalRef = db.collection("SAVINGS_GOALS").doc(goal.id);
    batch.set(goalRef, goal);
    batchCount++;
    
    // Regenerate contributions for writing (to ensure consistency)
    const contributions = generateSavingsContributions(goal, monthsBack, scenario);
    for (const contrib of contributions) {
      const contribRef = goalRef.collection("CONTRIBUTIONS").doc();
      batch.set(contribRef, contrib);
      batchCount++;
      if (batchCount >= BATCH_LIMIT) {
        await batch.commit();
        batchCount = 0;
      }
    }
  }
  
  // Write savings badges
  for (const badge of badges) {
    // Use deterministic document ID: userId_badgeId
    const sanitizedUserId = userId.replace(/[^a-zA-Z0-9]/g, "_");
    const badgeDocId = `${sanitizedUserId}_${badge.badge_id}`;
    const badgeRef = db.collection("SAVINGS_BADGES").doc(badgeDocId);
    batch.set(badgeRef, badge);
    batchCount++;
    if (batchCount >= BATCH_LIMIT) {
      await batch.commit();
      batchCount = 0;
    }
  }
  
  // Write debts and payments
  for (const debt of debts) {
    const debtRef = db.collection("DEBTS").doc(debt.id);
    batch.set(debtRef, debt);
    batchCount++;
    
    const payments = generateDebtPayments(debt, monthsBack, scenario);
    for (const payment of payments) {
      const paymentRef = debtRef.collection("PAYMENTS").doc();
      batch.set(paymentRef, payment);
      batchCount++;
      if (batchCount >= BATCH_LIMIT) {
        await batch.commit();
        batchCount = 0;
      }
    }
  }
  
  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }
  
  // Calculate totals for verification
  const totalExpenses = allExpenses.reduce((sum, e) => sum + e.exp_total, 0);
  const totalIncome = allIncome.reduce((sum, i) => sum + i.inc_total, 0);
  const foodExpenses = allExpenses.filter(e => e.exp_category === "Food").length;
  const foodPercentage = allExpenses.length > 0 ? ((foodExpenses / allExpenses.length) * 100).toFixed(1) : 0;
  
  console.log(`  ✅ Completed! Generated:`);
  console.log(`     - ${allExpenses.length} expenses ${allExpenses.length >= 250 ? '✅' : '⚠️'} (minimum 250 required)`);
  console.log(`     - Total expenses: RM ${totalExpenses.toFixed(2)}`);
  console.log(`     - ${allIncome.length} income records`);
  console.log(`     - Total income: RM ${totalIncome.toFixed(2)}`);
  if (scenario === "high") {
    const incomeVsExpenses = totalIncome > totalExpenses ? '✅ Income > Expenses' : '⚠️ Expenses >= Income';
    console.log(`     - Income vs Expenses: ${incomeVsExpenses}`);
  }
  console.log(`     - Food expenses: ${foodExpenses} (${foodPercentage}% of total)`);
  console.log(`     - ${budgets.length} budget records`);
  console.log(`     - ${savingsGoals.length} savings goals`);
  console.log(`     - ${allContributions.length} savings contributions`);
  console.log(`     - ${badges.length} savings badges`);
  console.log(`     - ${debts.length} debts`);
  
  // Debug: Show sample expense and income to verify format
  if (allExpenses.length > 0) {
    console.log(`\n  📋 Sample Expense (first one):`);
    console.log(`     - exp_date: ${allExpenses[0].exp_date}`);
    console.log(`     - exp_category: ${allExpenses[0].exp_category}`);
    console.log(`     - exp_total: RM ${allExpenses[0].exp_total}`);
    console.log(`     - user_id: ${allExpenses[0].user_id}`);
  }
  if (allIncome.length > 0) {
    console.log(`\n  📋 Sample Income (first one):`);
    console.log(`     - inc_date: ${allIncome[0].inc_date}`);
    console.log(`     - inc_category: ${allIncome[0].inc_category}`);
    console.log(`     - inc_total: RM ${allIncome[0].inc_total}`);
    console.log(`     - user_id: ${allIncome[0].user_id}`);
  }
}

// ==================== MAIN EXECUTION ====================

async function main() {
  const args = process.argv.slice(2);
  
  const userId1 = args[0] || "euOFFpQCOAb1XJJJl6Z62hcPWFU2";
  const userId2 = args[1] || "UrSjv1G4wrOjsotNyOr6FH6UhS63";
  
  console.log("🚀 Starting Test Data Generation");
  console.log("================================\n");
  console.log(`User 1: ${userId1} (BAD/LOW health score)`);
  console.log(`User 2: ${userId2} (GOOD/HIGH health score)`);
  console.log(`Months: 6`);
  console.log(`Mode: Append (won't delete existing data)`);
  console.log(`Minimum expenses per user: 250 records (45+ per month)\n`);
  
  try {
    // Generate for user 1 (bad/low health)
    await generateUserData(userId1, "bad", 6);
    
    // Generate for user 2 (high/good health)
    await generateUserData(userId2, "high", 6);
    
    console.log("\n✅ All data generation completed successfully!");
    console.log("💡 You can now test your app with realistic data.");
    
  } catch (error) {
    console.error("\n❌ Error generating data:", error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { generateUserData };

