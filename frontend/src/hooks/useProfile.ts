import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getProfile, updateProfile, type ProfileInput } from '../api/profile';
import { queryKeys } from '../lib/queryClient';
import type { Profile } from '../types';

const FALLBACK_DISPLAY_NAME = 'Guest';
const FALLBACK_BASE_CURRENCY = 'USD';

/**
 * The signed-in user's profile, from the server.
 *
 * <p>This used to be a localStorage stand-in — it existed so the display name
 * stopped being a literal in `App.tsx` (D-08), with a note saying Phase 3 would
 * replace it. Phase 3 replaced the *session* and left this behind, which was
 * survivable while the only thing in here was a name that nothing else read.
 *
 * <p>Phase 6 is what makes it load-bearing: `baseCurrency` is the currency every
 * reporting total is expressed in (F-05), and a per-browser value would mean the
 * same ledger reported different totals on a laptop and a phone.
 *
 * <p>The returned shape is deliberately the same as the old hook's, plus the
 * currency. Callers that only wanted a name did not need to change.
 */
export function useProfile() {
  const queryClient = useQueryClient();

  const profile = useQuery({
    queryKey: queryKeys.profile,
    queryFn: getProfile,
    // Rarely changes, and read on every page through the header.
    staleTime: 5 * 60 * 1000,
  });

  const current: Profile | undefined = profile.data;

  const save = useMutation({
    mutationFn: (input: ProfileInput) => updateProfile(input),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.profile, saved);
      // Every reporting total is denominated in the base currency, so changing
      // it changes every figure on the analytics page. Nothing else would
      // refetch it: the transactions have not moved.
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics });
    },
  });

  /**
   * PUT /profile is a full replacement, so a change to one field has to send
   * the others as they are. Reading them from the cached profile keeps that in
   * one place rather than at each call site.
   */
  const patch = useCallback(
    (changes: Partial<ProfileInput>) => {
      if (!current) return;
      save.mutate({
        displayName: current.displayName,
        baseCurrency: current.baseCurrency,
        avatarUrl: current.avatarUrl,
        locale: current.locale,
        theme: current.theme,
        dateFormat: current.dateFormat,
        ...changes,
      });
    },
    [current, save],
  );

  const displayName = current?.displayName ?? FALLBACK_DISPLAY_NAME;

  const setDisplayName = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || trimmed === displayName) return;
      patch({ displayName: trimmed });
    },
    [displayName, patch],
  );

  const setBaseCurrency = useCallback(
    (code: string) => {
      if (!code || code === current?.baseCurrency) return;
      patch({ baseCurrency: code });
    },
    [current, patch],
  );

  const handle = useMemo(
    () => `@${displayName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    [displayName],
  );

  const initials = useMemo(
    () =>
      displayName
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
    [displayName],
  );

  return {
    profile: current,
    displayName,
    setDisplayName,
    baseCurrency: current?.baseCurrency ?? FALLBACK_BASE_CURRENCY,
    setBaseCurrency,
    handle,
    initials,
    isLoading: profile.isPending,
    isSaving: save.isPending,
    error: save.error ?? profile.error,
  };
}
