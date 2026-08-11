import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { AuthContext, type AuthResult, type AuthState } from './authContext';
import { supabase } from './supabaseClient';
import { env } from '../config/env';

/**
 * Holds the session and exposes the four things the auth pages need.
 *
 * <p>The session is read once on mount and then kept current by subscribing to
 * the SDK's `onAuthStateChange`. Subscribing rather than polling matters for
 * more than tidiness: it is what makes a token refresh, a sign-out in another
 * tab, or a password-reset link arriving in this one all converge on the same
 * state without a reload.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // Derived, not set in an effect: with no Supabase client there is nothing to
  // load, and the router should render the "not configured" explanation
  // immediately rather than after a render that shows a spinner.
  const [isLoading, setIsLoading] = useState(supabase !== null);

  useEffect(() => {
    if (!supabase) return;

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: NOT_CONFIGURED };

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    // Deliberately generic (§9.3): a message that distinguished "no such
    // account" from "wrong password" would turn the sign-in form into a way to
    // discover who has an account here.
    return { error: error ? 'Email or password is incorrect.' : null };
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    if (!supabase) return { error: NOT_CONFIGURED };

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/verify-email` },
    });

    if (error) return { error: error.message };

    // With email confirmation on, Supabase returns a user but no session. That
    // is the normal path, not a failure — the caller shows "check your inbox".
    return { error: null, needsEmailConfirmation: data.session === null };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    if (!supabase) return { error: NOT_CONFIGURED };

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    // The caller shows the same confirmation either way; this is only for
    // genuine transport failures.
    return { error: error && error.status !== 400 ? error.message : null };
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    if (!supabase) return { error: NOT_CONFIGURED };

    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ? error.message : null };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user: session?.user ?? null,
      session,
      isLoading,
      isConfigured: env.isAuthConfigured,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
    }),
    [session, isLoading, signIn, signUp, signOut, requestPasswordReset, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const NOT_CONFIGURED =
  'Authentication is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then reload.';
