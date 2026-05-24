# Finance Tracker UI Layout Guide

This document describes the full layout of the web app and what each element represents.

## Global Layout (All Tabs)

- App shell: full-height page with a light gray background and centered content container.
- Top navigation bar: primary navigation and account controls.
- Page header: greeting, active tab selector, and primary action button.
- Content area: tab-specific layout below the header.
- Toast notifications: temporary messages at bottom-right.
- Transaction form modal: overlay form for adding new transactions.

## Top Navigation Bar

- Logo badge (leaf icon): brand identity and dashboard entry.
- Account breadcrumb: shows "Personal account" and current dashboard context.
- Search bar (desktop only): quick search field (UI only).
- Messages icon: placeholder for messaging (UI only).
- Notifications bell: shows recent activity from latest transactions.
- User avatar + name: opens profile menu.
- Profile menu:
  - Settings: navigates to the Settings tab.
  - Help: placeholder item.
  - Sign out: demo alert (no real auth).
- Mobile menu:
  - Search input and quick tab buttons.
  - Message and alert shortcuts.

## Page Header

- Greeting text: personalized "Good morning" with the user display name.
- Subtitle: indicates the dashboard report context.
- Primary action button: "Add Transaction" opens the transaction form modal.
- Tab selector: switches between Overview, Analytics, Transactions, and Settings.

## Overview Tab

The Overview tab is a two-column layout on desktop and a single column on mobile.

### Left Column

- Balance card:
  - "My balance" shows current balance.
  - Percentage chip shows change vs last month.
  - Total income and total expenses summarize totals.
- Stat cards (2):
  - Monthly income and monthly expenses with icons and % change.
- Statistics chart:
  - Area chart comparing total income vs total expenses by month.
  - Period selector (Monthly) is static UI.
  - Average income and average expenses summary row.

### Right Column

- All income panel:
  - Period tabs (Daily/Weekly/Monthly) for income totals.
  - Concentric ring chart shows category percentages.
  - Legend lists top categories with percentage share.
  - Empty state indicates no income data.
- All expenses panel:
  - Mirrors the income panel for expense totals and category share.
  - Empty state indicates no expense data.
- Promo banner (green card):
  - "New feature" badge, headline, and subtitle.
  - CTA button triggers a "coming soon" toast.

### Transactions preview (bottom)

- Transaction list card:
  - Search input and filter toggle.
  - Filter bar for type and sort (when enabled).
  - Scrollable list of recent transactions with delete action.
  - Empty state explains no transactions yet.

## Analytics Tab

- Summary stat row:
  - Total transactions, highest expense, savings rate.
- Income by category chart:
  - Horizontal bar chart of income totals by category.
- Expenses by category chart:
  - Horizontal bar chart of expense totals by category.
- Monthly net savings chart:
  - Bar chart of net income (income minus expense) per month.

## Transactions Tab

- Header row:
  - "All Transactions" with total count.
  - Export CSV button.
- Filter and sort bar:
  - Search input for filtering by text.
  - Type toggles (All/Income/Expense).
  - Sort buttons for date, amount, category, and type.
- Transactions table:
  - Desktop table view with actions.
  - Mobile card view with delete button.
  - Empty state when no matches.

## Settings Tab

- Profile card:
  - Update display name.
  - Avatar initials preview.
- Data card:
  - Local storage count of transactions.
  - Export all data to CSV.
  - Clear all transactions (danger zone).
- About card:
  - App version and technology stack.
  - Link to GitHub repository.

## Transaction Form Modal

- Type toggle: select Income or Expense.
- Description, amount, category, and date fields.
- Validation errors shown inline.
- Submit button adds a transaction and closes the modal.

## Toast Notifications

- Success, error, or info messages.
- Auto-dismiss after a short delay, with manual close button.
