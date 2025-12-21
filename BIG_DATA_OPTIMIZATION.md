# Big Data Optimization Guide

This document outlines the strategies and implementations for handling large datasets in the Auri app as users accumulate years of financial records.

## 🎯 Problem Statement

As users use the app for years, they accumulate thousands of records:
- **Expenses**: Could be 1000+ records per year
- **Income**: 50-200 records per year
- **Debts**: 5-20 records
- **Savings**: 10-50 goals with hundreds of contributions

**Performance Issues:**
1. Loading all records into memory causes slow app startup
2. AI recommendations process all records, causing delays
3. Insights calculation becomes slow
4. Chatbot needs to process large datasets
5. Firestore queries become expensive and slow

## ✅ Solutions Implemented

### 1. **Pagination & Date Range Filtering**

**Location:** `frontend/app/utils/dataOptimization.ts`

- **Pagination utilities** for fetching records in chunks
- **Date range filtering** to only fetch relevant records
- **Default limit**: Only fetch last 24 months of data for real-time subscriptions

**Usage:**
```typescript
import { fetchExpensesPaginated, getMonthDateRange } from './utils/dataOptimization';

// Fetch expenses for a specific month
const { startDate, endDate } = getMonthDateRange('2024-01');
const result = await fetchExpensesPaginated(userId, {
  dateRange: { startDate, endDate },
  pageSize: 50
});
```

### 2. **Caching Layer**

**Location:** `frontend/app/utils/dataOptimization.ts`

- **In-memory caching** with expiration (5 minutes default)
- **Cache keys** for insights, behavior analysis, monthly snapshots
- **Automatic cache invalidation** on data updates

**Usage:**
```typescript
import { getCache, setCache, CACHE_KEYS } from './utils/dataOptimization';

// Check cache first
const cacheKey = CACHE_KEYS.INSIGHTS(userId, monthKey);
const cached = await getCache(cacheKey);
if (cached) return cached;

// Compute and cache
const insights = await computeInsights(data);
await setCache(cacheKey, insights);
```

### 3. **Pre-computed Monthly Aggregations**

**Location:** `frontend/app/utils/precomputedAggregations.ts`

- **Store monthly totals** in Firestore collection `MONTHLY_AGGREGATIONS`
- **Fast access** without querying all records
- **Automatic updates** when records change

**Benefits:**
- Instant access to monthly totals
- No need to query thousands of records
- Reduces Firestore read costs

**Usage:**
```typescript
import { getMonthlyAggregation } from './utils/precomputedAggregations';

// Get pre-computed totals for a month
const aggregation = await getMonthlyAggregation(userId, '2024-01');
// Returns: { totalExpenses, totalIncome, byCategory, ... }
```

### 4. **Optimized Backend Queries**

**Location:** `backend/server.js` - `buildMonthlySnapshotFromFirestore()`

**Changes:**
- ✅ Use **date range queries** instead of fetching all records
- ✅ Query only the specific month needed
- ✅ Fallback to old method if index doesn't exist

**Before:**
```javascript
// ❌ Fetches ALL expenses, then filters in memory
const expensesSnap = await db.collection("EXPENSES")
  .where("user_id", "==", userPath)
  .get();
const monthExpenses = allExpenses.filter(...);
```

**After:**
```javascript
// ✅ Only fetches records for the specific month
const expensesSnap = await db.collection("EXPENSES")
  .where("user_id", "==", userPath)
  .where("exp_date", ">=", startTimestamp)
  .where("exp_date", "<", endTimestamp)
  .get();
```

### 5. **Data Archiving**

**Location:** `frontend/app/utils/dataArchiving.ts`

- **Archive records older than 2 years** to separate collection
- **Reduces active collection size** for faster queries
- **Can restore** if needed

**Usage:**
```typescript
import { archiveOldExpenses } from './utils/dataArchiving';

// Archive old records (run periodically via Cloud Function)
const result = await archiveOldExpenses({
  userId,
  archiveThresholdYears: 2
});
```

### 6. **Updated Frontend Data Fetching**

**Location:** `frontend/app/utils/ExpensesUtils.ts`

**Changes:**
- ✅ **Date range limit** on subscriptions (last 24 months by default)
- ✅ **Month-specific fetching** for historical data
- ✅ **Caching** for frequently accessed months

**Before:**
```typescript
// ❌ Fetches ALL expenses
const q = query(collection(db, "EXPENSES"), where("user_id", "==", userPath));
```

**After:**
```typescript
// ✅ Only fetches last 24 months
const startDate = new Date();
startDate.setMonth(startDate.getMonth() - 24);
const q = query(
  collection(db, "EXPENSES"),
  where("user_id", "==", userPath),
  where("exp_date", ">=", startTimestamp),
  orderBy("exp_date", "desc")
);
```

