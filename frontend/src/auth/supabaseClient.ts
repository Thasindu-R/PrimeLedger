import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

/**
 * The Supabase client, or null when the project is not configured.
 *
 * <p>Returning null rather than throwing is deliberate: a developer who has
 * cloned the repo and not yet made a Supabase project should get an app that
 * loads and says what is missing, not a white screen from a module-level throw.
 * {@link AuthProvider} turns the null into a visible, explained state.
 */
function create(): SupabaseClient | null {
  if (!env.isAuthConfigured) return null;

  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      // The client keeps the session in localStorage and refreshes the access
      // token in the background before it expires. That is the "token refresh
      // interceptor" of §12 — done by the SDK rather than hand-rolled, because
      // a bespoke refresh loop is a reliable source of races on tab focus.
      persistSession: true,
      autoRefreshToken: true,
      // Password-reset and email-verification links come back as a URL fragment
      // that the SDK exchanges for a session.
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });
}

export const supabase = create();

/** Narrowing helper so call sites do not repeat the null check. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    );
  }
  return supabase;
}
