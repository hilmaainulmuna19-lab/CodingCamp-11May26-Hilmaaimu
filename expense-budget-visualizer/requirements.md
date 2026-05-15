# Requirements Document

## Introduction

The Expense & Budget Visualizer is a client-side web application that allows users to track personal expenses, visualize spending by category through charts, manage a transaction list, and monitor their budget against configurable spending limits. The app runs entirely in the browser using HTML, CSS, and Vanilla JavaScript, with all data persisted in the browser's Local Storage. It supports both light and dark modes, custom categories, monthly summaries, and transaction sorting — all without requiring a backend server or complex setup.

## Glossary

- **App**: The Expense & Budget Visualizer web application.
- **Transaction**: A single expense entry consisting of an item name, amount, and category.
- **Category**: A label grouping transactions (e.g., Food, Transport, Fun, or a user-defined custom category).
- **Transaction_List**: The scrollable UI component displaying all recorded transactions.
- **Input_Form**: The UI form used to enter a new transaction's name, amount, and category.
- **Balance_Display**: The UI component showing the total sum of all transaction amounts.
- **Pie_Chart**: The visual chart component showing spending distribution by category.
- **Local_Storage**: The browser's Local Storage API used for client-side data persistence.
- **Spending_Limit**: A user-configured threshold amount per category that triggers a highlight when exceeded.
- **Monthly_Summary**: A filtered view showing transactions and totals for a selected month and year.
- **Sort_Control**: The UI control that allows users to reorder the Transaction_List.
- **Theme_Toggle**: The UI control that switches the App between dark and light visual modes.
- **Category_Manager**: The UI component that allows users to create and manage custom categories.

---

## Requirements

### Requirement 1: Transaction Input

**User Story:** As a user, I want to fill in a form with an item name, amount, and category, so that I can record a new expense transaction.

#### Acceptance Criteria

1. THE Input_Form SHALL provide a text field for the item name, a numeric field for the amount, and a dropdown for the category.
2. WHEN the user submits the Input_Form with all fields filled and a valid positive amount, THE App SHALL add the transaction to the Transaction_List and persist it to Local_Storage.
3. WHEN the user submits the Input_Form with one or more empty fields, THE Input_Form SHALL display a validation error message identifying the missing field(s) and SHALL NOT add a transaction.
4. WHEN the user submits the Input_Form with an amount that is not a positive number, THE Input_Form SHALL display a validation error message and SHALL NOT add a transaction.
5. WHEN a transaction is successfully added, THE Input_Form SHALL reset all fields to their default empty state.

---

### Requirement 2: Transaction List

**User Story:** As a user, I want to see a scrollable list of all my transactions, so that I can review my recorded expenses.

#### Acceptance Criteria

1. THE Transaction_List SHALL display each transaction's item name, amount, and category.
2. WHILE transactions exist in Local_Storage, THE Transaction_List SHALL display all stored transactions on page load.
3. THE Transaction_List SHALL be scrollable only when the number of transactions exceeds the visible area.
4. WHEN the user clicks the delete control on a transaction, THE App SHALL remove that transaction from the Transaction_List and from Local_Storage.

---

### Requirement 3: Total Balance Display

**User Story:** As a user, I want to see my total spending balance at the top of the page, so that I always know how much I have spent in total.

#### Acceptance Criteria

1. THE Balance_Display SHALL show the sum of all transaction amounts.
2. WHEN a transaction is added, THE Balance_Display SHALL update to reflect the new total without requiring a page reload.
3. WHEN a transaction is deleted, THE Balance_Display SHALL update to reflect the new total without requiring a page reload.

---

### Requirement 4: Pie Chart Visualization

**User Story:** As a user, I want to see a pie chart of my spending by category, so that I can understand how my money is distributed.

#### Acceptance Criteria

1. THE Pie_Chart SHALL display each category's proportion of total spending as a distinct segment.
2. WHEN a transaction is added, THE Pie_Chart SHALL update automatically to reflect the new spending distribution.
3. WHEN a transaction is deleted, THE Pie_Chart SHALL update automatically to reflect the updated spending distribution.
4. WHEN no transactions exist, THE Pie_Chart SHALL display an empty or placeholder state with no category segments shown.

---

### Requirement 5: Data Persistence

