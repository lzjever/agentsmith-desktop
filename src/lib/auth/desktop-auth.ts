import type { DesktopAuthConfig, DesktopAuthSession, SignedInUser } from '../../types';

export interface DesktopAuthFetch {
  (input: string, init?: RequestInit): Promise<Response>;
}

export interface DesktopAuthStartState {
  request_id: string;
  browser_start_url: string;
  poll_url: string;
  poll_interval_ms: number;
}

export interface DesktopAuthPollState {
  request_id: string;
  status: 'pending' | 'authenticated' | 'exchanged' | 'expired' | 'failed';
  exchange_ticket: string | null;
  authenticated_user: SignedInUser | null;
}

function trimTrailingSlashes(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function buildApiUrl(apiBaseUrl: string, path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  const normalizedApiBaseUrl = trimTrailingSlashes(apiBaseUrl);
  if (path.startsWith('/api/')) {
    const origin = new URL(normalizedApiBaseUrl).origin;
    return `${origin}${path}`;
  }
  return `${normalizedApiBaseUrl}/${path.replace(/^\/+/, '')}`;
}

export async function fetchDesktopAuthConfig(
  deploymentBaseUrl: string,
  fetchImpl: DesktopAuthFetch = fetch,
): Promise<DesktopAuthConfig> {
  const response = await fetchImpl(`${trimTrailingSlashes(deploymentBaseUrl)}/api/public/desktop/auth`, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`desktop_auth_config_failed_${response.status}`);
  }
  return response.json() as Promise<DesktopAuthConfig>;
}

export async function startDesktopAuthorization(args: {
  authConfig: DesktopAuthConfig;
  fetchImpl?: DesktopAuthFetch;
}): Promise<DesktopAuthStartState> {
  const response = await (args.fetchImpl ?? fetch)(buildApiUrl(args.authConfig.api_base_url ?? args.authConfig.deployment_base_url, '/api/v1/desktop/auth/start'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      deployment_base_url: args.authConfig.deployment_base_url,
    }),
  });
  if (!response.ok) {
    throw new Error(`desktop_auth_start_failed_${response.status}`);
  }
  return response.json() as Promise<DesktopAuthStartState>;
}

export async function pollDesktopAuthorization(args: {
  authConfig: DesktopAuthConfig;
  pollUrl: string;
  fetchImpl?: DesktopAuthFetch;
}): Promise<DesktopAuthPollState> {
  const response = await (args.fetchImpl ?? fetch)(buildApiUrl(args.authConfig.api_base_url ?? args.authConfig.deployment_base_url, args.pollUrl), {
    method: 'GET',
  });
  if (!response.ok) {
    throw new Error(`desktop_auth_poll_failed_${response.status}`);
  }
  return response.json() as Promise<DesktopAuthPollState>;
}

export async function exchangeDesktopAuthorizationCode(args: {
  authConfig: DesktopAuthConfig;
  requestId: string;
  exchangeTicket: string;
  fetchImpl?: DesktopAuthFetch;
}): Promise<{ session: DesktopAuthSession; signedInUser: SignedInUser }> {
  const response = await (args.fetchImpl ?? fetch)(buildApiUrl(args.authConfig.api_base_url ?? args.authConfig.deployment_base_url, '/api/v1/desktop/auth/exchange'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      request_id: args.requestId,
      exchange_ticket: args.exchangeTicket,
    }),
  });
  if (!response.ok) {
    throw new Error(`desktop_auth_exchange_failed_${response.status}`);
  }
  const payload = await response.json() as {
    access_token: string;
    signed_in_user: SignedInUser;
  };
  return {
    session: {
      access_token: payload.access_token,
      refresh_token: null,
      expires_at: null,
    },
    signedInUser: payload.signed_in_user,
  };
}
