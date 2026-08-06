import { describe, it, expect, vi } from 'vitest';
import { readEnv } from './env';

function source(overrides: Partial<ImportMetaEnv> = {}): ImportMetaEnv {
  return overrides as ImportMetaEnv;
}

describe('readEnv', () => {
  it('falls back to the local API when nothing is configured', () => {
    expect(readEnv(source()).apiBaseUrl).toBe('http://localhost:8080/api/v1');
  });

  it('uses the configured API base URL', () => {
    expect(readEnv(source({ VITE_API_BASE_URL: 'https://api.example.com/api/v1' })).apiBaseUrl).toBe(
      'https://api.example.com/api/v1',
    );
  });

  it('strips a trailing slash so callers can join paths safely', () => {
    expect(readEnv(source({ VITE_API_BASE_URL: 'https://api.example.com/api/v1/' })).apiBaseUrl).toBe(
      'https://api.example.com/api/v1',
    );
  });

  it('defaults an unrecognised app env to development', () => {
    expect(readEnv(source({ VITE_APP_ENV: 'staging' as never })).appEnv).toBe('development');
    expect(readEnv(source()).isProduction).toBe(false);
  });

  it('recognises production', () => {
    const env = readEnv(source({ VITE_APP_ENV: 'production', VITE_API_BASE_URL: 'https://api.example.com' }));
    expect(env.appEnv).toBe('production');
    expect(env.isProduction).toBe(true);
  });

  it('complains loudly if production has no API URL configured', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    readEnv(source({ VITE_APP_ENV: 'production' }));

    expect(error).toHaveBeenCalledWith(expect.stringContaining('VITE_API_BASE_URL'));
  });
});
