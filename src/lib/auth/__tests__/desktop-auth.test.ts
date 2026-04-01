import type { DesktopAuthConfig } from '../../../types';
import {
  buildSignedInUser,
  exchangeDesktopAuthorizationCode,
  fetchDesktopAuthConfig,
  startDesktopAuthorization,
} from '../desktop-auth';

const AUTH_CONFIG: DesktopAuthConfig = {
  deployment_base_url: 'https://agentsmith.example.com',
  issuer: 'https://agentsmith.example.com/realms/mbos',
  authorization_endpoint: 'https://agentsmith.example.com/realms/mbos/protocol/openid-connect/auth',
  token_endpoint: 'https://agentsmith.example.com/realms/mbos/protocol/openid-connect/token',
  client_id: 'agentsmith-desktop',
  scopes: ['openid', 'profile', 'email'],
  response_type: 'code',
  pkce_method: 'S256',
  suggested_callback_origin: 'http://127.0.0.1',
  suggested_callback_path: '/desktop/auth/callback',
};

function makeAccessTokenPayload(payload: Record<string, unknown>) {
  return `header.${btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')}.sig`;
}

describe('desktop auth client', () => {
  it('loads desktop auth config from the deployment', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(AUTH_CONFIG), { status: 200 }));
    await expect(fetchDesktopAuthConfig('https://agentsmith.example.com', fetchMock)).resolves.toEqual(AUTH_CONFIG);
    expect(fetchMock).toHaveBeenCalledWith('https://agentsmith.example.com/api/public/desktop/auth', { method: 'GET' });
  });

  it('builds an authorization url with PKCE', async () => {
    const result = await startDesktopAuthorization({
      authConfig: AUTH_CONFIG,
      callbackUrl: 'http://127.0.0.1:38111/desktop/auth/callback',
    });
    const url = new URL(result.authorizationUrl);
    expect(url.origin + url.pathname).toBe(AUTH_CONFIG.authorization_endpoint);
    expect(url.searchParams.get('client_id')).toBe('agentsmith-desktop');
    expect(url.searchParams.get('redirect_uri')).toBe('http://127.0.0.1:38111/desktop/auth/callback');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(result.state).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('exchanges an authorization code for a desktop session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'token_a',
      refresh_token: 'refresh_a',
      expires_in: 1800,
    }), { status: 200 }));
    const session = await exchangeDesktopAuthorizationCode({
      authConfig: AUTH_CONFIG,
      code: 'code_a',
      verifier: 'verifier_a',
      callbackUrl: 'http://127.0.0.1:38111/desktop/auth/callback',
      fetchImpl: fetchMock,
    });
    expect(session.access_token).toBe('token_a');
    expect(session.refresh_token).toBe('refresh_a');
    expect(session.expires_at).toBeTypeOf('number');
  });

  it('derives the signed-in user from token claims', () => {
    const user = buildSignedInUser(makeAccessTokenPayload({
      sub: 'user_1',
      email: 'user@example.com',
      name: 'User Example',
    }));
    expect(user).toEqual({
      id: 'user_1',
      email: 'user@example.com',
      name: 'User Example',
    });
  });
});
