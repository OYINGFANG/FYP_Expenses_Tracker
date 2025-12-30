# Auri Database Schema

## Overview
This document provides a detailed database schema for the Auri personal finance management application using Firebase Firestore (NoSQL document database).

**Database:** Firebase Firestore  
**Project ID:** auri-76581  
**Database Type:** NoSQL Document Store

---

## Schema Overview

```
Collections:
├── USERS (Root Collection)
├── EXPENSES (Root Collection)
├── INCOME (Root Collection)
├── BUDGET (Root Collection)
├── DEBTS (Root Collection)
│   └── PAYMENTS (Subcollection)
├── SAVINGS_GOALS (Root Collection)
│   └── CONTRIBUTIONS (Subcollection)
├── SAVINGS_BADGES (Root Collection)
├── NOTIFICATIONS (Root Collection)
├── CHAT_HISTORY (Root Collection)
└── ARCHIVED_RECORDS (Root Collection)
    ├── {userId}/EXPENSES (Subcollection)
    └── {userId}/INCOME (Subcollection)
```

---

## Collection: USERS

**Path:** `/USERS/{uid}`  
**Document ID:** Firebase Auth UID  
**Description:** User account information and preferences

### Schema

| Field Name | Data Type | Required | Default | Description | Constraints |
|------------|-----------|----------|---------|-------------|-------------|
| `uid` | String | ✅ | Auto | Firebase Auth User ID | Primary Key |
| `user_id` | String | ✅ | - | Internal user identifier | Format: Generated ID |
| `username` | String | ✅ | - | Display name | Min: 1 char, Max: 50 chars |
| `user_email` | String | ✅ | - | Email address | Valid email format, Unique |
| `user_password` | String | ✅ | - | Hashed password | Min: 8 chars, Hashed |
| `user_gender` | String | ❌ | null | Gender | Enum: "Male", "Female", "Other" |
| `user_dob` | Timestamp | ❌ | null | Date of birth | ISO 8601 format |
| `accountStatus` | String | ✅ | "Active" | Account status | Enum: "Active", "Suspended", "Deleted" |
| `onboardingCompleted` | Boolean | ✅ | false | Onboarding completion flag | true/false |
| `avatarUrl` | String | ❌ | "" | Profile picture URL | Valid URL format |
| `emailVerified` | Boolean | ✅ | false | Email verification status | true/false |
| `currency` | String | ✅ | "MYR" | Preferred currency | Enum: "MYR", "USD", "SGD", "EUR", "GBP", "JPY", "CNY" |
| `created_at` | Timestamp | ✅ | Server | Creation timestamp | Auto-generated |
| `updated_at` | Timestamp | ✅ | Server | Last update timestamp | Auto-generated |

### Indexes

- **Single-field:** `user_email` (for email lookups)
- **Single-field:** `user_id` (for internal ID lookups)

### Sample Document

