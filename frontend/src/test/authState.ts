import { vi } from 'vitest';
import type { Session, User } from '@supabase/supabase-js';
import type { AuthState } from '../auth/authContext';

/**
 * Factories for the auth context in tests.
 *
 * <p>Separate from {@link TestAuthProvider} because the React Fast Refresh rule
 * requires a module that exports a component to export nothing else.
 */
export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'dev@primeledger.test',
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as User;
}

export function makeAuthState(overrides: Partial<AuthState> = {}): AuthState {
  const user = overrides.user === undefined ? makeUser() : overrides.user;

  return {
    user,
    session: user ? ({ access_token: 'test-token', user } as Session) : null,
    isLoading: false,
    isConfigured: true,
    signIn: vi.fn().mockResolvedValue({ error: null }),
    signUp: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue(undefined),
    requestPasswordReset: vi.fn().mockResolvedValue({ error: null }),
    updatePassword: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}
