import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useProfile } from './useProfile';

describe('useProfile (D-08)', () => {
  it('defaults to a generic name rather than a hard-coded developer identity', () => {
    const { result } = renderHook(() => useProfile());

    expect(result.current.displayName).toBe('Guest');
    expect(result.current.displayName).not.toBe('Thasindu');
  });

  it('derives the handle from the display name instead of hard-coding it', () => {
    const { result } = renderHook(() => useProfile());

    act(() => result.current.setDisplayName('Grace Hopper'));

    expect(result.current.handle).toBe('@gracehopper');
  });

  it('persists the display name across remounts', () => {
    const first = renderHook(() => useProfile());
    act(() => first.result.current.setDisplayName('Ada'));
    first.unmount();

    const second = renderHook(() => useProfile());
    expect(second.result.current.displayName).toBe('Ada');
  });

  it('ignores a blank name so the header never renders empty', () => {
    const { result } = renderHook(() => useProfile());

    act(() => result.current.setDisplayName('   '));

    expect(result.current.displayName).toBe('Guest');
  });
});
