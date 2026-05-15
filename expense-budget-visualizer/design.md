# Design Document: Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a fully client-side single-page application (SPA) built with HTML, CSS, and Vanilla JavaScript. It requires no build tools, no backend, and no external runtime dependencies beyond a modern browser. All state is persisted in the browser's `localStorage`.

The application provides:
- A transaction input form for recording expenses
- A scrollable transaction list with delete and sort controls
- A live-updating balance display
- A pie chart showing spending distribution by category
- Custom category management
- Per-category spending limits with visual highlights
- A monthly summary filter
- A dark/light theme toggle

The design prioritises simplicity: one HTML file, one CSS file (`css/style.css`), and one JavaScript file (`js/app.js`). No frameworks, no bundlers, no npm.

---

## Architecture

The app follows a **unidirectional data flow** pattern implemented without a framework:

```
User Action
    │
    ▼
Event Handler (js/app.js)
    │
    ▼
State Mutation (in-memory AppState object)
    │
    ├──► Persist to localStorage
    │
    └──► Re-render affected UI components
```

All application state lives in a single in-memory `AppState` object. Every user action mutates this object, persists the relevant slice to `localStorage`, and then calls the appropriate render function(s) to update the DOM. There is no two-way binding — the DOM is always derived from `AppState`.

### Module Boundaries (within `js/app.js`)

Although the entire logic lives in one file, it is organised into clearly separated logical sections using comments and function groupings:

| Section | Responsibility |
|---|---|
| **State** | `AppState` object definition and initialisation |
| **Storage** | `loadFromStorage()`, `saveTransactions()`, `saveCategories()`, `saveLimits()`, `saveTheme()` |
| **Validation** | `validateTransaction()`, `validateCategory()` |
| **Transactions** | `addTransaction()`, `deleteTransaction()`, `getSortedTransactions()` |
| **Categories** | `addCategory()`, `getCategoryTotals()` |
| **Limits** | `setSpendingLimit()`, `isOverLimit()` |
| **Rendering** | `renderTransactionList()`, `renderBalanceDisplay()`, `renderPieChart()`, `renderCategoryDropdown()`, `renderMonthlySummary()`, `renderLimitInputs()` |
| **Theme** | `applyTheme()`, `toggleTheme()` |
| **Init** | `init()` — bootstraps the app on `DOMContentLoaded` |

### File Structure

```
index.html
css/
  style.css
js/
  app.js
```

---

## Components and Interfaces

### Input Form (`#input-form`)

- Fields: `#item-name` (text), `#amount` (number), `#category-select` (select)
- Submit button: `#add-btn`
- Error container: `#form-error`
- On submit: validates inputs → calls `addTransaction()` → resets form

### Transaction List (`#transaction-list`)

- Container: `<ul id="transaction-list">`
- Each item: `<li>` with item name, amount, category badge, delete button
- Overflow handled via CSS `overflow-y: auto` with a fixed max-height
- Delete button calls `deleteTransaction(id)`

### Balance Display (`#balance-display`)

- Single `<span>` or `<div>` showing the formatted sum of all amounts
- Updated by `renderBalanceDisplay()` after every add/delete

### Pie Chart (`#pie-chart`)

- Rendered on an HTML5 `<canvas>` element using the Canvas 2D API — no external charting library
- Segments drawn proportionally by category total
- Each segment uses a deterministic colour derived from the category name (HSL hashing)
- Empty state: draws a grey placeholder circle with a "No data" label
- Over-limit categories receive a visual indicator (dashed border or hatching on the segment)

### Category Manager (`#category-manager`)

- Input: `#new-category-input` (text)
- Submit: `#add-category-btn`
- Error: `#category-error`
- On submit: validates → calls `addCategory()` → updates `#category-select`

### Monthly Summary (`#monthly-summary`)

- Month selector: `<select id="month-select">` (values 1–12)
- Year selector: `<input type="number" id="year-input">`
- Apply button: `#apply-summary-btn`
- Output: `#summary-list` (filtered transaction list) and `#summary-total`
- Empty state: `#summary-empty` message

### Sort Control (`#sort-control`)

- `<select id="sort-select">` with options: `amount-asc`, `amount-desc`, `category-asc`
- On change: calls `getSortedTransactions()` → calls `renderTransactionList()`
- Does not mutate `AppState.transactions` — sorting is applied at render time only

### Spending Limit Inputs (`#limit-manager`)

- Dynamically generated: one `<input type="number">` per category
- On change: calls `setSpendingLimit(category, value)` → re-renders list and chart

### Theme Toggle (`#theme-toggle`)

- A `<button>` or `<input type="checkbox">` toggling a `data-theme` attribute on `<html>`
- Debounced with a 300 ms delay to prevent rapid toggling
- CSS variables in `style.css` handle all colour switching based on `[data-theme="dark"]`