## 📊 Performance Improvements

### Expected Results:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Initial data load | 5-10s | 1-2s | **80% faster** |
| AI insights generation | 10-30s | 2-5s | **75% faster** |
| Monthly snapshot | 3-5s | <1s | **80% faster** |
| Chatbot response | 5-15s | 2-4s | **70% faster** |
| Firestore reads/month | 10,000+ | 2,000-3,000 | **70% reduction** |

## 🔧 Required Firestore Indexes

You **MUST** create these composite indexes in Firestore Console:

### 1. Expenses Collection
```
Collection: EXPENSES
Fields:
  - user_id (Ascending)
  - exp_date (Ascending)
```

### 2. Expenses Collection (with date range)
```
Collection: EXPENSES
Fields:
  - user_id (Ascending)
  - exp_date (Ascending)
  - exp_date (Ascending) [duplicate for range query]
```

### 3. Income Collection
```
Collection: INCOME
Fields:
  - user_id (Ascending)
  - inc_date (Ascending)
```

### 4. Income Collection (with date range)
```
Collection: INCOME
Fields:
  - user_id (Ascending)
  - inc_date (Ascending)
  - inc_date (Ascending) [duplicate for range query]
```

**How to create indexes:**
1. Go to Firebase Console → Firestore → Indexes
2. Click "Create Index"
3. Select collection and add fields as shown above
4. Wait for index to build (may take a few minutes)

**Or use Firebase CLI:**
```bash
firebase deploy --only firestore:indexes
```

## 🚀 Implementation Checklist

### Phase 1: Immediate (Critical)
- [x] Create pagination utilities
- [x] Add caching layer
- [x] Update ExpensesUtils with date range filtering
- [x] Optimize backend snapshot builder
- [ ] **Create Firestore indexes** (REQUIRED)
- [ ] Test with large datasets

### Phase 2: Optimization (High Priority)
- [x] Pre-computed aggregations system
- [ ] Update behavior analysis to use cached data
- [ ] Update AI recommendations to use aggregations
- [ ] Implement background processing for insights

### Phase 3: Advanced (Medium Priority)
- [x] Data archiving utilities
- [ ] Cloud Function for automatic archiving
- [ ] Cloud Function for pre-computing aggregations
- [ ] Analytics dashboard for performance monitoring

## 📝 Usage Examples

### Example 1: Fetch Recent Expenses Only
```typescript
// In Home.tsx or any component
import { subscribeUserExpenseRecords } from './utils/ExpensesUtils';

// Only subscribe to last 12 months
const unsubscribe = await subscribeUserExpenseRecords(
  (records) => {
    setExpenses(records);
  },
  (error) => {
    console.error(error);
  },
  12 // months back
);
```

### Example 2: Get Historical Month Data
```typescript
import { fetchExpensesForMonth } from './utils/ExpensesUtils';

// Fetch specific month (uses cache)
const jan2023Expenses = await fetchExpensesForMonth('2023-01');
```

### Example 3: Use Pre-computed Aggregations
```typescript
import { getMonthlyAggregation } from './utils/precomputedAggregations';

// Fast access to monthly totals
const aggregation = await getMonthlyAggregation(userId, '2024-01');
console.log(`Total expenses: ${aggregation.totalExpenses}`);
console.log(`By category:`, aggregation.byCategory);
```

### Example 4: Calculate Totals Efficiently
```typescript
import { calculateTotalsForRange } from './utils/dataOptimization';

// Calculate totals for date range without loading all records
const { total, count, byCategory } = await calculateTotalsForRange(
  userId,
  new Date('2024-01-01'),
  new Date('2024-01-31'),
  'expenses'
);
```

## ⚠️ Important Notes

1. **Firestore Indexes are REQUIRED** - Without them, queries will fail or be slow
2. **Cache invalidation** - Clear cache when records are added/updated
3. **Archive strategy** - Run archiving periodically (e.g., monthly via Cloud Function)
4. **Monitoring** - Monitor Firestore read/write costs and query performance
5. **User experience** - Show loading states while fetching historical data

## 🔄 Migration Path

For existing users with large datasets:

1. **Immediate**: Deploy optimized queries (will use fallback if indexes don't exist)
2. **Create indexes**: Set up Firestore indexes (may take time to build)
3. **Pre-compute aggregations**: Run script to compute existing monthly aggregations
4. **Archive old data**: Run archiving for records older than 2 years
5. **Monitor**: Watch performance metrics and adjust thresholds

## 📚 Additional Resources

- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Firestore Query Optimization](https://firebase.google.com/docs/firestore/query-data/queries)
- [Firestore Indexes Guide](https://firebase.google.com/docs/firestore/query-data/indexing)
