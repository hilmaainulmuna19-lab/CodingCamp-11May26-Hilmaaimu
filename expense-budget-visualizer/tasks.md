# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a fully client-side single-page application using HTML, CSS, and Vanilla JavaScript. The app follows a unidirectional data flow pattern: every user action mutates the in-memory `AppState`, persists the relevant slice to `localStorage`, and re-renders the affected UI components. All logic lives in `js/app.js`, all styles in `css/style.css`, and the entry point is `index.html`. Tests are written with Jest + jsdom + fast-check in a `tests/` directory.

---

## Tasks

- [ ] 1. Set up project structure, HTML skeleton, and test environment
  - Create `index.html` with all required element IDs: `#input-form`, `#item-name`, `#amount`, `#category-select`, `#add-btn`, `#form-error`, `#transaction-list`, `#balance-display`, `#pie-chart` (canvas), `#category-manager`, `#new-category-input`, `#add-category-btn`, `#category-error`, `#monthly-summary`, `#month-select`, `#year-input`, `#apply-summary-btn`, `#summary-list`, `#summary-total`, `#summary-empty`, `#sort-control`, `#sort-select`, `#limit-manager`, `#theme-toggle`, `#storage-error`
  - Link `css/style.css` and `js/app.js` in `index.html`
  - Create `css/style.css` with CSS custom properties for light/dark themes using `[data-theme="dark"]` selector, base layout, and scrollable transaction list styles
  - Create `js/app.js` with the `AppState` object definition and section comment scaffolding (State, Storage, Validation, Transactions, Categories, Limits, Rendering, Theme, Init)
  - Initialise `package.json` with `jest`, `jest-environment-jsdom`, and `fast-check` as dev dependencies; configure Jest to use `jsdom` environment
  - Create `tests/` directory with a placeholder test file to confirm the test runner works
  - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 2. Implement State, Storage, and Persistence
  - [ ] 2.1 Implement `AppState` initialisation and `loadFromStorage()`
    - Define `AppState` with `transactions`, `categories` (seeded with `["Food", "Transport", "Fun"]` on first load), `limits`, `theme`, and `sortOrder`
    - Implement `loadFromStorage()` reading keys `ebv_transactions`, `ebv_categories`, `ebv_limits`, `ebv_theme`; wrap all `localStorage` access in `try/catch`; fall back to empty defaults and show `#storage-error` banner on failure or malformed JSON
    - _Requirements: 5.3, 5.4, 6.4, 9.5, 10.3, 10.4_

  - [ ] 2.2 Implement `saveTransactions()`, `saveCategories()`, `saveLimits()`, `saveTheme()`
    - Each function serialises the relevant `AppState` slice to the corresponding `localStorage` key; wrap in `try/catch` and show `#storage-error` on failure
    - _Requirements: 5.1, 5.2, 6.2, 9.5, 10.2_

  - [ ]* 2.3 Write property test for transaction persistence round-trip (Property 4)
    - **Property 4: Transaction persistence round-trip**
    - Generate arbitrary valid transactions; assert that after `saveTransactions()` + `loadFromStorage()` the transaction is present with all fields equal
    - **Validates: Requirements 5.1, 5.2, 5.3, 2.2**

  - [ ]* 2.4 Write property test for category persistence round-trip (Property 5)
    - **Property 5: Category persistence round-trip**
    - Generate arbitrary non-empty, non-duplicate category name strings; assert that after `saveCategories()` + `loadFromStorage()` the category appears in the restored list
    - **Validates: Requirements 6.2, 6.4**

  - [ ]* 2.5 Write property test for spending limits persistence round-trip (Property 11)
    - **Property 11: Spending limits persistence round-trip**
    - Generate arbitrary objects mapping category names to positive limit amounts; assert that after `saveLimits()` + `loadFromStorage()` `AppState.limits` equals the original object
    - **Validates: Requirements 9.5**

