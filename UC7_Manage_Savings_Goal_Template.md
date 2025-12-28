# Use Case Specification: UC7_Manage_Savings_Goal

## Use Case
UC7_Manage_Savings_Goal

## Description
This use case describes the functionality for users to create, view, edit, delete, and track progress towards their savings goals. Users can set up savings goals with target amounts, track their current savings, add contributions, set deadlines, and view progress through visual indicators. The system also awards badges when goals are completed and provides filtering capabilities to organize goals by status.

## Actor
- User (authenticated user of the application)

## Precondition / Dependency
1. User must be authenticated and signed in to the application
2. User must have a valid `userId` stored in AsyncStorage or Firebase Auth
3. Firebase Firestore database must be accessible
4. User's currency preference must be configured (defaults to MYR)
5. For viewing goals, the `SAVINGS_GOALS` collection in Firestore must be accessible
6. For adding contributions, the goal must exist in the `SAVINGS_GOALS` collection

## Postcondition
1. Savings goal is successfully created, updated, or deleted in Firestore `SAVINGS_GOALS` collection
2. Goal data is synchronized and displayed in real-time to the user
3. If a goal is completed (currentAmount >= targetAmount), badges are checked and awarded if applicable
4. If a contribution is added, an expense record is created in the `EXPENSES` collection with category "Savings"
5. Notification reminders are synchronized for goals with deadlines
6. User can view their goals with progress indicators, filters, and contribution history
7. Badge notifications are created when new badges are earned

## Standard Process

### Main Flow: Create a Savings Goal

1. User navigates to the Savings screen (`/screen/Savings`)
2. System loads the Savings screen and displays existing goals (if any) and summary statistics
3. User taps the "+" button in the header to add a new goal
4. System opens the "Add Goal" modal (`GoalEditor` component)
5. User enters the following information:
   - **Goal Name** (required): e.g., "House downpayment"
   - **Target Amount (MYR)** (required): e.g., 50000
   - **Current Amount (MYR)** (optional, defaults to 0): e.g., 10000
   - **Monthly Target (MYR)** (optional): e.g., 1000
   - **Deadline** (optional): User selects a date using the date picker
   - **Notes** (optional): Additional information about the goal
6. User taps "Save" button
7. System validates the input:
   - Goal name must not be empty
   - Target amount must be a valid positive number
   - Current amount must not be negative
   - Current amount must not exceed target amount
8. If validation passes:
   - System generates a unique goal ID (timestamp-based if new goal)
   - System calls `upsertSavingsGoal()` function with the goal data
   - System creates a new document in Firestore `SAVINGS_GOALS` collection with fields:
     - `user_id`: `/USERS/{userId}`
     - `name`: Goal name
     - `target_amount`: Target amount
     - `current_amount`: Current amount (defaults to 0 for new goals)
     - `monthly_target`: Monthly target (null if not provided)
     - `deadline`: Deadline timestamp (null if not provided)
     - `category`: Category (null if not provided)
     - `notes`: Notes (null if not provided)
     - `created_at`: Server timestamp
     - `updated_at`: Server timestamp
   - System calls `syncSavingsReminderForGoal()` to set up notification reminders
   - System calls `checkAndAwardSavingsBadges()` to check if any badges should be awarded
   - If new badges are earned, system displays an achievement modal
   - System closes the modal and updates the goals list via real-time subscription
9. User sees the new goal in the Active Goals list with progress bar and details
10. Goal is displayed with:
    - Goal name and completion status chip (if completed)
    - Progress bar showing percentage completion
    - Current amount / Target amount display
    - Remaining amount or extra saved amount (if completed)
    - Monthly target (if set)
    - Deadline information or months remaining (if applicable)
    - Overdue indicator (if deadline has passed)
    - Edit and Delete action buttons
    - "Add Contribution" button (if not completed)
    - Recent contributions list (if any)

### Main Flow: Add Contribution to Savings Goal

1. User views a savings goal in the Active Goals list
2. User taps the "Add Contribution" button on the goal card
3. System opens the "Add Contribution" modal (`ContributionModal` component)
4. System pre-fills the amount field with the goal's monthly target (if set)
5. User enters contribution details:
   - **Amount (MYR)** (required): Contribution amount
   - **Date** (required): Date of contribution (defaults to today, max date is today)
   - **Source** (optional): e.g., "Salary", "Bonus"
   - **Note** (optional): Additional notes about the contribution
6. User taps "Add Contribution" button
7. System validates the input:
   - Amount must be a valid positive number