```json
{
  "uid": "abc123xyz",
  "user_id": "USR20250101123456",
  "username": "John Doe",
  "user_email": "john.doe@example.com",
  "user_password": "$2b$10$hashed...",
  "user_gender": "Male",
  "user_dob": "1990-01-15T00:00:00Z",
  "accountStatus": "Active",
  "onboardingCompleted": true,
  "avatarUrl": "https://example.com/avatar.jpg",
  "emailVerified": true,
  "currency": "MYR",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

---

## Collection: EXPENSES

**Path:** `/EXPENSES/{docId}`  
**Document ID:** Auto-generated Firestore ID  
**Description:** User expense transactions

### Schema

| Field Name | Data Type | Required | Default | Description | Constraints |
|------------|-----------|----------|---------|-------------|-------------|
| `docId` | String | ✅ | Auto | Firestore document ID | Primary Key |
| `exp_id` | String | ✅ | - | Expense identifier | Format: "EXP{timestamp}", Unique |
| `user_id` | String | ✅ | - | User reference | Format: "/USERS/{uid}", Foreign Key |
| `exp_category` | String | ✅ | - | Expense category | Enum: "Food", "Transport", "Housing", "Shopping", "Bills", "Entertainment", "Healthcare", "Education", "Others" |
| `exp_payment_method` | String | ✅ | - | Payment method | Enum: "Cash", "Bank", "Credit Card" |
| `exp_total` | Number | ✅ | - | Expense amount | > 0, Decimal precision: 2 |
| `exp_notes` | String | ❌ | "" | Additional notes | Max: 500 chars |
| `exp_date` | Timestamp | ✅ | - | Expense date | ISO 8601 format |
| `created_at` | Timestamp | ✅ | Server | Creation timestamp | Auto-generated |
| `updated_at` | Timestamp | ✅ | Server | Last update timestamp | Auto-generated |

### Indexes

- **Composite:** `user_id` (Ascending) + `exp_date` (Ascending)
- **Composite:** `user_id` (Ascending) + `exp_category` (Ascending)
- **Composite:** `user_id` (Ascending) + `exp_date` (Descending) + `created_at` (Descending)

### Sample Document

```json
{
  "docId": "exp_doc_123",
  "exp_id": "EXP1704067200000",
  "user_id": "/USERS/abc123xyz",
  "exp_category": "Food",
  "exp_payment_method": "Credit Card",
  "exp_total": 45.50,
  "exp_notes": "Lunch at restaurant",
  "exp_date": "2024-01-01T12:00:00Z",
  "created_at": "2024-01-01T12:05:00Z",
  "updated_at": "2024-01-01T12:05:00Z"
}
```

---

## Collection: INCOME

**Path:** `/INCOME/{docId}`  
**Document ID:** Auto-generated Firestore ID  
**Description:** User income transactions

### Schema

| Field Name | Data Type | Required | Default | Description | Constraints |
|------------|-----------|----------|---------|-------------|-------------|
| `docId` | String | ✅ | Auto | Firestore document ID | Primary Key |
| `inc_id` | String | ✅ | - | Income identifier | Format: "INC{timestamp}", Unique |
| `user_id` | String | ✅ | - | User reference | Format: "/USERS/{uid}", Foreign Key |
| `inc_category` | String | ✅ | - | Income category | Enum: "Salary", "Investment", "Gift", "Freelance", "Bonus" |
| `inc_payment_method` | String | ✅ | - | Payment method | Enum: "Cash", "Bank", "Credit Card" |
| `inc_total` | Number | ✅ | - | Income amount | > 0, Decimal precision: 2 |
| `inc_notes` | String | ❌ | "" | Additional notes | Max: 500 chars |
| `inc_date` | Timestamp | ✅ | - | Income date | ISO 8601 format |
| `created_at` | Timestamp | ✅ | Server | Creation timestamp | Auto-generated |
| `updated_at` | Timestamp | ✅ | Server | Last update timestamp | Auto-generated |

### Indexes

- **Composite:** `user_id` (Ascending) + `inc_date` (Ascending)
- **Composite:** `user_id` (Ascending) + `inc_category` (Ascending)
- **Composite:** `user_id` (Ascending) + `inc_date` (Descending)

### Sample Document

```json
{
  "docId": "inc_doc_123",
  "inc_id": "INC1704067200000",
  "user_id": "/USERS/abc123xyz",
  "inc_category": "Salary",
  "inc_payment_method": "Bank",
  "inc_total": 5000.00,
  "inc_notes": "Monthly salary",
  "inc_date": "2024-01-01T00:00:00Z",
  "created_at": "2024-01-01T00:05:00Z",
  "updated_at": "2024-01-01T00:05:00Z"
}
```

---

## Collection: BUDGET

**Path:** `/BUDGET/{budId}`  
**Document ID:** Composite key (user_id + month_key)  
**Description:** Monthly budget allocations per user

### Schema

| Field Name | Data Type | Required | Default | Description | Constraints |
|------------|-----------|----------|---------|-------------|-------------|
| `budId` | String | ✅ | - | Budget identifier | Format: "{user_id}_{month_key}", Unique |
| `user_id` | String | ✅ | - | User reference | Format: "/USERS/{uid}", Foreign Key |
| `month_key` | String | ✅ | - | Month identifier | Format: "YYYY-MM" (e.g., "2024-01") |
| `total_budget` | Number | ✅ | - | Total budget amount | >= 0, Decimal precision: 2 |
| `allocations` | Map<String, Number> | ✅ | {} | Category allocations | Key: Category name, Value: Amount |
| `percentages` | Map<String, Number> | ✅ | {} | Category percentages | Key: Category name, Value: 0-100 |
| `created_at` | Timestamp | ✅ | Server | Creation timestamp | Auto-generated |
| `updated_at` | Timestamp | ✅ | Server | Last update timestamp | Auto-generated |

### Indexes

- **Composite:** `user_id` (Ascending) + `month_key` (Ascending) - **UNIQUE**
- **Single-field:** `user_id` (Ascending)

### Sample Document

```json
{
  "budId": "/USERS/abc123xyz_2024-01",
  "user_id": "/USERS/abc123xyz",
  "month_key": "2024-01",
  "total_budget": 3000.00,
  "allocations": {
    "Food": 390.00,
    "Transport": 300.00,
    "Housing": 750.00,
    "Shopping": 180.00,
    "Bills": 360.00,
    "Entertainment": 120.00,
    "Healthcare": 210.00,
    "Education": 60.00,
    "Savings": 600.00,
    "Others": 30.00
  },
  "percentages": {
    "Food": 13,
    "Transport": 10,
    "Housing": 25,
    "Shopping": 6,
    "Bills": 12,
    "Entertainment": 4,
    "Healthcare": 7,
    "Education": 2,
    "Savings": 20,
    "Others": 1
  },
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-15T10:00:00Z"
}
```

---

## Collection: DEBTS

**Path:** `/DEBTS/{docId}`  
**Document ID:** Auto-generated Firestore ID  
**Description:** User debt records

### Schema

| Field Name | Data Type | Required | Default | Description | Constraints |
|------------|-----------|----------|---------|-------------|-------------|
| `docId` | String | ✅ | Auto | Firestore document ID | Primary Key |
| `id` | String | ✅ | - | Debt identifier | Unique |
| `user_id` | String | ✅ | - | User reference | Format: "/USERS/{uid}", Foreign Key |
| `name` | String | ✅ | - | Debt name/description | Min: 1 char, Max: 100 chars |
| `type` | String | ✅ | - | Debt type | Enum: "Credit Card", "Personal Loan", "Mortgage", "Car Loan", "Student Loan", "Medical", "Other" |
| `original_amount` | Number | ✅ | - | Original debt amount | > 0, Decimal precision: 2 |
| `current_balance` | Number | ✅ | - | Current balance | >= 0, Decimal precision: 2 |
| `monthly_payment` | Number | ✅ | - | Monthly payment amount | >= 0, Decimal precision: 2 |
| `target_date` | Timestamp | ❌ | null | Target payoff date | ISO 8601 format |
| `start_date` | Timestamp | ❌ | null | Debt start date | ISO 8601 format |
| `created_at` | Timestamp | ✅ | Server | Creation timestamp | Auto-generated |

### Indexes

- **Composite:** `user_id` (Ascending) + `created_at` (Descending)
- **Single-field:** `user_id` (Ascending)

### Sample Document

```json
{
  "docId": "debt_doc_123",
  "id": "DEBT001",
  "user_id": "/USERS/abc123xyz",
  "name": "Credit Card - Bank ABC",
  "type": "Credit Card",
  "original_amount": 10000.00,
  "current_balance": 7500.00,
  "monthly_payment": 500.00,
  "target_date": "2025-12-31T00:00:00Z",
  "start_date": "2023-01-01T00:00:00Z",
  "created_at": "2023-01-01T00:00:00Z"
}
```

### Subcollection: PAYMENTS

**Path:** `/DEBTS/{debtDocId}/PAYMENTS/{paymentDocId}`  
**Description:** Payment history for each debt

| Field Name | Data Type | Required | Default | Description | Constraints |
|------------|-----------|----------|---------|-------------|-------------|
| `docId` | String | ✅ | Auto | Firestore document ID | Primary Key |
| `id` | String | ✅ | - | Payment identifier | Unique |
| `amount` | Number | ✅ | - | Payment amount | > 0, Decimal precision: 2 |
| `date_iso` | Timestamp | ✅ | - | Payment date | ISO 8601 format |
| `note` | String | ❌ | "" | Payment notes | Max: 200 chars |

**Indexes:**
- **Single-field:** `date_iso` (Descending) - for sorting payments

**Sample Document:**
```json
{
  "docId": "payment_doc_123",
  "id": "PAY001",
  "amount": 500.00,
  "date_iso": "2024-01-15T00:00:00Z",
  "note": "Monthly payment"
}
```

---

## Collection: SAVINGS_GOALS

**Path:** `/SAVINGS_GOALS/{docId}`  
**Document ID:** Auto-generated Firestore ID  
**Description:** User savings goals

### Schema

| Field Name | Data Type | Required | Default | Description | Constraints |
|------------|-----------|----------|---------|-------------|-------------|
| `docId` | String | ✅ | Auto | Firestore document ID | Primary Key |
| `id` | String | ✅ | - | Goal identifier | Unique |
| `user_id` | String | ✅ | - | User reference | Format: "/USERS/{uid}", Foreign Key |
| `name` | String | ✅ | - | Goal name | Min: 1 char, Max: 100 chars |
| `target_amount` | Number | ✅ | - | Target savings amount | > 0, Decimal precision: 2 |
| `current_amount` | Number | ✅ | 0 | Current savings amount | >= 0, Decimal precision: 2 |
| `monthly_target` | Number | ❌ | null | Monthly savings target | > 0, Decimal precision: 2 |
| `deadline` | Timestamp | ❌ | null | Goal deadline | ISO 8601 format |
| `category` | String | ❌ | null | Goal category | Max: 50 chars |
| `notes` | String | ❌ | null | Additional notes | Max: 500 chars |
| `created_at` | Timestamp | ✅ | Server | Creation timestamp | Auto-generated |
| `updated_at` | Timestamp | ✅ | Server | Last update timestamp | Auto-generated |

### Indexes

- **Composite:** `user_id` (Ascending) + `created_at` (Descending)
- **Single-field:** `user_id` (Ascending)

### Sample Document

```json
{
  "docId": "goal_doc_123",
  "id": "GOAL001",
  "user_id": "/USERS/abc123xyz",
  "name": "Emergency Fund",
  "target_amount": 10000.00,
  "current_amount": 3500.00,
  "monthly_target": 500.00,
  "deadline": "2024-12-31T00:00:00Z",
  "category": "Emergency",
  "notes": "6 months of expenses",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-15T10:00:00Z"
}
```

### Subcollection: CONTRIBUTIONS

**Path:** `/SAVINGS_GOALS/{goalDocId}/CONTRIBUTIONS/{contributionDocId}`  
**Description:** Contribution history for each savings goal

| Field Name | Data Type | Required | Default | Description | Constraints |
|------------|-----------|----------|---------|-------------|-------------|
| `docId` | String | ✅ | Auto | Firestore document ID | Primary Key |
| `id` | String | ✅ | - | Contribution identifier | Unique |
| `goalId` | String | ✅ | - | Reference to parent goal | Foreign Key |
| `amount` | Number | ✅ | - | Contribution amount | > 0, Decimal precision: 2 |
| `date` | Timestamp | ✅ | - | Contribution date | ISO 8601 format |
| `source` | String | ❌ | null | Source of contribution | Max: 50 chars |
| `note` | String | ❌ | null | Contribution notes | Max: 200 chars |

**Indexes:**
- **Single-field:** `date` (Descending) - for sorting contributions

**Sample Document:**
```json
{
  "docId": "contrib_doc_123",
  "id": "CONTRIB001",
  "goalId": "GOAL001",
  "amount": 500.00,
  "date": "2024-01-15T00:00:00Z",
  "source": "Salary",
  "note": "Monthly contribution"
}
```

---

## Collection: SAVINGS_BADGES

**Path:** `/SAVINGS_BADGES/{docId}`  
**Document ID:** Auto-generated Firestore ID  
**Description:** Achievement badges earned by users

### Schema

| Field Name | Data Type | Required | Default | Description | Constraints |
|------------|-----------|----------|---------|-------------|-------------|
| `docId` | String | ✅ | Auto | Firestore document ID | Primary Key |
| `id` | String | ✅ | - | Badge identifier | Unique |
| `user_id` | String | ✅ | - | User reference | Format: "/USERS/{uid}", Foreign Key |
| `title` | String | ✅ | - | Badge title | Min: 1 char, Max: 100 chars |
| `description` | String | ✅ | - | Badge description | Max: 500 chars |
| `icon` | String | ✅ | - | Badge icon identifier | Max: 50 chars |
| `earned_at` | Timestamp | ✅ | - | When badge was earned | ISO 8601 format |

### Indexes

- **Composite:** `user_id` (Ascending) + `earned_at` (Descending)
- **Single-field:** `user_id` (Ascending)

### Sample Document

```json
{
  "docId": "badge_doc_123",
  "id": "BADGE001",
  "user_id": "/USERS/abc123xyz",
  "title": "First Savings Goal",
  "description": "Created your first savings goal",
  "icon": "star",
  "earned_at": "2024-01-01T00:00:00Z"
}
```

---

## Collection: NOTIFICATIONS

**Path:** `/NOTIFICATIONS/{docId}`  
**Document ID:** Auto-generated Firestore ID  
**Description:** User notifications

### Schema

| Field Name | Data Type | Required | Default | Description | Constraints |
|------------|-----------|----------|---------|-------------|-------------|
| `docId` | String | ✅ | Auto | Firestore document ID | Primary Key |
| `notification_id` | String | ✅ | - | Notification identifier | Unique |
| `user_id` | String | ✅ | - | User reference | Format: "/USERS/{uid}", Foreign Key |
| `type` | String | ✅ | - | Notification type | Enum: "debtReminder", "debtUnpaidReminder", "savingsReminder", "budgetReminder", "badgeAchievement" |
| `header` | String | ❌ | null | Notification header | Max: 100 chars |
| `title` | String | ✅ | - | Notification title | Min: 1 char, Max: 200 chars |
| `body` | String | ✅ | - | Notification message | Min: 1 char, Max: 1000 chars |
| `created_at` | Timestamp | ✅ | Server | Creation timestamp | Auto-generated |
| `read` | Boolean | ✅ | false | Read status | true/false |
| `debtId` | String | ❌ | null | Reference to DEBTS | Foreign Key (optional) |
| `goalId` | String | ❌ | null | Reference to SAVINGS_GOALS | Foreign Key (optional) |
| `monthKey` | String | ❌ | null | Month reference | Format: "YYYY-MM" |
| `category` | String | ❌ | null | Category reference | Max: 50 chars |
| `badgeId` | String | ❌ | null | Reference to SAVINGS_BADGES | Foreign Key (optional) |

### Indexes

- **Composite:** `user_id` (Ascending) + `created_at` (Descending)
- **Composite:** `user_id` (Ascending) + `read` (Ascending) + `created_at` (Descending)
- **Single-field:** `user_id` (Ascending)

### Sample Document

```json
{
  "docId": "notif_doc_123",
  "notification_id": "NOTIF001",
  "user_id": "/USERS/abc123xyz",
  "type": "budgetReminder",
  "header": "Budget Alert",
  "title": "You've exceeded your Food budget",
  "body": "You've spent 110% of your Food budget this month. Consider reducing expenses in this category.",
  "created_at": "2024-01-15T10:00:00Z",
  "read": false,
  "monthKey": "2024-01",
  "category": "Food"
}
```

---

## Collection: CHAT_HISTORY

**Path:** `/CHAT_HISTORY/{userId}`  
**Document ID:** Firebase Auth UID  
**Description:** AI chat conversation history per user

### Schema

| Field Name | Data Type | Required | Default | Description | Constraints |
|------------|-----------|----------|---------|-------------|-------------|
| `userId` | String | ✅ | - | Firebase Auth UID | Primary Key |
| `user_id` | String | ✅ | - | User path reference | Format: "/USERS/{uid}" |
| `messages` | Array<Message> | ✅ | [] | Chat messages array | Max: 100 messages |
| `updated_at` | Timestamp | ✅ | Server | Last update timestamp | Auto-generated |

### Message Object Schema

| Field Name | Data Type | Required | Description | Constraints |
|------------|-----------|----------|-------------|-------------|
| `id` | Number | ✅ | Message ID | Unique within array |
| `text` | String | ❌ | Message text | Max: 5000 chars (for user/bot messages) |
| `type` | String | ✅ | Message type | Enum: "user", "bot", "pending_transaction" |
| `time` | String | ❌ | Time string | Format: "HH:MM" |
| `date` | String | ❌ | Date string | Format: "YYYY-MM-DD" |
| `timestamp` | String | ❌ | Full timestamp | ISO 8601 format |
| `delivered` | Boolean | ❌ | Delivery status | true/false (for user messages) |
| `chatResponse` | Object | ❌ | Transaction data | For pending_transaction type |

### Indexes

- **Single-field:** `user_id` (Ascending)

### Sample Document

```json
{
  "userId": "abc123xyz",
  "user_id": "/USERS/abc123xyz",
  "messages": [
    {
      "id": 1,
      "text": "Hello! How can I help you today?",
      "type": "bot",
      "time": "10:30",
      "date": "2024-01-15",
      "timestamp": "2024-01-15T10:30:00Z"
    },
    {
      "id": 2,
      "text": "Show me my spending summary",
      "type": "user",
      "time": "10:31",
      "date": "2024-01-15",
      "timestamp": "2024-01-15T10:31:00Z",
      "delivered": true
    }
  ],
  "updated_at": "2024-01-15T10:31:00Z"
}
```

---

## Collection: ARCHIVED_RECORDS

**Path:** `/ARCHIVED_RECORDS/{userId}/{collectionName}/{docId}`  
**Document ID:** Original document ID  
**Description:** Archived old records (older than 2 years)

### Structure

**Main Collection:** `ARCHIVED_RECORDS`  
**Subcollections:**
- `/ARCHIVED_RECORDS/{userId}/EXPENSES/{docId}`
- `/ARCHIVED_RECORDS/{userId}/INCOME/{docId}`

### Schema

| Field Name | Data Type | Required | Description | Constraints |
|------------|-----------|----------|-------------|-------------|
| `archivedAt` | Timestamp | ✅ | When record was archived | Auto-generated |
| `originalCollection` | String | ✅ | Source collection name | Enum: "EXPENSES", "INCOME" |
| `(all original fields)` | Various | ✅ | Original record data | Same as source collection |

### Sample Document

```json
{
  "docId": "archived_exp_123",
  "archivedAt": "2024-01-01T00:00:00Z",
  "originalCollection": "EXPENSES",
  "exp_id": "EXP1609459200000",
  "user_id": "/USERS/abc123xyz",
  "exp_category": "Food",
  "exp_payment_method": "Cash",
  "exp_total": 25.50,
  "exp_notes": "Old expense",
  "exp_date": "2021-01-01T12:00:00Z",
  "created_at": "2021-01-01T12:05:00Z",
  "updated_at": "2021-01-01T12:05:00Z"
}
```

---

## Data Types Reference

### Firestore Data Types

| Type | Description | Example |
|------|-------------|---------|
| **String** | Text data | `"Hello World"` |
| **Number** | Numeric data (integer or float) | `123`, `45.67` |
| **Boolean** | True/false value | `true`, `false` |
| **Timestamp** | Date and time | `Timestamp(seconds=1704067200, nanoseconds=0)` |
| **Map** | Key-value pairs (object) | `{"key": "value"}` |
| **Array** | Ordered list | `["item1", "item2"]` |
| **Null** | Null value | `null` |

### Custom Format Types

| Format | Description | Example |
|--------|-------------|---------|
| **User Path** | User reference format | `"/USERS/{uid}"` |
| **Month Key** | Month identifier | `"2024-01"` |
| **ISO Date** | ISO 8601 date string | `"2024-01-15T10:30:00Z"` |
| **Currency Code** | ISO 4217 currency code | `"MYR"`, `"USD"` |

---

## Indexes Summary

### Required Composite Indexes

1. **EXPENSES:**
   - `user_id` (Ascending) + `exp_date` (Ascending)
   - `user_id` (Ascending) + `exp_category` (Ascending)
   - `user_id` (Ascending) + `exp_date` (Descending) + `created_at` (Descending)

2. **INCOME:**
   - `user_id` (Ascending) + `inc_date` (Ascending)
   - `user_id` (Ascending) + `inc_category` (Ascending)

3. **BUDGET:**
   - `user_id` (Ascending) + `month_key` (Ascending) - **UNIQUE**

4. **DEBTS:**
   - `user_id` (Ascending) + `created_at` (Descending)

5. **SAVINGS_GOALS:**
   - `user_id` (Ascending) + `created_at` (Descending)

6. **SAVINGS_BADGES:**
   - `user_id` (Ascending) + `earned_at` (Descending)

7. **NOTIFICATIONS:**
   - `user_id` (Ascending) + `created_at` (Descending)
   - `user_id` (Ascending) + `read` (Ascending) + `created_at` (Descending)

### Single-Field Indexes

All collections have automatic single-field indexes on:
- `user_id` (for user-based queries)
- `created_at` (for sorting)

---

## Validation Rules

### Field Validation

1. **Required Fields:** All required fields must be present and non-null
2. **String Length:** String fields have maximum length constraints
3. **Number Range:** Numbers must be within valid ranges (e.g., amounts > 0)
4. **Enum Values:** Enum fields must match predefined values
5. **Format Validation:** Dates, emails, and IDs must match specified formats

### Business Rules

1. **User Isolation:** All queries must filter by `user_id` for data security
2. **Unique Constraints:** `exp_id`, `inc_id`, `budId` must be unique
3. **Referential Integrity:** Foreign key references must point to existing documents
4. **Date Consistency:** `updated_at` must be >= `created_at`
5. **Amount Validation:** Financial amounts must be >= 0 (expenses/income > 0)

---

## Security Rules (Firestore)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read/write their own data
    match /USERS/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /EXPENSES/{expenseId} {
      allow read, write: if request.auth != null && 
        resource.data.user_id == '/USERS/' + request.auth.uid;
    }
    
    match /INCOME/{incomeId} {
      allow read, write: if request.auth != null && 
        resource.data.user_id == '/USERS/' + request.auth.uid;
    }
    
    // Similar rules for other collections...
  }
}
```

---

## Data Migration Notes

1. **Archiving:** Records older than 2 years are automatically archived
2. **User Path Normalization:** All `user_id` fields are normalized to `/USERS/{uid}` format
3. **Timestamp Conversion:** Dates stored as Firestore Timestamps are converted to ISO strings in application layer
4. **Currency Default:** New users default to "MYR" currency

---

## Performance Considerations

1. **Query Optimization:** Always include `user_id` in queries for efficient filtering
2. **Index Usage:** Use composite indexes for complex queries
3. **Pagination:** Large result sets should use pagination (limit + cursor)
4. **Caching:** Frequently accessed data (like user preferences) is cached in AsyncStorage
5. **Real-time Subscriptions:** Use `onSnapshot()` for real-time updates instead of polling

---

## Notes

- **NoSQL Design:** Firestore is a NoSQL database, so relationships are maintained through references
- **Document Size Limit:** Maximum document size is 1 MB
- **Collection Size:** No limit on collection size, but consider sharding for very large collections
- **Subcollections:** Used for hierarchical data (PAYMENTS under DEBTS, CONTRIBUTIONS under SAVINGS_GOALS)
- **Auto-generated Fields:** `created_at` and `updated_at` use `serverTimestamp()` for consistency