- [ ] 3. Implement Validation
  - [ ] 3.1 Implement `validateTransaction(name, amount, category)`
    - Return an error object when name is empty, amount is non-positive, or category is empty; return `null` on valid input
    - _Requirements: 1.3, 1.4_

  - [ ] 3.2 Implement `validateCategory(name, existingCategories)`
    - Return an error when name is empty, whitespace-only, or duplicates an existing category; return `null` on valid input
    - _Requirements: 6.3_

  - [ ]* 3.3 Write property test for invalid transaction rejection (Property 2)
    - **Property 2: Invalid transaction is rejected**
    - Generate transactions with at least one invalid field (empty name OR non-positive amount OR empty category); assert transaction list length unchanged and validation error returned
    - **Validates: Requirements 1.3, 1.4**

  - [ ]* 3.4 Write property test for whitespace/duplicate category rejection (Property 10)
    - **Property 10: Whitespace-only and duplicate category names are rejected**
    - Generate strings composed entirely of whitespace and strings duplicating existing category names; assert `validateCategory()` returns an error and category list is unchanged
    - **Validates: Requirements 6.3**

- [ ] 4. Implement Transaction Operations and Balance
  - [ ] 4.1 Implement `addTransaction(name, amount, category)` and `deleteTransaction(id)`
    - `addTransaction`: generate ID via `crypto.randomUUID()` (fallback to `Date.now().toString() + Math.random()`), push to `AppState.transactions`, call `saveTransactions()`, reset form fields, call render functions
    - `deleteTransaction`: filter out the matching ID from `AppState.transactions`, call `saveTransactions()`, call render functions
    - _Requirements: 1.2, 1.5, 2.4, 5.1, 5.2_

  - [ ]* 4.2 Write property test for valid transaction addition grows the list (Property 1)
    - **Property 1: Valid transaction addition grows the list**
    - Generate arbitrary valid transactions; assert `AppState.transactions.length` increases by exactly 1 and the new entry is present
    - **Validates: Requirements 1.2, 2.1**

  - [ ] 4.3 Implement `renderBalanceDisplay()`
    - Sum all `AppState.transactions` amounts and write the formatted total to `#balance-display`
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 4.4 Write property test for balance equals sum of all transaction amounts (Property 3)
    - **Property 3: Balance equals sum of all transaction amounts**
    - Generate arbitrary arrays of valid transactions; assert `renderBalanceDisplay()` output equals `transactions.reduce((s, t) => s + t.amount, 0)`
    - **Validates: Requirements 3.1, 3.2, 3.3**

- [ ] 5. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Implement Category Management and Pie Chart
  - [ ] 6.1 Implement `addCategory(name)` and `renderCategoryDropdown()`
    - `addCategory`: validate via `validateCategory()`, push to `AppState.categories`, call `saveCategories()`, call `renderCategoryDropdown()` and `renderLimitInputs()`
    - `renderCategoryDropdown`: rebuild `#category-select` options from `AppState.categories`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 6.2 Implement `getCategoryTotals()`
    - Aggregate `AppState.transactions` amounts by category and return a `Map<string, number>`
    - _Requirements: 4.1_

  - [ ]* 6.3 Write property test for pie chart category totals sum to total spending (Property 6)
    - **Property 6: Pie chart category totals sum to total spending**
    - Generate arbitrary non-empty arrays of valid transactions; assert `sum(getCategoryTotals().values())` equals `transactions.reduce((s, t) => s + t.amount, 0)`
    - **Validates: Requirements 4.1**

  - [ ] 6.4 Implement `renderPieChart()`
    - Draw proportional segments on `<canvas id="pie-chart">` using Canvas 2D API; derive segment colours via HSL hashing of category name; draw dashed border or hatching on over-limit segments; render grey placeholder circle with "No data" label when no transactions exist; hide canvas and show fallback `<p>` if Canvas API is unavailable
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 9.3_

- [ ] 7. Implement Spending Limits
  - [ ] 7.1 Implement `setSpendingLimit(category, value)` and `isOverLimit(category)`
    - `setSpendingLimit`: update `AppState.limits[category]`, call `saveLimits()`, re-render transaction list and pie chart
    - `isOverLimit`: return `true` iff sum of that category's transaction amounts exceeds `AppState.limits[category]`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ] 7.2 Implement `renderLimitInputs()`
    - Dynamically generate one `<input type="number">` per category inside `#limit-manager`; pre-fill with stored limit values; wire `change` event to `setSpendingLimit()`
    - _Requirements: 9.1, 9.5_

  - [ ]* 7.3 Write property test for over-limit highlight correctness (Property 8)
    - **Property 8: Over-limit categories are highlighted; under-limit are not**
    - Generate arbitrary category name, array of transaction amounts, and spending limit value; assert `isOverLimit(category)` returns `true` iff `sum(amounts) > limit`
    - **Validates: Requirements 9.2, 9.3, 9.4**

