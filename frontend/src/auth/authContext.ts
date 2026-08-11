import { createContext, useContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthResult {
  /** Null on success; a message safe to show the user on failure. */
  error: string | null;
  /** Sign-up succeeded but the address needs confirming before sign-in works. */
  needsEmailConfirmation?: boolean;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  /** True until the initial session lookup resolves — routes must not redirect before then. */
  isLoading: boolean;
  /** False when VITE_SUPABASE_* are unset; the UI explains rather than failing. */
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside an <AuthProvider>');
  }
  return value;
}
