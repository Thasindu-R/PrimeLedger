import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';

/**
 * How many times a failed query is worth retrying.
 *
 * <p>Retrying a 4xx is pointless and actively harmful: the server has said the
 * request itself is wrong, so three more identical requests produce three more
 * identical rejections and delay the error the user needs to see. A 401 in
 * particular is already handled one layer down — `apiFetch` refreshes the token
 * and retries once — so a 401 arriving here means the session is genuinely gone.
 */
function retry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < 2;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry,
        // Long enough that moving between the four pages does not refetch the
        // same ledger three times; short enough that a change made in another
        // tab shows up without a reload.
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        // A failed write is reported to the user, who decides whether to try
        // again. Retrying automatically risks posting a transaction twice.
        retry: false,
      },
    },
  });
}

export const queryKeys = {
  transactions: ['transactions'] as const,
  categories: ['categories'] as const,
  accounts: ['accounts'] as const,
  /** The one the ledger files writes under, kept apart from the list of all of them. */
  defaultAccount: ['accounts', 'default'] as const,
  analytics: ['analytics'] as const,
  insights: ['analytics', 'insights'] as const,
  budgets: ['budgets'] as const,
  notifications: ['notifications'] as const,
  recurring: ['recurring'] as const,
  goals: ['goals'] as const,
  currencies: ['currencies'] as const,
  profile: ['profile'] as const,
};