- [ ] 8. Implement Transaction List Rendering and Sorting
  - [ ] 8.1 Implement `getSortedTransactions()`
    - Return a sorted copy of `AppState.transactions` according to `AppState.sortOrder` (`amount-asc`, `amount-desc`, `category-asc`); do NOT mutate `AppState.transactions` or the localStorage entry
    - _Requirements: 8.1, 8.2_

  - [ ]* 8.2 Write property test for sorting does not mutate stored data (Property 7)
    - **Property 7: Sorting does not mutate stored data**
    - Generate arbitrary arrays of valid transactions and arbitrary sort orders; assert `AppState.transactions` order and localStorage content are unchanged after `getSortedTransactions()` is called
    - **Validates: Requirements 8.2**

  - [ ] 8.3 Implement `renderTransactionList()`
    - Build `<li>` elements from `getSortedTransactions()`; each item shows item name, amount, category badge, and delete button; apply over-limit highlight class to items whose category exceeds its limit; wire delete button to `deleteTransaction(id)`; handle empty state
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 8.3, 9.2_

  - [ ] 8.4 Wire `#sort-select` change event
    - On change, update `AppState.sortOrder` and call `renderTransactionList()`; does not persist sort order to localStorage
    - _Requirements: 8.1, 8.2, 8.3_

- [ ] 9. Implement Monthly Summary
  - [ ] 9.1 Implement monthly filter logic and `renderMonthlySummary()`
    - Filter `AppState.transactions` by matching month and year from the transaction's ISO date string; populate `#summary-list` with matching transactions; update `#summary-total` with their sum; show `#summary-empty` when no matches; wire `#apply-summary-btn` click event
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 9.2 Write property test for monthly summary shows only matching transactions (Property 9)
    - **Property 9: Monthly summary shows only matching transactions**
    - Generate arbitrary arrays of transactions with arbitrary ISO dates and arbitrary target month (1–12) and year; assert every transaction in the filtered result has matching month+year, no non-matching transaction appears, and displayed total equals sum of filtered amounts
    - **Validates: Requirements 7.2, 7.3**

- [ ] 10. Implement Theme Toggle
  - [ ] 10.1 Implement `applyTheme(theme)` and `toggleTheme()`
    - `applyTheme`: set `data-theme` attribute on `<html>` element to `"light"` or `"dark"`; call `saveTheme()`
    - `toggleTheme`: flip current theme with a 300 ms debounce to prevent rapid toggling; wire to `#theme-toggle` click/change event
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 11. Implement `init()` and wire all event handlers
  - [ ] 11.1 Implement `init()` bootstrapping
    - Call `loadFromStorage()`, then call all render functions (`renderCategoryDropdown()`, `renderTransactionList()`, `renderBalanceDisplay()`, `renderPieChart()`, `renderMonthlySummary()`, `renderLimitInputs()`), and apply stored theme; register `DOMContentLoaded` listener
    - _Requirements: 2.2, 5.3, 6.4, 9.5, 10.3, 10.4_

  - [ ] 11.2 Wire `#input-form` submit event
    - On submit: call `validateTransaction()`; display errors in `#form-error` or call `addTransaction()` and trigger full re-render
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [ ] 11.3 Wire `#category-manager` submit event
    - On submit: call `validateCategory()`; display errors in `#category-error` or call `addCategory()`
    - _Requirements: 6.1, 6.2, 6.3_

- [ ] 12. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical milestones
- Property tests validate universal correctness properties using fast-check (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- The `getSortedTransactions()` function MUST return a copy — never sort in place
- All `localStorage` access MUST be wrapped in `try/catch`; show `#storage-error` on any failure
- ID generation uses `crypto.randomUUID()` with a fallback for older browsers
- Canvas API unavailability must be handled gracefully with a `<p>` fallback

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3.1", "3.2"] },
    { "id": 1, "tasks": ["2.2", "4.1", "6.1", "6.2"] },
    { "id": 2, "tasks": ["2.3", "2.4", "2.5", "3.3", "3.4", "4.2", "4.3", "6.3", "7.1", "8.1"] },
    { "id": 3, "tasks": ["4.4", "6.4", "7.2", "8.2", "8.3", "9.1", "10.1"] },
    { "id": 4, "tasks": ["7.3", "8.4", "9.2", "11.1"] },
    { "id": 5, "tasks": ["11.2", "11.3"] }
  ]
}
```