**User Story:** As a user, I want my transactions to be saved between sessions, so that I do not lose my data when I close or refresh the browser.

#### Acceptance Criteria

1. WHEN a transaction is added, THE App SHALL serialize the transaction data and write it to Local_Storage.
2. WHEN a transaction is deleted, THE App SHALL update the Local_Storage entry to remove the deleted transaction.
3. WHEN the App loads, THE App SHALL read all transactions from Local_Storage and restore the Transaction_List, Balance_Display, and Pie_Chart to their persisted state.
4. IF Local_Storage is unavailable or read fails, THEN THE App SHALL display an error message informing the user that data cannot be saved or loaded.

---

### Requirement 6: Custom Categories

**User Story:** As a user, I want to add my own expense categories, so that I can organize transactions beyond the default options.

#### Acceptance Criteria

1. THE Category_Manager SHALL provide an input field and a submit control for creating a new custom category.
2. WHEN the user submits a non-empty, unique category name via the Category_Manager, THE App SHALL add the new category to the category dropdown in the Input_Form and persist it to Local_Storage.
3. WHEN the user submits an empty or duplicate category name, THE Category_Manager SHALL display a validation error and SHALL NOT add the category.
4. WHEN the App loads, THE App SHALL restore all custom categories from Local_Storage so they are available in the Input_Form dropdown.

---

### Requirement 7: Monthly Summary View

**User Story:** As a user, I want to view a summary of my transactions filtered by month, so that I can track my spending over time.

#### Acceptance Criteria

1. THE Monthly_Summary SHALL provide controls to select a target month and year.
2. WHEN the user selects a month and year, THE Monthly_Summary SHALL display only the transactions recorded in that period.
3. THE Monthly_Summary SHALL display the total spending amount for the selected month and year.
4. WHEN no transactions match the selected month and year, THE Monthly_Summary SHALL display a message indicating no transactions were found for that period.

---

### Requirement 8: Transaction Sorting

**User Story:** As a user, I want to sort my transaction list by amount or category, so that I can find and analyze my expenses more easily.

#### Acceptance Criteria

1. THE Sort_Control SHALL provide options to sort transactions by amount (ascending and descending) and by category (alphabetical).
2. WHEN the user selects a sort option, THE Transaction_List SHALL reorder to reflect the selected sort order without modifying the underlying stored data.
3. WHEN a new transaction is added while a sort option is active, THE Transaction_List SHALL display the new transaction in the correct sorted position.

---

### Requirement 9: Spending Limit Highlight

**User Story:** As a user, I want to set a spending limit per category and be visually alerted when I exceed it, so that I can stay within my budget.

#### Acceptance Criteria

1. THE App SHALL provide an input for the user to set a spending limit amount for each category.
2. WHEN the total spending for a category exceeds its configured spending limit, THE App SHALL visually highlight that category's transactions in the Transaction_List.
3. WHEN the total spending for a category exceeds its configured spending limit, THE App SHALL visually highlight that category's segment in the Pie_Chart.
4. WHEN the total spending for a category is at or below its configured spending limit, THE App SHALL remove the highlight for that category regardless of how that state was reached.
5. WHEN the App loads, THE App SHALL restore all configured spending limits from Local_Storage.

---

### Requirement 10: Dark/Light Mode Toggle

**User Story:** As a user, I want to switch between dark and light display modes, so that I can use the app comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE Theme_Toggle SHALL be visible and accessible at all times within the App.
2. WHEN the user activates the Theme_Toggle, THE App SHALL switch between dark mode and light mode visual styles, with debouncing applied to prevent unintended rapid successive toggles.
3. WHEN the App loads and a theme preference is stored in Local_Storage, THE App SHALL apply that stored theme immediately.
4. IF no theme preference is stored, THEN THE App SHALL apply the light mode theme by default.

---

### Requirement 11: Single-File Architecture

**User Story:** As a developer, I want the app to use exactly one CSS file and one JavaScript file, so that the codebase remains simple and maintainable.

#### Acceptance Criteria

1. THE App SHALL load all styles from a single CSS file located at `css/style.css`.
2. THE App SHALL load all application logic from a single JavaScript file located at `js/app.js`.
3. THE App SHALL NOT require a backend server to run.
4. THE App SHALL function correctly as a standalone web page opened directly in a modern browser (Chrome, Firefox, Edge, Safari).
