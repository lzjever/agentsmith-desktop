import { createBrowserAuthRuntime, createTauriAuthRuntime } from '../tauri-backend';

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