8. If validation passes:
   - System calls `addSavingsContribution()` function
   - System performs a Firestore transaction:
     - Reads the goal document to get current `current_amount`
     - Calculates new amount: `current_amount + contribution_amount`
     - Creates a new document in the `CONTRIBUTIONS` subcollection with:
       - `user_id`: `/USERS/{userId}`
       - `amount`: Contribution amount
       - `date`: Contribution date timestamp
       - `source`: Source (null if not provided)
       - `note`: Note (null if not provided)
       - `created_at`: Server timestamp
     - Updates the goal document's `current_amount` to the new total
     - Updates the goal document's `updated_at` timestamp
   - System creates an expense record in the `EXPENSES` collection:
     - `exp_category`: "Savings"
     - `exp_payment_method`: Source or "Cash" (default)
     - `exp_total`: Contribution amount
     - `exp_notes`: "Savings contribution to: {goal_name}" + note (if provided)
     - `exp_date`: Contribution date
   - System calls `checkAndAwardSavingsBadges()` to check for badge awards
   - If new badges are earned, system displays an achievement modal
   - System displays success alert: "Contribution Added! Contribution of {amount} has been recorded."
   - System closes the modal
9. Goal's current amount is updated and progress bar reflects the new progress
10. Contribution appears in the "Recent Contributions" section (up to 3 most recent)
11. If goal becomes completed (currentAmount >= targetAmount):
    - Goal is marked with "Completed" chip
    - Progress bar shows 100% completion
    - "Add Contribution" button is hidden
    - Goal may be moved to Completed Goals section (depending on filter settings)

## Alternative Process

### Alternative Flow 1: Edit Existing Savings Goal

1. User views a savings goal in the Goals list
2. User taps the edit icon (pencil icon) on the goal card
3. System opens the "Edit Goal" modal with pre-filled values from the existing goal
4. User modifies any of the goal fields:
   - Goal Name
   - Target Amount
   - Current Amount
   - Monthly Target
   - Deadline (can be cleared)
   - Notes
5. User taps "Save" button
6. System validates the input (same validation as create flow)
7. If validation passes:
   - System calls `upsertSavingsGoal()` with the goal ID and updated data
   - System updates the existing document in Firestore using `setDoc()` with `merge: true`
   - Only provided fields are updated; existing fields are preserved if not modified
   - System calls `syncSavingsReminderForGoal()` to update notification reminders
   - System calls `checkAndAwardSavingsBadges()` to check for badge awards (especially if goal becomes completed)
   - If new badges are earned, system displays an achievement modal
   - System closes the modal and updates the goal display
8. Goal card reflects the updated information

### Alternative Flow 2: Delete Savings Goal

1. User views a savings goal in the Goals list
2. User taps the delete icon (trash icon) on the goal card
3. System displays a confirmation alert: "Delete goal - This will remove the goal and all contribution history."
4. User confirms deletion by tapping "Delete" button
5. If user cancels, alert is dismissed and no action is taken
6. If user confirms:
   - System calls `deleteSavingsGoalDeep()` function
   - System retrieves all contributions from the `CONTRIBUTIONS` subcollection
   - System uses a batched write to delete:
     - All contribution documents in the subcollection
     - The goal document itself
   - System calls `cancelSavingsReminder()` to cancel notification reminders for the goal
   - System displays success message (if applicable)
7. Goal is removed from the goals list via real-time subscription update
8. Summary statistics are updated to reflect the removal

### Alternative Flow 3: Filter Goals by Status

1. User is viewing the Savings screen with multiple goals
2. User taps the "Filter" button in the Active Goals section header
3. System opens the Filter modal
4. User selects a filter option:
   - **All**: Shows all active goals
   - **Active**: Shows only non-overdue active goals
   - **Overdue**: Shows only goals with passed deadlines
   - **Not Completed**: Shows all active (not completed) goals
   - **Completed**: Shows only completed goals (hides active goals section)
5. User taps "Apply" button
6. System applies the selected filter and updates the displayed goals:
   - Active goals list is filtered based on the selection
   - Completed goals list is shown/hidden based on the selection
   - Filter status chip is displayed showing the active filter
   - User can tap "Clear All" to reset filters to "All"
7. Goals are re-sorted if needed (overdue goals appear first)

### Alternative Flow 4: View Completed Goals

1. User has completed goals (currentAmount >= targetAmount)
2. User scrolls to the "Completed Goals" section
3. System displays all completed goals with:
   - Green completion styling
   - "Completed" chip with trophy icon
   - Progress bar showing 100% completion
   - "Extra Saved" amount (if currentAmount > targetAmount)
   - "Goal completed 🎉" message
   - Edit and Delete buttons still available
   - "Add Contribution" button is hidden
4. User can toggle visibility of completed goals using the "Show/Hide" button
5. User's preference is saved to AsyncStorage as `showCompletedSavingsGoals`

### Alternative Flow 5: View Goal Details and Badges