---

## Data Models

All data is stored in `localStorage` as JSON strings. The in-memory `AppState` mirrors this structure.

### Transaction

```js
{
  id: string,          // crypto.randomUUID() or Date.now().toString()
  name: string,        // item name, non-empty
  amount: number,      // positive float
  category: string,    // category label
  date: string         // ISO 8601 date string, e.g. "2025-05-11T14:30:00.000Z"
}
```

### Category

```js
string  // e.g. "Food", "Transport", "Fun", "Custom Category"
```

Stored as a JSON array: `["Food", "Transport", "Fun", "Custom Category"]`

Default categories (`["Food", "Transport", "Fun"]`) are seeded on first load if `localStorage` has no categories key.

### Spending Limit

```js
{
  [category: string]: number  // e.g. { "Food": 500, "Transport": 200 }
}
```

### AppState (in-memory)

```js
{
  transactions: Transaction[],
  categories: string[],
  limits: { [category: string]: number },
  theme: "light" | "dark",
  sortOrder: "amount-asc" | "amount-desc" | "category-asc" | null
}
```

### localStorage Keys

| Key | Value |
|---|---|
| `ebv_transactions` | JSON array of Transaction objects |
| `ebv_categories` | JSON array of category strings |
| `ebv_limits` | JSON object mapping category → limit amount |
| `ebv_theme` | `"light"` or `"dark"` |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Valid transaction addition grows the list

*For any* transaction list state and any valid transaction (non-empty name, positive amount, non-empty category), adding that transaction SHALL result in the transaction list containing exactly one more entry than before, and the new entry SHALL be present in the list.

**Validates: Requirements 1.2, 2.1**

### Property 2: Invalid transaction is rejected

*For any* input where at least one field is invalid (empty name, non-positive amount, or empty category), submitting the form SHALL leave the transaction list unchanged and SHALL produce a validation error.

**Validates: Requirements 1.3, 1.4**

### Property 3: Balance equals sum of all transaction amounts

*For any* set of transactions, the value shown in the Balance_Display SHALL equal the arithmetic sum of all transaction amounts in that set — both after additions and after deletions.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 4: Transaction persistence round-trip

*For any* valid transaction added to the app, serialising the AppState to localStorage and then deserialising it (simulating a page reload via `loadFromStorage()`) SHALL produce a transaction list that contains an entry with all fields equal to the original transaction.

**Validates: Requirements 5.1, 5.2, 5.3, 2.2**

### Property 5: Category persistence round-trip

*For any* valid (non-empty, non-duplicate) custom category name added via `addCategory()`, serialising and deserialising the categories from localStorage SHALL produce a category list that includes the added category name.

**Validates: Requirements 6.2, 6.4**

### Property 6: Pie chart category totals sum to total spending

*For any* non-empty set of transactions, the sum of all per-category totals returned by `getCategoryTotals()` SHALL equal the sum of all individual transaction amounts.

**Validates: Requirements 4.1**

### Property 7: Sorting does not mutate stored data

*For any* array of transactions and any sort order applied via `getSortedTransactions()`, the `AppState.transactions` array and the corresponding localStorage entry SHALL remain in their original insertion order after the sort operation.

**Validates: Requirements 8.2**

### Property 8: Over-limit categories are highlighted; under-limit are not

*For any* category with a configured spending limit, if the sum of that category's transaction amounts exceeds the limit then `isOverLimit()` SHALL return `true` and the category SHALL be highlighted; if the sum is at or below the limit then `isOverLimit()` SHALL return `false` and the category SHALL NOT be highlighted.

**Validates: Requirements 9.2, 9.3, 9.4**

### Property 9: Monthly summary shows only matching transactions

*For any* array of transactions with arbitrary dates and any target month and year, every transaction returned by the monthly filter SHALL have a date whose month and year match the selection, and no transaction with a non-matching date SHALL appear in the result.

**Validates: Requirements 7.2, 7.3**

### Property 10: Whitespace-only and duplicate category names are rejected

*For any* string composed entirely of whitespace characters, or any string that duplicates an existing category name, `validateCategory()` SHALL return an error and the category list SHALL remain unchanged.

**Validates: Requirements 6.3**

### Property 11: Spending limits persistence round-trip

*For any* set of per-category spending limits saved via `saveLimits()`, deserialising from localStorage via `loadFromStorage()` SHALL restore `AppState.limits` to an object equal to the saved limits.

**Validates: Requirements 9.5**

---

## Error Handling

