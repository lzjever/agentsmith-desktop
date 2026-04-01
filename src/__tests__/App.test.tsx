import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../App';

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('connects to a deployment and shows sign-in state', async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
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
    }), { status: 200 }));

    render(<App />);
    await user.click(screen.getByTestId('desktop__connect-submit'));

    await waitFor(() => {
      expect(screen.getByTestId('desktop__deployment-url')).toHaveTextContent('https://agentsmith.example.com');
    });
    expect(screen.getByTestId('desktop__signed-in-user')).toHaveTextContent('Not signed in');
    expect(screen.getByTestId('desktop__sign-in')).toBeInTheDocument();
  });

  it('restores a signed-in session from local storage and toggles activation', async () => {
    window.localStorage.setItem('agentsmith-desktop:session', JSON.stringify({
      deployment_base_url: 'https://agentsmith.example.com',
      auth_config: {
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
      },
      auth_session: {
        access_token: 'token_a',
        refresh_token: 'refresh_a',
        expires_at: 123,
      },
      signed_in_user: {
        id: 'user_1',
        email: 'user@example.com',
        name: 'User Example',
      },
      active_library_ids: [],
      library_aliases: {},
    }));

    render(<App />);
    const user = userEvent.setup();
    expect(screen.getByTestId('desktop__deployment-url')).toHaveTextContent('https://agentsmith.example.com');
    expect(screen.getByTestId('desktop__signed-in-user')).toHaveTextContent('user@example.com');
    const libraries = screen.getAllByTestId(/desktop__library--/);
    expect(libraries[0]).toHaveTextContent('Design Assets');
    await user.click(screen.getByTestId('desktop__library-toggle--lib_2'));
    expect(screen.getByTestId('desktop__library-toggle--lib_2')).toHaveTextContent('Deactivate');
  });

  it('signs out and clears the signed-in user', async () => {
    window.localStorage.setItem('agentsmith-desktop:session', JSON.stringify({
      deployment_base_url: 'https://agentsmith.example.com',
      auth_config: {
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
      },
      auth_session: {
        access_token: 'token_a',
        refresh_token: 'refresh_a',
        expires_at: 123,
      },
      signed_in_user: {
        id: 'user_1',
        email: 'user@example.com',
        name: 'User Example',
      },
      active_library_ids: [],
      library_aliases: {},
    }));
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByTestId('desktop__sign-out'));
    expect(screen.getByTestId('desktop__signed-in-user')).toHaveTextContent('Not signed in');
    expect(window.localStorage.getItem('agentsmith-desktop:session')).toBeNull();
  });
});
