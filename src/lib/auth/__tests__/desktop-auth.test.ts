import type { DesktopAuthConfig } from '../../../types';
import {
  exchangeDesktopAuthorizationCode,
  fetchDesktopAuthConfig,
  pollDesktopAuthorization,
  startDesktopAuthorization,
} from '../desktop-auth';

const AUTH_CONFIG: DesktopAuthConfig = {
  deployment_base_url: 'https://agentsmith.example.com',
  api_base_url: 'https://api.agentsmith.example.com/api/v1',
};

describe('desktop auth client', () => {
  it('loads desktop auth bootstrap config from the deployment', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(AUTH_CONFIG), { status: 200 }));
    await expect(fetchDesktopAuthConfig('https://agentsmith.example.com', fetchMock)).resolves.toEqual(AUTH_CONFIG);
    expect(fetchMock).toHaveBeenCalledWith('https://agentsmith.example.com/api/public/desktop/auth', { method: 'GET' });
  });

  it('starts brokered desktop authorization through the api', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      request_id: 'dreq_123',
      browser_start_url: 'https://agentsmith.example.com/en-US/desktop/auth/request?desktop_auth_request_id=dreq_123',
      poll_url: '/api/v1/desktop/auth/requests/dreq_123',
      poll_interval_ms: 1500,
    }), { status: 201 }));

    await expect(startDesktopAuthorization({
      authConfig: AUTH_CONFIG,
      fetchImpl: fetchMock,
    })).resolves.toEqual({
      request_id: 'dreq_123',
      browser_start_url: 'https://agentsmith.example.com/en-US/desktop/auth/request?desktop_auth_request_id=dreq_123',
      poll_url: '/api/v1/desktop/auth/requests/dreq_123',
      poll_interval_ms: 1500,
    });

    expect(fetchMock).toHaveBeenCalledWith('https://api.agentsmith.example.com/api/v1/desktop/auth/start', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('polls the brokered desktop authorization request state', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      request_id: 'dreq_123',
      status: 'authenticated',
      exchange_ticket: 'dext_123',
      authenticated_user: {
        id: 'user_1',
        email: 'user@example.com',
        name: 'User Example',
      },
    }), { status: 200 }));

    await expect(pollDesktopAuthorization({
      authConfig: AUTH_CONFIG,
      pollUrl: '/api/v1/desktop/auth/requests/dreq_123',
      fetchImpl: fetchMock,
    })).resolves.toMatchObject({
      status: 'authenticated',
      exchange_ticket: 'dext_123',
    });
  });

  it('exchanges the authenticated request into a desktop session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'dsk_123',
      signed_in_user: {
        id: 'user_1',
        email: 'user@example.com',
        name: 'User Example',
      },
    }), { status: 200 }));
    const exchanged = await exchangeDesktopAuthorizationCode({
      authConfig: AUTH_CONFIG,
      requestId: 'dreq_123',
      exchangeTicket: 'dext_123',
      fetchImpl: fetchMock,
    });

    expect(exchanged).toEqual({
      session: {
        access_token: 'dsk_123',
        refresh_token: null,
        expires_at: null,
      },
      signedInUser: {
        id: 'user_1',
        email: 'user@example.com',
        name: 'User Example',
      },
    });
  });
});
