# AI Spending Analysis Feature - Setup Guide

## Overview
This feature analyzes a user's monthly spending behavior using OpenAI and provides personalized financial recommendations.

## Files Created/Modified

### Backend
- **`backend/server.js`** - Added `/api/monthly-insights` endpoint
- **`backend/package.json`** - Added `openai` dependency

### Frontend
- **`frontend/app/utils/financeTypes.ts`** - Type definitions for financial data
- **`backend/server.js` → `buildMonthlySnapshotFromFirestore`** - Builds the monthly snapshot from Firestore data (single source of truth)
- **`frontend/app/services/monthlyInsights.ts`** - API service to call backend
- **`frontend/app/screen/WalletOverview.tsx`** - Added AI Analysis UI component

## Setup Instructions

### 1. Backend Setup
1. Add your OpenAI API key to `backend/.env`:
   ```
   OPENAI_API_KEY=sk-your-api-key-here
   ```

2. The OpenAI package is already installed. If you need to reinstall:
   ```bash
   cd backend
   npm install openai
   ```

3. Start the backend server:
   ```bash
   cd backend
   node server.js
   ```

### 2. Frontend Setup
1. Update the backend URL in `frontend/app/services/monthlyInsights.ts` if needed:
   - For Android emulator: Use `http://10.0.2.2:3000`
   - For iOS simulator: Use `http://localhost:3000`
   - For real device: Use your computer's IP (e.g., `http://10.101.126.174:3000`)

2. The feature is automatically available on the Wallet Overview screen (Stats screen).

## How It Works

1. **Data Collection**: The frontend collects:
   - Expense records for the selected month
   - Income records for the selected month
   - Debt information (if available)
   - Previous month data for comparison

2. **Snapshot Building**: `buildMonthlySnapshot()` aggregates:
   - Total income and expenses
   - Savings and savings rate
   - Category breakdowns with month-over-month changes
   - Debt health score (if debts exist)

3. **AI Analysis**: The snapshot is sent to the backend, which:
   - Calls OpenAI API with a carefully crafted system prompt
   - Returns personalized insights and recommendations

4. **Display**: Insights are shown in a styled card on the Wallet Overview screen.

## Usage

1. Navigate to **Wallet Overview** screen (from bottom nav)
2. Select **"Month"** period (AI Analysis only works for monthly periods)
3. Choose the month you want to analyze
4. Click **"Generate Analysis"** button
5. Wait for the AI to generate insights (shows loading state)
6. Read the personalized recommendations
7. Click **"Regenerate"** to get new insights

## Features

- ✅ Non-blocking: If API fails, rest of app still works
- ✅ Loading states with spinner
- ✅ Error handling with user-friendly messages
- ✅ Regenerate button for new insights
- ✅ Only works for monthly periods (prevents confusion)
- ✅ Uses existing data structures (no schema changes)
- ✅ Production-ready error handling

## API Endpoint

**POST** `/api/monthly-insights`

**Request Body:**
```json
{
  "snapshot": {
    "userId": "user123",
    "monthKey": "2025-01",
    "currency": "MYR",
    "totalIncome": 5000,
    "totalExpenses": 3500,
    "savings": 1500,
    "savingsRate": 0.3,
    "categories": [...],
    "debtHealthScore": 75,
    ...
  }
}
```

**Response:**
```json
{
  "insights": "This month you spent most of your money on Food and Shopping..."
}
```

## Notes

- The OpenAI API key must be set in `backend/.env` as `OPENAI_API_KEY`
- The feature uses `gpt-4o-mini` model for cost efficiency
- Insights are limited to 220 words as per requirements
- The system prompt ensures no financial product recommendations
- All analysis is based on actual data from Firestore

