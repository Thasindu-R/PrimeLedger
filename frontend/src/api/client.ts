import { env } from '../config/env';
import { supabase } from '../auth/supabaseClient';

export class ApiError extends Error {
  // Declared as fields rather than constructor parameter properties, which
  // `erasableSyntaxOnly` disallows — that syntax emits code rather than erasing.
  readonly status: number;
  readonly requestId?: string;
  readonly fieldErrors?: Record<string, string>;

  constructor(
    status: number,
    message: string,
    requestId?: string,
    fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.requestId = requestId;
    this.fieldErrors = fieldErrors;
  }
}

/**
 * `fetch` with the access token attached and one retry after a refresh.
 *
 * <p>This is the token-refresh interceptor from §12. The Supabase SDK already
 * refreshes in the background, so the 401 path here is for the case it cannot
 * cover: a token that expired between being read and the request arriving, or a
 * laptop that was asleep. One retry, not a loop — if a freshly refreshed token
 * is also rejected, the session is genuinely gone and retrying would spin.
 *
 * <p>Phase 4 builds the typed, cached client on top of this. Phase 3 only needs
 * the part that proves a real token reaches a real API.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${env.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;

  const first = await send(url, init, await accessToken());
  if (first.status !== 401) return first;

  const refreshed = await refreshAccessToken();
  if (!refreshed) return first;

  return send(url, init, refreshed);
}

/** `apiFetch` plus the error envelope from §8.2 turned into an exception. */
export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await apiFetch(path, init);

  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.message ?? `Request failed with ${response.status}`,
      body?.requestId,
      body?.fieldErrors,
    );
  }

  return body as T;
}

async function send(url: string, init: RequestInit, token: string | null): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, { ...init, headers });
}

async function accessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.refreshSession();
  return error ? null : (data.session?.access_token ?? null);
}
