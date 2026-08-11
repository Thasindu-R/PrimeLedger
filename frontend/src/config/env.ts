/**
 * Typed access to the Vite environment. Everything the app reads from
 * `import.meta.env` goes through here, so a missing variable surfaces in one
 * place rather than as `undefined` deep in a fetch call.
 */
export interface AppEnv {
  apiBaseUrl: string;
  appEnv: 'development' | 'preview' | 'production';
  isProduction: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** False when Supabase is not configured, which the sign-in page explains rather than crashing on. */
  isAuthConfigured: boolean;
}

const DEFAULT_API_BASE_URL = 'http://localhost:8080/api/v1';

function readAppEnv(value: string | undefined): AppEnv['appEnv'] {
  if (value === 'preview' || value === 'production') return value;
  return 'development';
}

export function readEnv(source: ImportMetaEnv): AppEnv {
  const appEnv = readAppEnv(source.VITE_APP_ENV);
  const apiBaseUrl = (source.VITE_API_BASE_URL ?? '').trim() || DEFAULT_API_BASE_URL;
  const supabaseUrl = (source.VITE_SUPABASE_URL ?? '').trim();
  const supabaseAnonKey = (source.VITE_SUPABASE_ANON_KEY ?? '').trim();

  if (appEnv === 'production' && !source.VITE_API_BASE_URL) {
    // Loud in the console rather than silently pointing production at localhost.
    console.error(
      '[PrimeLedger] VITE_API_BASE_URL is not set; falling back to the local API URL.',
    );
  }

  const isAuthConfigured = supabaseUrl !== '' && supabaseAnonKey !== '';

  if (appEnv === 'production' && !isAuthConfigured) {
    // A production build with no Supabase project cannot sign anybody in. Better
    // to say so at start-up than to render a login form that can never succeed.
    console.error(
      '[PrimeLedger] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set; authentication is unavailable.',
    );
  }

  return {
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ''),
    appEnv,
    isProduction: appEnv === 'production',
    supabaseUrl: supabaseUrl.replace(/\/$/, ''),
    // The anon key is designed to be public — it identifies the project and
    // grants nothing on its own, because row-level security is what actually
    // guards the data. The service-role key is the one that must never be here.
    supabaseAnonKey,
    isAuthConfigured,
  };
}

export const env = readEnv(import.meta.env);
