import { createBrowserAuthRuntime, createTauriAuthRuntime, fetchDesktopAuthConfigViaTauri } from '../tauri-backend';

describe('createTauriAuthRuntime', () => {
  it('starts the callback listener and opens the browser', async () => {
    const invokeImpl = vi.fn()
      .mockResolvedValueOnce({
        code: 'code_123',
        state: 'state_123',
        error: null,
      })
      .mockResolvedValueOnce(undefined);
    const runtime = createTauriAuthRuntime(invokeImpl);

    const callback = await runtime.startInteractiveSignIn({
      authorizationUrl: 'https://agentsmith.example.com/auth',
      callbackUrl: 'http://127.0.0.1:38111/desktop/auth/callback',
    });

    expect(invokeImpl).toHaveBeenNthCalledWith(1, 'await_auth_callback', {
      port: 38111,
      path: '/desktop/auth/callback',
    });
    expect(invokeImpl).toHaveBeenNthCalledWith(2, 'open_external_url', {
      url: 'https://agentsmith.example.com/auth',
    });
    expect(callback).toEqual({
      code: 'code_123',
      state: 'state_123',
      error: null,
    });
  });
});

describe('createBrowserAuthRuntime', () => {
  it('opens the authorization url in the current browser context', async () => {
    const locationAssign = vi.fn();
    const runtime = createBrowserAuthRuntime(locationAssign);

    const callback = await runtime.startInteractiveSignIn({
      authorizationUrl: 'https://agentsmith.example.com/auth',
      callbackUrl: 'http://127.0.0.1:38111/desktop/auth/callback',
    });

    expect(locationAssign).toHaveBeenCalledWith('https://agentsmith.example.com/auth');
    expect(callback).toBeNull();
  });
});

describe('fetchDesktopAuthConfigViaTauri', () => {
  it('loads desktop auth config through the tauri invoke bridge', async () => {
    const invokeImpl = vi.fn().mockResolvedValue({
      deployment_base_url: 'http://localhost:3101',
      api_base_url: 'http://localhost:21000/api/v1',
      issuer: 'http://localhost:18080/realms/mbos',
      authorization_endpoint: 'http://localhost:18080/realms/mbos/protocol/openid-connect/auth',
      token_endpoint: 'http://localhost:18080/realms/mbos/protocol/openid-connect/token',
      client_id: 'agentsmith',
      scopes: ['openid', 'profile', 'email'],
      response_type: 'code',
      pkce_method: 'S256',
      suggested_callback_origin: 'http://127.0.0.1',
      suggested_callback_path: '/desktop/auth/callback',
    });

    await expect(fetchDesktopAuthConfigViaTauri('http://localhost:3101', invokeImpl)).resolves.toMatchObject({
      deployment_base_url: 'http://localhost:3101',
      api_base_url: 'http://localhost:21000/api/v1',
    });

    expect(invokeImpl).toHaveBeenCalledWith('fetch_desktop_auth_config', {
      deploymentBaseUrl: 'http://localhost:3101',
    });
  });
});
