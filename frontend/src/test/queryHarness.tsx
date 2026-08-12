import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * A provider for hooks that read through TanStack Query.
 *
 * <p>Retries are off: the production client already refuses to retry a 4xx, but
 * a 500 would be retried twice, and a test asserting on a failure would wait for
 * three round trips before seeing it.
 */
export function QueryHarness({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
