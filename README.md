# 💰 Finance Tracker

A personal finance management web app built with **React** and **TypeScript**. Log income and expenses, track your balance, and visualize spending patterns — all stored locally in your browser with no backend required.

> Built as a portfolio project to demonstrate React component architecture, TypeScript type safety, custom hooks, and data visualization.

---

## 📸 Preview

<!-- Replace with a real screenshot once the app is complete -->
> _Screenshot coming soon_

---

## ✨ Features

- **Add & delete transactions** — log income or expenses with description, amount, category, and date
- **Live balance** — running total updates instantly as you add or remove entries
- **Category tracking** — organize transactions across 11 predefined categories
- **Visual charts** — bar chart (income vs expense) and pie chart (spending by category) powered by Recharts
- **Filter & sort** — filter by type, category, date range, amount range, or keyword search
- **Persistent storage** — all data saved to `localStorage`; survives page refresh with no login required
- **Fully typed** — end-to-end TypeScript with strict interfaces and union types

---

## 🛠️ Tech Stack

|-------------------|------------------------------------------------|
|       Layer       |                  Technology                    |
|-------------------|------------------------------------------------|
| UI framework      | [React 19](https://react.dev)                  |
| Language          | [TypeScript 5](https://www.typescriptlang.org) |
| Build tool        | [Vite](https://vitejs.dev)                     |
| Styling           | [Tailwind CSS](https://tailwindcss.com)        |
| Charts            | [Recharts](https://recharts.org)               |
| Icons             | [Lucide React](https://lucide.dev)             |
| Containerization  | [Docker](https://www.docker.com) + Nginx       |
| Package manager   | npm                                            |
|-------------------|------------------------------------------------|
---

## 📁 Project Structure

```
finance-tracker/
├── src/
│   ├── components/
│   │   ├── TransactionForm.tsx     # Controlled form with validation
│   │   ├── TransactionList.tsx     # Filterable, sortable transaction list
│   │   ├── TransactionItem.tsx     # Single transaction row with delete
│   │   ├── SummaryCards.tsx        # Balance, income, expense stat cards
│   │   └── SummaryChart.tsx        # Recharts bar + pie charts
│   ├── hooks/
│   │   └── useTransactions.ts      # Core state — CRUD, filtering, sorting, summaries
│   ├── types/
│   │   └── index.ts                # All TypeScript interfaces and union types
│   ├── utils/
│   │   └── formatCurrency.ts       # Currency formatting helpers
│   ├── App.tsx                     # Root component — wires everything together
│   └── main.tsx                    # React entry point
├── public/
├── Dockerfile                      # Multi-stage production build
├── .dockerignore
├── .gitignore
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org) v18 or higher
- [npm](https://www.npmjs.com) v9 or higher
- [Git](https://git-scm.com)

### Local Development

**1. Clone the repository**

```bash
git clone git@github.com:YOUR_USERNAME/finance-tracker.git
cd finance-tracker
```

**2. Install dependencies**

```bash
npm install
```

**3. Start the dev server**

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🐳 Docker

Run the production build inside a Docker container using Nginx:

**Build the image**

```bash
docker build -t finance-tracker .
```

**Run the container**

```bash
docker run -p 8080:80 finance-tracker
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

> The Dockerfile uses a **multi-stage build** — Node.js compiles and bundles the app in Stage 1, and a lightweight Nginx image serves the static output in Stage 2. The final image contains no Node.js or source files.

---

## 📜 Available Scripts

|--------------------|------------------------------------------------|
|      Command       |                 Description                    |
|--------------------|------------------------------------------------|
| `npm run dev`      | Start Vite development server with hot reload  |
| `npm run build`    | Compile TypeScript and bundle for production   |
| `npm run preview`  | Preview the production build locally           |
| `npx tsc --noEmit` | Type-check the entire project without building |
|--------------------|------------------------------------------------|

---

## 🧩 Architecture Notes

### Custom Hook — `useTransactions`

All application logic lives in one custom hook (`src/hooks/useTransactions.ts`). It exposes:

- **CRUD** — `addTransaction`, `editTransaction`, `deleteTransaction`, `clearAll`
- **Filtering** — `filters`, `updateFilters`, `resetFilters`, `filteredTransactions`
- **Sorting** — `sort`, `updateSort`, `sortedTransactions`
- **Summaries** — `summary`, `filteredSummary`
- **Chart data** — `incomeByCategory`, `expenseByCategory`

Components receive data and callbacks via props — no global state library needed at this scale.

### TypeScript Patterns Used

- **Union types** for constrained string values (`'income' | 'expense'`)
- **Interfaces** for all object shapes (`Transaction`, `Summary`, `TransactionFilters`)
- **`Omit<T, K>`** utility type to exclude `id` from form submission data
- **`Partial<T>`** utility type for edit payloads
- **`React.ChangeEvent<T>`** and **`React.FormEvent<T>`** for fully typed event handlers
- **Generic `useState<T>`** for typed state initialization

### Data Persistence

Transactions are serialized to JSON and stored in `localStorage` under the key `finance_tracker_transactions`. Data is loaded once on mount using React's lazy state initialization pattern and synced back on every state change via `useEffect`.

---

## 🗂️ Transaction Categories

|------------|---------------|
|   Income   |    Expense    |
|------------|---------------|
| Salary     | Food          |
| Freelance  | Transport     |
| Investment | Shopping      |
| Gift       | Utilities     |
| Other      | Entertainment |
|            | Health        |
|            | Education     |
|            | Other         |
|------------|---------------|

---

## 🔮 Possible Improvements

- [ ] Edit existing transactions in-place
- [ ] Monthly view with date navigation
- [ ] CSV export
- [ ] Multiple currency support
- [ ] Budget limits per category with alerts
- [ ] Dark mode

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 👤 Author

**Thasindu** — Undergraduate - BSc(Hons) Computer Science, University of Colombo School of Computing

- GitHub: [@Thasindu_R](https://github.com/Thasindu-R)
- LinkedIn: [Thasindu Ramsitha](https://www.linkedin.com/in/thasindu-ramsitha-3b42a91b4?utm_source=share_via&utm_content=profile&utm_medium=member_android)
