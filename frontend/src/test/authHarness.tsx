import type { ReactNode } from 'react';
import { AuthContext, type AuthState } from '../auth/authContext';
import { makeAuthState } from './authState';

/**
 * A stand-in for {@code AuthProvider} in tests.
 *
 * <p>Tests that are about the ledger should not also be about authentication.
 * This supplies a signed-in user so those tests keep asserting what they were
 * written to assert, and lets the auth-specific tests drive the state
 * explicitly by passing overrides.
 */
export function TestAuthProvider({
  children,
  value,
}: {
  children: ReactNode;
  value?: Partial<AuthState>;
}) {
  return <AuthContext.Provider value={makeAuthState(value)}>{children}</AuthContext.Provider>;
}
