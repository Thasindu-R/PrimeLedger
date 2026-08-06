/**
 * Typed access to the Vite environment. Everything the app reads from
 * `import.meta.env` goes through here, so a missing variable surfaces in one
 * place rather than as `undefined` deep in a fetch call.
 */
export interface AppEnv {
  apiBaseUrl: string;
  appEnv: 'development' | 'preview' | 'production';
  isProduction: boolean;
}

const DEFAULT_API_BASE_URL = 'http://localhost:8080/api/v1';

function readAppEnv(value: string | undefined): AppEnv['appEnv'] {
  if (value === 'preview' || value === 'production') return value;
  return 'development';
}

export function readEnv(source: ImportMetaEnv): AppEnv {
  const appEnv = readAppEnv(source.VITE_APP_ENV);
  const apiBaseUrl = (source.VITE_API_BASE_URL ?? '').trim() || DEFAULT_API_BASE_URL;

  if (appEnv === 'production' && !source.VITE_API_BASE_URL) {
    // Loud in the console rather than silently pointing production at localhost.
    console.error(
      '[PrimeLedger] VITE_API_BASE_URL is not set; falling back to the local API URL.',
    );
  }

  return {
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ''),
    appEnv,
    isProduction: appEnv === 'production',
  };
}

export const env = readEnv(import.meta.env);
