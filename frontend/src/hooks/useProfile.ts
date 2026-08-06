import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'primeledger_profile';
const DEFAULT_DISPLAY_NAME = 'Guest';

/**
 * Local stand-in for the authenticated profile. It exists so the display name
 * and handle stop being literals in App.tsx (D-08); Phase 3 replaces the whole
 * hook with the Supabase session (FR-08).
 */
export function useProfile() {
  const [displayName, setStoredName] = useState<string>(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DISPLAY_NAME;
    try {
      const parsed = JSON.parse(raw) as { displayName?: unknown };
      return typeof parsed.displayName === 'string' && parsed.displayName.trim()
        ? parsed.displayName
        : DEFAULT_DISPLAY_NAME;
    } catch {
      return DEFAULT_DISPLAY_NAME;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ displayName }));
  }, [displayName]);

  const setDisplayName = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setStoredName(trimmed);
  }, []);

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

  return { displayName, setDisplayName, handle, initials };
}
