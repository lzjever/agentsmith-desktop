import type { SignedInUser } from '../../types';

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return atob(padded);
}

export function readSignedInUserFromAccessToken(accessToken: string): SignedInUser {
  const segments = accessToken.split('.');
  if (segments.length < 2) {
    throw new Error('desktop_access_token_invalid');
  }
  const payload = JSON.parse(decodeBase64Url(segments[1])) as Record<string, unknown>;
  const id = typeof payload.sub === 'string' && payload.sub.trim() ? payload.sub.trim() : '';
  const email = typeof payload.email === 'string' && payload.email.trim() ? payload.email.trim() : '';
  const name = typeof payload.name === 'string' && payload.name.trim()
    ? payload.name.trim()
    : (typeof payload.preferred_username === 'string' && payload.preferred_username.trim() ? payload.preferred_username.trim() : email);
  if (!id || !email || !name) {
    throw new Error('desktop_access_token_missing_claims');
  }
  return { id, email, name };
}