| Scenario | Handling |
|---|---|
| `localStorage` unavailable (private browsing, quota exceeded) | Wrap all `localStorage` calls in `try/catch`; display a persistent banner `#storage-error` informing the user that data cannot be saved |
| `localStorage` read returns malformed JSON | `JSON.parse` wrapped in `try/catch`; fall back to empty defaults and display a warning |
| Transaction form submitted with empty fields | Inline error message in `#form-error`; form not submitted |
| Transaction form submitted with non-positive amount | Inline error message in `#form-error`; form not submitted |
| Category form submitted with empty/duplicate name | Inline error message in `#category-error`; category not added |
| `crypto.randomUUID()` unavailable (very old browsers) | Fall back to `Date.now().toString() + Math.random()` for ID generation |
| Canvas API unavailable | Hide `#pie-chart` canvas and show a `<p>` fallback message |

---

## Testing Strategy

### Approach

This feature is a pure client-side Vanilla JS application with no build pipeline. Testing uses **Jest** (with `jsdom` environment) for unit and property-based tests, and **fast-check** as the property-based testing library.

```
npm install --save-dev jest jest-environment-jsdom fast-check
```

Tests live in a `tests/` directory alongside the source files.

### Unit Tests

Unit tests cover specific examples, edge cases, and integration points:

- `validateTransaction()` — empty name, zero amount, negative amount, valid input
- `validateCategory()` — empty string, whitespace-only, duplicate, valid new name
- `addTransaction()` / `deleteTransaction()` — state mutations and localStorage writes
- `getSortedTransactions()` — each sort mode with a fixed dataset
- `getCategoryTotals()` — correct aggregation across multiple transactions
- `isOverLimit()` — at-limit (not highlighted), one cent over (highlighted)
- `applyTheme()` — correct `data-theme` attribute set on `<html>`
- `renderBalanceDisplay()` — correct formatted total rendered to DOM
- Monthly summary filter — correct filtering by month/year
- `localStorage` failure — error banner displayed when storage throws
- Empty pie chart state — placeholder rendered when no transactions exist
- Theme default — light mode applied when no preference stored

### Property-Based Tests (fast-check, minimum 100 iterations each)

Each property test is tagged with a comment referencing the design property it validates.

**Feature: expense-budget-visualizer, Property 1: Valid transaction addition grows the list**
- Generate: arbitrary valid transaction (non-empty name string, positive float amount, non-empty category string)
- Assert: `AppState.transactions.length` increases by exactly 1 and the new entry is present

**Feature: expense-budget-visualizer, Property 2: Invalid transaction is rejected**
- Generate: transactions with at least one invalid field (empty name OR non-positive amount OR empty category)
- Assert: transaction list length unchanged; validation error returned

**Feature: expense-budget-visualizer, Property 3: Balance equals sum of all transaction amounts**
- Generate: arbitrary array of valid transactions
- Assert: `renderBalanceDisplay()` output equals `transactions.reduce((s, t) => s + t.amount, 0)`

**Feature: expense-budget-visualizer, Property 4: Transaction persistence round-trip**
- Generate: arbitrary valid transaction
- Assert: after `saveTransactions()` + `loadFromStorage()`, the transaction is present in the restored list with all fields equal

**Feature: expense-budget-visualizer, Property 5: Category persistence round-trip**
- Generate: arbitrary non-empty, non-duplicate category name string
- Assert: after `saveCategories()` + `loadFromStorage()`, the category appears in the restored list

**Feature: expense-budget-visualizer, Property 6: Pie chart category totals sum to total spending**
- Generate: arbitrary non-empty array of valid transactions
- Assert: `sum(getCategoryTotals().values())` equals `transactions.reduce((s, t) => s + t.amount, 0)`

**Feature: expense-budget-visualizer, Property 7: Sorting does not mutate stored data**
- Generate: arbitrary array of valid transactions, arbitrary sort order
- Assert: `AppState.transactions` order and localStorage content are unchanged after `getSortedTransactions()` is called

**Feature: expense-budget-visualizer, Property 8: Over-limit categories are highlighted; under-limit are not**
- Generate: arbitrary category name, arbitrary array of transaction amounts for that category, arbitrary spending limit value
- Assert: `isOverLimit(category)` returns `true` iff `sum(amounts) > limit`

**Feature: expense-budget-visualizer, Property 9: Monthly summary shows only matching transactions**
- Generate: arbitrary array of transactions with arbitrary ISO dates, arbitrary target month (1–12) and year
- Assert: every transaction in the filtered result has matching month+year; no non-matching transaction appears; displayed total equals sum of filtered amounts

**Feature: expense-budget-visualizer, Property 10: Whitespace-only and duplicate category names are rejected**
- Generate: strings composed entirely of whitespace characters (spaces, tabs, newlines), and strings duplicating existing category names
- Assert: `validateCategory()` returns an error; category list unchanged

**Feature: expense-budget-visualizer, Property 11: Spending limits persistence round-trip**
- Generate: arbitrary object mapping category names to positive limit amounts
- Assert: after `saveLimits()` + `loadFromStorage()`, `AppState.limits` equals the original limits object
