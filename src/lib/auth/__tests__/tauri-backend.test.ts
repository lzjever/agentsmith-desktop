import { createBrowserAuthRuntime, createTauriAuthRuntime, fetchDesktopAuthConfigViaTauri } from '../tauri-backend';

describe('createTauriAuthRuntime', () => {
  it('opens the browser through the tauri bridge', async () => {
    const invokeImpl = vi.fn().mockResolvedValue(undefined);
    const runtime = createTauriAuthRuntime(invokeImpl);

    await runtime.startInteractiveSignIn({
      authorizationUrl: 'https://agentsmith.example.com/auth',
    });

    expect(invokeImpl).toHaveBeenNthCalledWith(1, 'open_external_url', {
      url: 'https://agentsmith.example.com/auth',
    });
  });
});

describe('createBrowserAuthRuntime', () => {
  it('opens the authorization url in the current browser context', async () => {
    const locationAssign = vi.fn();
    const runtime = createBrowserAuthRuntime(locationAssign);

    await runtime.startInteractiveSignIn({
      authorizationUrl: 'https://agentsmith.example.com/auth',
    });

    expect(locationAssign).toHaveBeenCalledWith('https://agentsmith.example.com/auth');
  });
});

describe('fetchDesktopAuthConfigViaTauri', () => {
  it('loads desktop auth config through the tauri invoke bridge', async () => {
    const invokeImpl = vi.fn().mockResolvedValue({
      deployment_base_url: 'http://localhost:3101',
      api_base_url: 'http://localhost:21000/api/v1',
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
