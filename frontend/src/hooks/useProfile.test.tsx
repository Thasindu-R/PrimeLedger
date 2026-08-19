import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useProfile } from './useProfile';
import { QueryHarness } from '../test/queryHarness';
import { getProfile, updateProfile } from '../api/profile';
import type { Profile } from '../types';

vi.mock('../api/profile');

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'user-1',
    displayName: 'Guest',
    baseCurrency: 'USD',
    locale: 'en-US',
    theme: 'system',
    dateFormat: 'yyyy-MM-dd',
    ...overrides,
  };
}

function render() {
  return renderHook(() => useProfile(), { wrapper: QueryHarness });
}

beforeEach(() => {
  // Call history, not just return values: two tests here assert that the
  // server was *not* asked to save, and a call left over from the previous
  // test would make them pass or fail for the wrong reason.
  vi.clearAllMocks();
  vi.mocked(getProfile).mockResolvedValue(profile());
  vi.mocked(updateProfile).mockImplementation(async (input) =>
    profile({ displayName: input.displayName, baseCurrency: input.baseCurrency }),
  );
});

describe('useProfile (D-08, F-05)', () => {
  it('defaults to a generic name rather than a hard-coded developer identity', async () => {
    const { result } = render();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.displayName).toBe('Guest');
    expect(result.current.displayName).not.toBe('Thasindu');
  });

  it('derives the handle from the display name instead of hard-coding it', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.setDisplayName('Grace Hopper');

    await waitFor(() => expect(result.current.displayName).toBe('Grace Hopper'));
    expect(result.current.handle).toBe('@gracehopper');
  });

  it('ignores a blank name so the header never renders empty', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.setDisplayName('   ');

    expect(updateProfile).not.toHaveBeenCalled();
    expect(result.current.displayName).toBe('Guest');
  });

  /**
   * The reason this hook stopped being a localStorage stand-in. A per-browser
   * base currency would mean the same ledger reporting different totals on a
   * laptop and a phone, which is not a preference — it is two answers to one
   * question.
   */
  it('sends the base currency to the server rather than keeping it locally', async () => {
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.setBaseCurrency('LKR');

    await waitFor(() => expect(result.current.baseCurrency).toBe('LKR'));
    expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ baseCurrency: 'LKR', displayName: 'Guest' }),
    );
  });

  /**
   * PUT /profile is a full replacement. Changing one field has to carry the
   * others, or saving a name would silently reset the currency to the server's
   * default — and the user would find out from a dashboard in the wrong money.
   */
  it('carries the untouched fields through a partial edit', async () => {
    vi.mocked(getProfile).mockResolvedValue(profile({ baseCurrency: 'GBP' }));
    const { result } = render();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.setDisplayName('Ada');

    await waitFor(() => expect(updateProfile).toHaveBeenCalled());
    expect(updateProfile).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Ada', baseCurrency: 'GBP' }),
    );
  });

  it('falls back to a usable name while the profile is still loading', () => {
    const { result } = render();

    // Before the request resolves: the header still has to render something,
    // and an empty string in the avatar is worse than a placeholder.
    expect(result.current.displayName).toBe('Guest');
    expect(result.current.baseCurrency).toBe('USD');
  });
});
