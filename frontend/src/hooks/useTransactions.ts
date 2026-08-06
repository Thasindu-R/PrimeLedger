import { useState, useEffect, useMemo, useCallback } from 'react';
import { type Transaction, type TransactionType, type Summary } from '../types';

const STORAGE_KEY = 'finance_tracker_transactions';

export interface TransactionFilters {
  type?: TransactionType;
  category?: string;
  startDate?: string;   
  endDate?: string;     
  search?: string;      
  minAmount?: number;
  maxAmount?: number;
}

export type SortField = 'date' | 'amount' | 'category' | 'type';
export type SortOrder = 'asc' | 'desc';

export interface SortConfig {
  field: SortField;
  order: SortOrder;
}

function loadFromStorage(): Transaction[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Transaction[];
  } catch {
    return [];
  }
}

function saveToStorage(transactions: Transaction[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function applyFilters(
  transactions: Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  return transactions.filter((t) => {
    if (filters.type && t.type !== filters.type) return false;
    if (filters.category && t.category !== filters.category) return false;

    if (filters.startDate && t.date < filters.startDate) return false;
    if (filters.endDate && t.date > filters.endDate) return false;

    if (filters.minAmount !== undefined && t.amount < filters.minAmount) return false;
    if (filters.maxAmount !== undefined && t.amount > filters.maxAmount) return false;

    if (filters.search) {
      const term = filters.search.toLowerCase();
      const inDescription = t.description?.toLowerCase().includes(term) ?? false;
      const inCategory = t.category.toLowerCase().includes(term);
      if (!inDescription && !inCategory) return false;
    }

    return true;
  });
}

function applySorting(
  transactions: Transaction[],
  sort: SortConfig,
): Transaction[] {
  const sorted = [...transactions];
  const dir = sort.order === 'asc' ? 1 : -1;

  sorted.sort((a, b) => {
    switch (sort.field) {
      case 'date':
        return dir * a.date.localeCompare(b.date);
      case 'amount':
        return dir * (a.amount - b.amount);
      case 'category':
        return dir * a.category.localeCompare(b.category);
      case 'type':
        return dir * a.type.localeCompare(b.type);
      default:
        return 0;
    }
  });

  return sorted;
}

export interface CategoryBreakdown {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

function buildCategoryBreakdown(
  transactions: Transaction[],
  type: TransactionType,
): CategoryBreakdown[] {
  const filtered = transactions.filter((t) => t.type === type);
  const grandTotal = filtered.reduce((s, t) => s + t.amount, 0);
  const map = new Map<string, { total: number; count: number }>();

  for (const t of filtered) {
    const entry = map.get(t.category) ?? { total: 0, count: 0 };
    entry.total += t.amount;
    entry.count += 1;
    map.set(t.category, entry);
  }

  return Array.from(map.entries())
    .map(([category, { total, count }]) => ({
      category,
      total,
      count,
      percentage: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);
}


export function useTransactions() {
  //Core state
  const [transactions, setTransactions] = useState<Transaction[]>(loadFromStorage);
  const [filters, setFilters] = useState<TransactionFilters>({});
  const [sort, setSort] = useState<SortConfig>({ field: 'date', order: 'desc' });

  //Persist to localStorage
  useEffect(() => {
    saveToStorage(transactions);
  }, [transactions]);

  //CRUD ops
  const addTransaction = useCallback(
    (data: Omit<Transaction, 'id'>): void => {
      const newTransaction: Transaction = {
        ...data,
        id: crypto.randomUUID(),
      };
      setTransactions((prev) => [newTransaction, ...prev]);
    },
    [],
  );

  const editTransaction = useCallback(
    (id: string, updates: Partial<Omit<Transaction, 'id'>>): void => {
      setTransactions((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      );
    },
    [],
  );

  const deleteTransaction = useCallback(
    (id: string): void => {
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    },
    [],
  );

  const clearAll = useCallback((): void => {
    setTransactions([]);
  }, []);

  //Derived data

  const filteredTransactions = useMemo(
    () => applyFilters(transactions, filters),
    [transactions, filters],
  );

  const sortedTransactions = useMemo(
    () => applySorting(filteredTransactions, sort),
    [filteredTransactions, sort],
  );

  const summary: Summary = useMemo(() => {
    const totalIncome = transactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = transactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
    };
  }, [transactions]);

  const filteredSummary: Summary = useMemo(() => {
    const totalIncome = filteredTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = filteredTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
    };
  }, [filteredTransactions]);

  const incomeByCategory = useMemo(
    () => buildCategoryBreakdown(transactions, 'income'),
    [transactions],
  );

  const expenseByCategory = useMemo(
    () => buildCategoryBreakdown(transactions, 'expense'),
    [transactions],
  );

  //Recent transactions (last 5)
  const recentTransactions = useMemo(
    () =>
      [...transactions]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5),
    [transactions],
  );

  const updateFilters = useCallback(
    (patch: Partial<TransactionFilters>): void => {
      setFilters((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const resetFilters = useCallback((): void => {
    setFilters({});
  }, []);

  // Column headers toggle direction; the sort dropdown supplies both at once.
  const updateSort = useCallback((field: SortField): void => {
    setSort((prev) => ({
      field,
      order: prev.field === field && prev.order === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  const applySort = useCallback((config: SortConfig): void => {
    setSort(config);
  }, []);

  /* ── Public API ── */
  return {
    // raw data
    transactions,

    // CRUD
    addTransaction,
    editTransaction,
    deleteTransaction,
    clearAll,

    // filtering
    filters,
    updateFilters,
    resetFilters,
    filteredTransactions,

    // sorting
    sort,
    updateSort,
    setSort: applySort,
    sortedTransactions,

    // summaries
    summary,
    filteredSummary,

    // category breakdowns (for charts)
    incomeByCategory,
    expenseByCategory,

    // convenience
    recentTransactions,
  };
}