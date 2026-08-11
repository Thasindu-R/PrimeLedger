# 💰 PrimeLedger

A personal finance management application: a **React** and **TypeScript** frontend
over a **Spring Boot** API backed by PostgreSQL. Log income and expenses, track
your balance, and visualise spending patterns.

> **This README still describes the original frontend-only app.** Phases 2 and 3
> added the API, Supabase authentication and row-level security, and the sections
> below have not caught up — treat [backend/README.md](backend/README.md) and
> [docs/api.md](docs/api.md) as authoritative for anything server-side. Only the
> setup and Docker instructions have been brought up to date.

---

## 📸 Preview

<!-- Replace with a real screenshot once the app is complete -->
> _Screenshot coming soon_

---

## ✨ Features

- **Add, edit & delete transactions** — log income or expenses with description, amount, category, and date
- **Live balance** — running total updates instantly as you add or remove entries
- **Real period comparison** — month-over-month deltas computed from your data, or an honest "no prior month" when there is nothing to compare
- **Category tracking** — 13 categories, derived from the type system so the form and the types can never drift apart
- **Visual charts** — income/expense trend and category breakdowns powered by Recharts, bucketed by `YYYY-MM`
- **Filter & sort** — filter by type, category, date range, amount range, or keyword search
- **Bookmarkable routes** — `/overview`, `/analytics`, `/transactions`, `/settings` are real URLs with working browser history
- **Persistent storage** — all data saved to `localStorage`; survives page refresh with no login required
- **Fully typed** — end-to-end TypeScript with strict interfaces and union types
- **Tested** — Vitest + React Testing Library, with a regression test behind every fixed defect

---

## 🛠️ Tech Stack

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

---

## 📁 Project Structure

A monorepo, so an API change and its consumer change land in one reviewable
pull request. Directories marked with a phase are scaffolded but empty — they
are filled in when that phase runs.

```
primeledger/
├── frontend/                 React 19 · TypeScript · Vite · Tailwind
│   ├── src/
│   │   ├── api/              typed client, one module per resource   [Phase 4]
│   │   ├── components/       presentational components
│   │   │   └── ui/           Skeleton · ErrorState · EmptyState
│   │   │                     Pagination · CurrencyInput             [Phase 4]
│   │   ├── config/           env.ts — typed import.meta.env
│   │   ├── context/          AuthProvider · ThemeProvider           [Phase 3]
│   │   ├── hooks/            useTransactions · useProfile · useToast
│   │   ├── lib/              queryClient · formatters               [Phase 4]
│   │   ├── pages/
│   │   │   ├── app/          Overview · Analytics · Transactions · Settings
│   │   │   │                 Budgets · Goals · Accounts        [Phases 5–6]
│   │   │   ├── auth/         SignUp · SignIn · ForgotPassword
│   │   │   │                 ResetPassword · VerifyEmail           [Phase 3]
│   │   │   └── ledgerContext.ts   typed Outlet context for the app pages
│   │   ├── schemas/          Zod schemas shared by forms and parsing [Phase 4]
│   │   ├── test/             Vitest setup and factories
│   │   ├── types/            interfaces and union types
│   │   ├── utils/            dates · csv · timeSeries · periodComparison
│   │   ├── App.tsx           router shell — owns state, hands out context
│   │   └── main.tsx          entry point
│   ├── Dockerfile            multi-stage build, Nginx serves the output
│   └── .env.example
├── backend/                  Spring Boot 4.1 · Java 21              [Phase 2]
│   ├── src/main/java/com/primeledger/    twelve feature packages
│   ├── src/main/resources/db/migration/  Flyway V1–V4
│   ├── src/test/java/                    JUnit 5 unit tests
│   ├── src/integrationTest/java/         Testcontainers suite
│   ├── .env.example
│   └── README.md             package layout and Phase 2 starting point
├── docs/
│   ├── architecture.md
│   ├── api.md
│   └── adr/                  architecture decision records
├── .github/workflows/        frontend-ci · backend-ci · deploy      [Phase 8]
├── docker-compose.yml        local Postgres, plus the API from Phase 2
└── README.md
```

