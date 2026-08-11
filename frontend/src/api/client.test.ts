import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const getSession = vi.fn();
const refreshSession = vi.fn();

vi.mock('../auth/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: () => getSession(),
      refreshSession: () => refreshSession(),
    },
  },
  requireSupabase: () => {
    throw new Error('not used in these tests');
  },
}));

const { apiFetch, apiJson, ApiError } = await import('./client');

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiFetch', () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'first-token' } } });
    refreshSession.mockResolvedValue({
      data: { session: { access_token: 'second-token' } },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('attaches the access token as a bearer header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/transactions');

    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer first-token');
  });

  it('refreshes once and retries after a 401', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { message: 'expired' }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await apiFetch('/transactions');

    expect(response.status).toBe(200);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    const retryHeaders = fetchMock.mock.calls[1][1].headers as Headers;
    expect(retryHeaders.get('Authorization')).toBe('Bearer second-token');
  });

  it('does not retry more than once', async () => {
    // A second 401 means the session is genuinely gone. Retrying again would
    // spin against an endpoint that will never accept us.
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'expired' }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await apiFetch('/transactions');

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it('returns the original 401 when the refresh itself fails', async () => {
    refreshSession.mockResolvedValue({ data: { session: null }, error: { message: 'no' } });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { message: 'expired' }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await apiFetch('/transactions');

    expect(response.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('apiJson', () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'first-token' } } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('turns the error envelope into an ApiError', async () => {
    // A fresh Response per call: a body can only be read once, so a shared
    // instance would arrive already consumed on the second request.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () =>
        jsonResponse(422, {
          message: 'Category kind does not match',
          requestId: 'req-1',
          fieldErrors: { categoryId: 'wrong kind' },
        }),
      ),
    );

    await expect(apiJson('/transactions')).rejects.toBeInstanceOf(ApiError);

    try {
      await apiJson('/transactions');
    } catch (error) {
      const apiError = error as InstanceType<typeof ApiError>;
      expect(apiError.status).toBe(422);
      expect(apiError.requestId).toBe('req-1');
      expect(apiError.fieldErrors).toEqual({ categoryId: 'wrong kind' });
    }
  });

  it('handles a 204 with no body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(apiJson('/transactions/1')).resolves.toBeUndefined();
  });
});
