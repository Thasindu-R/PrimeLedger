import { useQuery } from '@tanstack/react-query';
import { fetchInsights } from '../api/analytics';
import { queryKeys } from '../lib/queryClient';

/**
 * The dashboard's observations panel (F-07).
 *
 * <p>Its own query rather than a field on the summary: the summary is what the
 * whole dashboard is drawn from, and a rules engine that got slower — or threw —
 * would take the balance, the charts and the breakdowns down with it. This way
 * the panel is the only thing that can fail.
 *
 * <p>The key sits under `analytics`, so anything that already invalidates the
 * dashboard refreshes the observations too. They are derived from exactly the
 * same rows.
 */
export function useInsights() {
  const insights = useQuery({
    queryKey: queryKeys.insights,
    queryFn: fetchInsights,
  });

  return {
    insights: insights.data ?? [],
    isLoading: insights.isPending,
    // Deliberately surfaced but not fatal: the panel hides itself rather than
    // showing an error where a nicety used to be.
    error: insights.error,
  };
}
