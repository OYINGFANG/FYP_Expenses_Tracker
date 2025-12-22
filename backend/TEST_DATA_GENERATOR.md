# Test Data Generator

This script generates comprehensive, realistic test data for the Auri finance app.

## Overview

The script generates 6 months of detailed financial data for two users with different financial health profiles:

- **User 1** (`euOFFpQCOAb1XJJJl6Z62hcPWFU2`): **BAD health score**
  - Low income (RM 4,500/month)
  - High expenses relative to income (often overspending)
  - Very low savings (5% savings rate or less)
  - Few savings goals with minimal progress
  - Multiple high-balance debts
  - Budget often exceeded (115% of income)
  - 20-30 expenses per month
  - Missed debt payments and savings contributions

- **User 2** (`UrSjv1G4wrOjsotNyOr6FH6UhS63`): **HIGH health score**
  - High income (RM 8,500/month + bonuses + freelance)
  - Low expenses relative to income (60-70% spending)
  - Excellent savings (25% savings rate)
  - Multiple savings goals (some completed)
  - Minimal or no debt
  - Budget well within income (75% of income)
  - 18-25 expenses per month
  - Consistent payments and contributions

## What Gets Generated

For each user, the script creates:

1. **Expenses** (6 months)
   - 15-25 transactions per month
   - Realistic Malaysian Ringgit amounts
   - Various categories: Food, Transport, Housing, Shopping, Bills, Entertainment, Healthcare, Education, Others
   - Realistic merchant names (McDonald's, Grab, etc.)
   - Random dates throughout each month
   - Mix of payment methods (Cash, Bank, Credit Card)

2. **Income** (6 months)
   - Monthly salary (on 1st or 2nd of month)
   - Occasional bonuses (for high health user)
   - Freelance income (occasional)
   - Investment returns (occasional)

3. **Savings Goals**
   - Bad health: 1-2 goals with very low progress (struggling to save)
   - High health: 4 goals (1 completed, 3 in progress with consistent contributions)
   - Monthly contributions with realistic progress (missed payments for bad health)

4. **Debts**
   - Bad health: 2-3 high-balance debts (Credit Card, Personal Loan, possibly Car Loan)
   - High health: Minimal or no debt (30% chance of small credit card debt)
   - Payment history for each debt (missed/partial payments for bad health)

5. **Budget Allocations**
   - Monthly budget records for 6 months
   - Realistic category allocations based on recommended percentages
   - Bad health: Budget exceeds income (115%), high debt allocation (15%), low savings (5%)
   - High health: Budget well within income (75%), high savings (25%), no debt allocation (0%)

## Usage

### Basic Usage (Default Users)

```bash
cd backend
node generateTestData.js
```

Or using npm script:

```bash
cd backend
npm run generate-test-data
```

### Custom User IDs

```bash
node generateTestData.js [userId1] [userId2]
```

Example:
```bash
node generateTestData.js euOFFpQCOAb1XJJJl6Z62hcPWFU2 UrSjv1G4wrOjsotNyOr6FH6UhS63
```

## Important Notes

1. **Append Mode**: The script appends data to existing records. It does NOT delete existing data.

2. **Firebase Admin**: Requires Firebase Admin SDK to be properly configured with service account JSON file.

3. **Realistic Data**: All amounts are in Malaysian Ringgit (RM) and use realistic values:
   - Food: RM 8-150
   - Transport: RM 5-200
   - Housing: RM 800-3,500
   - Shopping: RM 20-800
   - And more...

4. **Date Distribution**: Expenses are distributed throughout each month with realistic times (8 AM - 10 PM).

5. **Batch Writes**: Uses Firestore batch writes for efficiency (500 operations per batch).

## Data Quality

The generated data is designed to:
- ✅ Provide enough transactions for accurate AI analysis
- ✅ Include edge cases (missed payments, completed goals, etc.)
- ✅ Use realistic Malaysian context (merchants, amounts, payment methods)
- ✅ Create different financial health profiles for testing
- ✅ Include relationships (savings contributions linked to goals, debt payments linked to debts)

## Troubleshooting

### Firebase Admin Error
If you see "Firebase Admin initialization failed":
- Ensure `auri-76581-firebase-adminsdk-fbsvc-1122c9b7d7.json` exists in the `backend/` directory
- Check that the service account has proper Firestore permissions

### Batch Limit Error
If you see batch limit errors:
- The script automatically handles batch limits (500 operations)
- If issues persist, reduce the number of months or transactions

### Duplicate Data
- The script uses timestamps and random IDs to avoid duplicates
- Running multiple times will create additional records (append mode)

## Example Output

```
🚀 Starting Test Data Generation
================================

User 1: euOFFpQCOAb1XJJJl6Z62hcPWFU2 (BAD/LOW health score)
User 2: UrSjv1G4wrOjsotNyOr6FH6UhS63 (GOOD/HIGH health score)
Months: 6
Mode: Append (won't delete existing data)

📊 Generating data for user: euOFFpQCOAb1XJJJl6Z62hcPWFU2 (bad health score)
  📅 Generating 2024-09...
  📅 Generating 2024-10...
  ...
  💰 Generating savings goals...
  💳 Generating debts...
  💾 Writing to Firestore...
  ✅ Completed! Generated:
     - 138 expenses
     - 18 income records
     - 6 budget records
     - 4 savings goals
     - 0 debts

✅ All data generation completed successfully!
💡 You can now test your app with realistic data.
```

## Next Steps

After generating test data:
1. Open your app and sign in as one of the test users
2. Verify data appears correctly in all screens
3. Test AI analysis features with the comprehensive data
4. Check that financial health scores match expectations
5. Test edge cases (completed goals, debt payments, etc.)

