import { apiJson } from './client';
import { profileSchema, type WireProfile } from '../schemas/api';
import type { Profile } from '../types';

export interface ProfileInput {
  displayName: string;
  baseCurrency: string;
  avatarUrl?: string;
  locale?: string;
  theme?: string;
  dateFormat?: string;
}

/**
 * The signed-in user's profile.
 *
 * <p>Never 404s: the server creates one with defaults on first read, because
 * Supabase owns registration and there is no moment this application hears
 * about a new user.
 */
export async function getProfile(): Promise<Profile> {
  const body = await apiJson<unknown>('/profile');
  return toProfile(profileSchema.parse(body));
}

/** A full replacement, not a patch — send every field. */
export async function updateProfile(input: ProfileInput): Promise<Profile> {
  const body = await apiJson<unknown>('/profile', {
    method: 'PUT',
    body: JSON.stringify({
      displayName: input.displayName,
      baseCurrency: input.baseCurrency,
      avatarUrl: input.avatarUrl || undefined,
      locale: input.locale || undefined,
      theme: input.theme || undefined,
      dateFormat: input.dateFormat || undefined,
    }),
  });
  return toProfile(profileSchema.parse(body));
}

export function toProfile(wire: WireProfile): Profile {
  return {
    id: wire.id,
    displayName: wire.displayName,
    avatarUrl: wire.avatarUrl ?? undefined,
    baseCurrency: wire.baseCurrency,
    locale: wire.locale,
    theme: wire.theme,
    dateFormat: wire.dateFormat,
  };
}
