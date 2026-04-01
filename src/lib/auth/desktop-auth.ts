import type { DesktopAuthConfig, DesktopAuthSession } from '../../types';
import { createPkceChallenge, randomBase64Url } from './pkce';
import { readSignedInUserFromAccessToken } from './jwt';

export interface DesktopAuthFetch {
  (input: string, init?: RequestInit): Promise<Response>;
}

export interface DesktopAuthStartState {
  authorizationUrl: string;
  state: string;
  verifier: string;
}

export async function fetchDesktopAuthConfig(
  deploymentBaseUrl: string,
  fetchImpl: DesktopAuthFetch = fetch,
): Promise<DesktopAuthConfig> {
  const response = await fetchImpl(`${deploymentBaseUrl}/api/public/desktop/auth`, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`desktop_auth_config_failed_${response.status}`);
  }
  return response.json() as Promise<DesktopAuthConfig>;
}

export async function startDesktopAuthorization(args: {
  authConfig: DesktopAuthConfig;
  callbackUrl: string;
}): Promise<DesktopAuthStartState> {
  const verifier = randomBase64Url(64);
  const state = randomBase64Url(32);
  const pkce = await createPkceChallenge(verifier);
  const url = new URL(args.authConfig.authorization_endpoint);
  url.searchParams.set('response_type', args.authConfig.response_type);
  url.searchParams.set('client_id', args.authConfig.client_id);
  url.searchParams.set('redirect_uri', args.callbackUrl);
  url.searchParams.set('scope', args.authConfig.scopes.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', pkce.challenge);
  url.searchParams.set('code_challenge_method', pkce.method);
  return {
    authorizationUrl: url.toString(),
    state,
    verifier,
  };
}

export async function exchangeDesktopAuthorizationCode(args: {
  authConfig: DesktopAuthConfig;
  code: string;
  verifier: string;
  callbackUrl: string;
  fetchImpl?: DesktopAuthFetch;
}): Promise<DesktopAuthSession> {
  const response = await (args.fetchImpl ?? fetch)(args.authConfig.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: args.code,
      client_id: args.authConfig.client_id,
      redirect_uri: args.callbackUrl,
      code_verifier: args.verifier,
    }).toString(),
  });
  if (!response.ok) {
    throw new Error(`desktop_token_exchange_failed_${response.status}`);
  }
  const payload = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token ?? null,
    expires_at: typeof payload.expires_in === 'number' ? Date.now() + (payload.expires_in * 1000) : null,
  };
}

export function buildSignedInUser(accessToken: string) {
  return readSignedInUserFromAccessToken(accessToken);
}