1. User views the Savings screen
2. User can see the "Achievements" section with badge cards
3. User taps on a badge card to view details
4. System opens the Badge Details modal showing:
   - Badge icon and title
   - Badge description
   - Requirement text
   - Progress information (for unearned badges)
   - Earned status indicator
5. User taps "Got it!" or "Close" to dismiss the modal
6. User can also manually check for badges by tapping the refresh icon in the Achievements header
7. System calls `checkAndAwardSavingsBadges()` and displays results

## Exception Flow

### Exception 1: Validation Failures

1. User attempts to save a goal with invalid data:
   - **Empty goal name**: System displays alert "Missing info - Please enter a goal name."
   - **Invalid or zero target amount**: System displays alert "Missing info - Please enter a valid target amount."
   - **Negative current amount**: System displays alert "Invalid amount - Current amount cannot be negative."
   - **Current amount exceeds target**: System displays alert "Invalid amount - Current amount cannot exceed target amount."
2. User attempts to add a contribution with invalid data:
   - **Invalid or zero amount**: System displays alert "Invalid amount - Please enter a valid contribution amount."
3. User must correct the input and retry the operation

### Exception 2: User Not Authenticated

1. User attempts to create/edit/delete a goal or add a contribution
2. System checks for `userId` from AsyncStorage or Firebase Auth
3. If `userId` is null or user is not authenticated:
   - System displays alert "Not signed in - Please sign in first."
   - Operation is cancelled
4. User must sign in before proceeding

### Exception 3: Network/Firestore Errors

1. System attempts to save/update/delete a goal or add a contribution
2. Firestore operation fails (network error, permission denied, etc.)
3. System catches the error and displays an alert:
   - Create/Update: "Save failed - {error message}"
   - Delete: "Delete failed - {error message}"
   - Add Contribution: "Contribution failed - {error message}"
4. Error is logged to console for debugging
5. User can retry the operation after resolving the issue

### Exception 4: Goal Not Found During Contribution

1. User attempts to add a contribution to a goal
2. System performs a Firestore transaction to read the goal
3. Goal document does not exist or was deleted
4. Transaction throws error: "Savings goal not found"
5. System displays alert "Contribution failed - Savings goal not found"
6. User returns to the goals list (goal should be removed via real-time subscription)

### Exception 5: Loading State

1. User navigates to the Savings screen
2. System is loading goals from Firestore
3. System displays loading indicator with message "Loading your savings goals…"
4. Once goals are loaded (or if there are no goals), loading indicator is dismissed
5. If loading fails, system displays error (handled by subscription error callback) and shows empty state

### Exception 6: Empty State

1. User has no savings goals
2. System displays empty state in the Active Goals section:
   - Trophy outline icon
   - "No active savings goals" message
   - "Tap the + button to create your first savings goal" instruction
3. User can create their first goal using the "+" button

### Exception 7: Filter Returns No Results

1. User applies a filter that matches no goals
2. System displays empty state:
   - Search outline icon
   - "No goals match your filters" message
   - "Try adjusting your filter options" instruction
3. User can adjust filters or clear filters to see goals again

### Exception 8: Badge Check Failures

1. System attempts to check and award badges after goal operations
2. Badge check operation fails (Firestore error, etc.)
3. System logs error to console but does not block the main operation
4. Goal creation/update/contribution still succeeds
5. Badges may be checked manually later using the refresh button

### Exception 9: Notification Reminder Sync Failure

1. System attempts to sync notification reminders for a goal
2. Notification sync fails (permissions not granted, etc.)
3. System logs error to console but does not block the main operation
4. Goal creation/update still succeeds
5. User may still receive notifications if previously set up

### Exception 10: Expense Record Creation Failure

1. System attempts to create an expense record after adding a contribution
2. Expense creation fails (Firestore error, etc.)
3. System logs error to console but does not fail the contribution
4. Contribution is still successfully added to the goal
5. Expense record creation is a secondary operation and failure does not affect the main flow

### Exception 11: Invalid Date Selection

1. User attempts to set a deadline in the date picker
2. For goal deadlines, system enforces `minimumDate` as today (deadlines cannot be in the past)
3. For contribution dates, system enforces `maximumDate` as today (contributions cannot be in the future)
4. If user tries to select an invalid date, date picker prevents selection
5. User must select a valid date to proceed

### Exception 12: Real-time Subscription Errors

1. System subscribes to goals, contributions, or badges using Firestore `onSnapshot`
2. Subscription encounters an error (permission denied, network error, etc.)
3. Error callback is triggered and logs error to console
4. System returns empty array to callback (goals: [], contributions: [], badges: [])
5. User may see empty state until subscription recovers or user refreshes


