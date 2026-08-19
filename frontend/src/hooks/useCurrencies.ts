import { useQuery } from '@tanstack/react-query';
import { listCurrencies } from '../api/currencies';
import { queryKeys } from '../lib/queryClient';

/**
 * The currency list for pickers, and the day's rates (F-05).
 *
 * <p>Cached hard. Rates are published once a working day and the list of
 * currencies changes roughly never, so refetching this while somebody fills in
 * an account form would be traffic in exchange for nothing.
 */
export function useCurrencies() {
  const currencies = useQuery({
    queryKey: queryKeys.currencies,
    queryFn: listCurrencies,
    staleTime: 60 * 60 * 1000,
  });

  return {
    currencies: currencies.data ?? [],
    isLoading: currencies.isPending,
    error: currencies.error,
  };
}