Backend packages are organised **by feature, not by layer** — controller,
service, repository, entity and DTOs for one feature live together. See
[`backend/README.md`](backend/README.md).

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
git clone git@github.com:Thasindu-R/PrimeLedger.git
cd PrimeLedger
```

**2. Install dependencies**

The frontend is a workspace of its own, so npm runs from `frontend/`, not the
repository root.

```bash
cd frontend
npm install
```

**3. Start the dev server**

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

**4. Optional — run the API alongside it**

```bash
docker compose up -d db     # from the repository root
./backend/gradlew -p backend bootRun
```

The API serves <http://localhost:8080>, with Swagger UI at `/swagger-ui.html`.
See [backend/README.md](backend/README.md) for the two database roles it uses and
why they are separate.

---

## 🐳 Docker

There is no image at the repository root — the frontend and the API each have
their own Dockerfile.

**Frontend** (production build served by Nginx)

```bash
docker build -t primeledger-web ./frontend
docker run -p 8080:80 primeledger-web
```

**The whole stack** (Postgres + API)

```bash
docker compose up -d
docker compose logs -f backend
```

> The Dockerfile uses a **multi-stage build** — Node.js compiles and bundles the app in Stage 1, and a lightweight Nginx image serves the static output in Stage 2. The final image contains no Node.js or source files.

---

## 📜 Available Scripts

|        Command         |                 Description                    |
|------------------------|------------------------------------------------|
| `npm run dev`          | Start Vite development server with hot reload  |
| `npm run build`        | Compile TypeScript and bundle for production   |
| `npm run preview`      | Preview the production build locally           |
| `npm test`             | Run Vitest in watch mode                       |
| `npm run test:run`     | Run the test suite once (what CI runs)         |
| `npm run test:coverage`| Run the suite with a V8 coverage report        |
| `npm run typecheck`    | Type-check the entire project without building |
| `npm run lint`         | Run ESLint across the project                  |

> Copy `frontend/.env.example` to `frontend/.env.local` before running the dev server if you need
> to point the app at a non-default API URL. Every variable is read through `src/config/env.ts`.

---

## 🧩 Architecture Notes

### Custom Hook — `useTransactions`

All application logic lives in one custom hook (`src/hooks/useTransactions.ts`). It exposes:

- **CRUD** — `addTransaction`, `editTransaction`, `deleteTransaction`, `clearAll`
- **Filtering** — `filters`, `updateFilters`, `resetFilters`, `filteredTransactions`
- **Sorting** — `sort`, `updateSort` (toggles a column), `setSort` (sets field and direction together), `sortedTransactions`
- **Summaries** — `summary`, `filteredSummary`
- **Chart data** — `incomeByCategory`, `expenseByCategory`

Components receive data and callbacks via props — no global state library needed at this scale.
`App.tsx` is the router shell: it owns the hook and hands a typed context to the four routed
pages, which pass plain props down to the presentational components below them. That keeps the
data seam in one place for the backend migration.

### Routing

`react-router-dom` drives four routes — `/overview`, `/analytics`, `/transactions`, `/settings` —
with `/` redirecting to the overview and unknown paths falling back to it. The Docker/Nginx config
already serves `index.html` for unmatched paths, so deep links work in the container too.

### Correctness notes

- Money-adjacent time series bucket by `YYYY-MM`, never by month index, so the same month in two
  different years stays in two different buckets.
- Transaction dates are plain calendar strings; "today" is read from local calendar fields rather
  than `toISOString()`, which returns the UTC day and is off by one for much of the day in `Asia/Colombo`.
- Percentage changes return `null` instead of `Infinity`/`NaN` when there is no prior period, and the
  UI says so rather than printing a number.

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

---

## 🔮 Possible Improvements

- [x] Edit existing transactions in-place
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

**Thasindu Ramsitha** — Undergraduate - BSc(Hons) Computer Science, University of Colombo School of Computing

- GitHub: [@Thasindu_R](https://github.com/Thasindu-R)
- LinkedIn: [Thasindu Ramsitha](https://www.linkedin.com/in/thasindu-ramsitha-3b42a91b4?utm_source=share_via&utm_content=profile&utm_medium=member_android)
